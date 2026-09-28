import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import zlib from 'zlib';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '12mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Supabase Data API configuration.
// The publishable key is safe for public/client use; RLS remains the security boundary.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xxsoybtxdqcdfkwgmktr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_anyy_6KDjdreKItxKQBlbg_pAkCgKK_';

const DEFAULT_PREVIEW_IMAGE =
  'https://xxsoybtxdqcdfkwgmktr.supabase.co/storage/v1/object/public/card-assets/uploads/1790152910652_yrigjm.jpg';

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absoluteUrl(req, value) {
  if (!value) return '';
  try {
    return new URL(value, `${req.protocol}://${req.get('host')}`).href;
  } catch (_) {
    return '';
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getPublicClient(identifier) {
  if (!identifier) return null;

  const isUuid = UUID_REGEX.test(identifier);
  const enc = encodeURIComponent(identifier);
  const filterParam = isUuid
    ? `id=eq.${enc}`
    : `or=(slug.eq.${enc},business_slug.eq.${enc})`;
  const endpoint =
    `${SUPABASE_URL}/rest/v1/public_client_cards?select=*&${filterParam}&limit=1`;

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase preview lookup failed: ${response.status}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function renderCardHtml(req) {
  const filePath = path.join(__dirname, 'card.html');
  let html = await fs.readFile(filePath, 'utf8');

  const identifier = String(req.query.slug || req.query.id || '').trim();
  const profile = String(req.query.profile || 'personal').toLowerCase();

  let client = null;
  if (identifier && identifier !== 'demo' && identifier !== 'demo-kds-digital-card') {
    try {
      client = await getPublicClient(identifier);
    } catch (error) {
      console.warn('Dynamic social preview lookup failed:', error.message);
    }
  }

  const template = String(client?.template || '').toLowerCase();
  const isBusinessView =
    template === 'business_only' ||
    template === 'business' ||
    (client?.business_slug && identifier === client.business_slug) ||
    (template === 'personal_business' && profile === 'business');

  let previewImage =
    (isBusinessView
      ? (client?.company_logo_url || client?.business_cover_image_url || client?.profile_image_url)
      : client?.profile_image_url) ||
    DEFAULT_PREVIEW_IMAGE;

  previewImage = absoluteUrl(req, previewImage) || DEFAULT_PREVIEW_IMAGE;

  const name = client?.full_name || client?.name || 'KDS Digital Card';
  const company = client?.company_name || client?.company || '';
  const designation = client?.designation || '';
  const title = isBusinessView && company
    ? `${company} • Business Identity`
    : `${name} • Digital Identity`;
  const description = isBusinessView
    ? (client?.business_bio || client?.tagline || client?.bio || `Official business identity for ${company || name}.`)
    : (client?.bio || (designation ? `${name} — ${designation}${company ? ` at ${company}` : ''}` : `Official digital identity for ${name}.`));

  const canonicalUrl = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`).href;

  // Replace only the social metadata values. The actual card UI continues
  // to be rendered by the existing client-side code exactly as before.
  html = html
    .replace(/<title>[^<]*<\/title>/i, `<title>${escHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/i, `<meta name="description" content="${escHtml(description)}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/i, `<link rel="canonical" href="${escHtml(canonicalUrl)}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/i, `<meta property="og:title" content="${escHtml(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/i, `<meta property="og:description" content="${escHtml(description)}" />`)
    .replace(/<meta property="og:image" content="[^"]*"\s*\/>/i, `<meta property="og:image" content="${escHtml(previewImage)}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/i, `<meta property="og:url" content="${escHtml(canonicalUrl)}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/i, `<meta name="twitter:title" content="${escHtml(title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/i, `<meta name="twitter:description" content="${escHtml(description)}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/>/i, `<meta name="twitter:image" content="${escHtml(previewImage)}" />`);

  return html;
}

// Dynamic card HTML must be handled before the static-file middleware so
// social crawlers receive client-specific Open Graph metadata.
app.get('/card.html', async (req, res, next) => {
  try {
    const html = await renderCardHtml(req);
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.type('html').send(html);
  } catch (error) {
    console.error('Dynamic card response failed:', error);
    next();
  }
});

// Verify authenticated Supabase user + admin_users authorization
async function verifyAdminRequest(req) {
  const authHeader = String(req.headers.authorization || '').trim();
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return { ok: false, status: 401, message: 'Authentication required.' };
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return { ok: false, status: 401, message: 'Authentication required.' };
  }

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`
      }
    });
    if (!userRes.ok) {
      return { ok: false, status: 401, message: 'Invalid or expired admin session.' };
    }
    const user = await userRes.json();
    if (!user?.id) {
      return { ok: false, status: 401, message: 'Invalid admin user.' };
    }

    const adminRes = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_users?select=user_id,email&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );
    if (!adminRes.ok) {
      return { ok: false, status: 403, message: 'Admin authorization check failed.' };
    }
    const adminRows = await adminRes.json();
    if (!Array.isArray(adminRows) || adminRows.length === 0) {
      return { ok: false, status: 403, message: 'Access denied. Administrator privileges required.' };
    }

    return { ok: true, user: adminRows[0] };
  } catch (err) {
    return { ok: false, status: 500, message: 'Failed to verify admin session.' };
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32Buffer(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const rawBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8');
    const crc = crc32Buffer(rawBuf);
    const compressed = entry.store ? rawBuf : zlib.deflateRawSync(rawBuf);
    const method = entry.store ? 0 : 8;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralSize = centralParts.reduce((acc, b) => acc + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

const DEFAULT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';

function dataUrlToBuffer(dataUrl) {
  const str = String(dataUrl || '');
  const match = str.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (match && match[1]) {
    try {
      return Buffer.from(match[1], 'base64');
    } catch (_) {
      // fall through
    }
  }
  return null;
}

async function resolveApkAssetBuffer(dataUrl, remoteUrl) {
  const fromData = dataUrlToBuffer(dataUrl || remoteUrl);
  if (fromData) return fromData;

  const urlStr = String(remoteUrl || '').trim();
  if (urlStr) {
    try {
      const parsed = new URL(urlStr);
      const isSafeHost =
        (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
        !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[::1\])/i.test(parsed.hostname);
      if (isSafeHost) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const resp = await fetch(parsed.href, { signal: controller.signal });
        clearTimeout(timer);
        if (resp.ok) {
          const contentType = String(resp.headers.get('content-type') || '').toLowerCase();
          if (contentType.startsWith('image/')) {
            const arrBuf = await resp.arrayBuffer();
            if (arrBuf.byteLength > 0 && arrBuf.byteLength <= 5 * 1024 * 1024) {
              return Buffer.from(arrBuf);
            }
          }
        }
      }
    } catch (_) {
      // Fall back to default PNG below
    }
  }

  return Buffer.from(DEFAULT_PNG_BASE64, 'base64');
}

const GITHUB_REPO = process.env.GITHUB_REPO || 'shofikulislamsamim/KDS-Client-Digital-Card';
const GITHUB_TOKEN = String(process.env.GITHUB_TOKEN || '').trim();
const GITHUB_API_VERSION = '2022-11-28';
const APK_WORKFLOW = 'build-generated-apk.yml';

async function githubApi(url, options = {}) {
  if (!GITHUB_TOKEN) {
    throw new Error('APK build service is not configured. Set GITHUB_TOKEN on the server.');
  }
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      ...(options.headers || {})
    }
  });
  const contentType = String(response.headers.get('content-type') || '');
  let data = null;
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.arrayBuffer().catch(() => new ArrayBuffer(0));
  }
  if (!response.ok) {
    const message = data?.message || `GitHub API request failed: ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return { response, data };
}

function validateGithubInput(value, maxLength = 500) {
  const str = String(value || '').trim();
  return str.length > 0 && str.length <= maxLength ? str : '';
}

async function findRecentWorkflowRun(afterIso) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${APK_WORKFLOW}/runs?event=workflow_dispatch&per_page=20`;
  const { data } = await githubApi(url);
  const after = new Date(afterIso).getTime();
  const runs = Array.isArray(data?.workflow_runs) ? data.workflow_runs : [];
  return runs.find((run) => new Date(run.created_at).getTime() >= after - 15000) || null;
}

app.post('/api/generate-apk', async (req, res) => {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  if (!GITHUB_TOKEN) {
    return res.status(503).json({
      error: 'Real APK build service is not configured on the server.',
      detail: 'Set GITHUB_TOKEN with Actions write permission for the KDS-Client-Digital-Card repository.'
    });
  }

  const body = req.body || {};
  const appName = validateGithubInput(body.appName, 80);
  const cardUrl = validateGithubInput(body.cardUrl, 2000);
  const profile = validateGithubInput(body.profile, 32);
  const packageId = validateGithubInput(body.packageId, 120);
  const internalAppId = validateGithubInput(body.internalAppId, 120);
  const splashTitle = validateGithubInput(body.splashTitle || appName, 120) || appName;
  const splashBgColor = /^#[0-9a-fA-F]{6}$/.test(String(body.splashBgColor || '').trim())
    ? String(body.splashBgColor).trim()
    : '#060a12';
  const safeFileName = (internalAppId || 'kds-card').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();

  if (!appName) return res.status(400).json({ error: 'App Name is required.' });
  if (!cardUrl) return res.status(400).json({ error: 'Card URL is required.' });
  try {
    const parsed = new URL(cardUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch (_) {
    return res.status(400).json({ error: 'Card URL must be a valid http/https URL.' });
  }
  if (!['personal', 'business', 'personal_business'].includes(profile)) {
    return res.status(400).json({ error: 'Selected profile is invalid.' });
  }
  if (!/^com\.kds\.card\.[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageId)) {
    return res.status(400).json({ error: 'Package identifier is invalid.' });
  }

  const dispatchStartedAt = new Date().toISOString();
  const dispatchUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${APK_WORKFLOW}/dispatches`;
  try {
    const dispatch = await githubApi(dispatchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          app_name: appName,
          card_url: cardUrl,
          profile,
          package_id: packageId,
          internal_app_id: internalAppId || 'kds-card',
          splash_title: splashTitle,
          splash_bg_color: splashBgColor,
          safe_file_name: safeFileName
        }
      })
    });

    let runId = Number(dispatch.data?.workflow_run_id || 0);
    if (!runId) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const recent = await findRecentWorkflowRun(dispatchStartedAt);
      runId = Number(recent?.id || 0);
    }

    if (!runId) {
      return res.status(502).json({ error: 'APK build was dispatched, but the GitHub Actions run ID could not be detected.' });
    }

    return res.json({
      ok: true,
      runId,
      workflowUrl: `https://github.com/${GITHUB_REPO}/actions/workflows/${APK_WORKFLOW}`,
      message: 'Real Android APK build started.'
    });
  } catch (error) {
    console.error('APK workflow dispatch failed:', error);
    return res.status(error.status || 502).json({
      error: 'Could not start the real APK build.',
      detail: error.message
    });
  }
});

app.get('/api/generate-apk/status/:runId', async (req, res) => {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const runId = Number(req.params.runId);
  if (!Number.isInteger(runId) || runId <= 0) return res.status(400).json({ error: 'Invalid workflow run ID.' });

  try {
    const runUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${runId}`;
    const { data: run } = await githubApi(runUrl);
    const result = {
      ok: true,
      runId,
      status: run.status,
      conclusion: run.conclusion,
      htmlUrl: run.html_url,
      artifactId: null,
      artifactReady: false
    };

    if (run.status === 'completed' && run.conclusion === 'success') {
      const artifactsUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${runId}/artifacts?name=kds-installable-apk&per_page=10`;
      const { data: artifacts } = await githubApi(artifactsUrl);
      const artifact = (artifacts.artifacts || []).find((item) => !item.expired);
      if (artifact) {
        result.artifactId = artifact.id;
        result.artifactReady = true;
      }
    }
    return res.json(result);
  } catch (error) {
    return res.status(error.status || 502).json({ error: 'Could not read APK build status.', detail: error.message });
  }
});

app.get('/api/generate-apk/download/:runId', async (req, res) => {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const runId = Number(req.params.runId);
  if (!Number.isInteger(runId) || runId <= 0) return res.status(400).json({ error: 'Invalid workflow run ID.' });

  try {
    const artifactsUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${runId}/artifacts?name=kds-installable-apk&per_page=10`;
    const { data: artifacts } = await githubApi(artifactsUrl);
    const artifact = (artifacts.artifacts || []).find((item) => !item.expired);
    if (!artifact) return res.status(404).json({ error: 'The finished APK artifact is not available yet.' });

    const downloadUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/artifacts/${artifact.id}/zip`;
    const response = await fetch(downloadUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': GITHUB_API_VERSION
      }
    });
    if (!response.ok) return res.status(response.status).json({ error: `GitHub artifact download failed: ${response.status}` });

    const zipBuffer = Buffer.from(await response.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    const apkEntry = zip.getEntries().find((entry) => /\.apk$/i.test(entry.entryName));
    if (!apkEntry) return res.status(502).json({ error: 'Build artifact does not contain an APK file.' });

    const apkBuffer = apkEntry.getData();
    const fileName = apkEntry.entryName.split('/').pop() || 'KDS-Digital-Card.apk';
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '')}"`);
    res.setHeader('Content-Length', String(apkBuffer.length));
    res.setHeader('Cache-Control', 'no-store');
    return res.send(apkBuffer);
  } catch (error) {
    console.error('APK artifact download failed:', error);
    return res.status(error.status || 502).json({ error: 'Could not download the generated APK.', detail: error.message });
  }
});

// Serve static assets from root directory.
app.use(express.static(__dirname));

// Fallback to index.html for unmatched routes.
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
