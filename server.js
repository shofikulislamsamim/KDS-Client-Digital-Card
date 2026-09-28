import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import zlib from 'zlib';
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

app.post('/api/generate-apk', async (req, res) => {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }

  const body = req.body || {};
  const appName = String(body.appName || '').trim();
  const cardUrl = String(body.cardUrl || '').trim();
  const profile = String(body.profile || 'personal').trim();
  const packageId = String(body.packageId || '').trim();
  const internalAppId = String(body.internalAppId || '').trim();
  const splashTitle = String(body.splashTitle || appName).trim();
  const splashBgColor = /^#[0-9a-fA-F]{6}$/.test(String(body.splashBgColor || '').trim())
    ? String(body.splashBgColor).trim()
    : '#060a12';

  if (!appName || appName.length > 80) {
    return res.status(400).json({ error: 'App Name is required (max 80 characters).' });
  }
  if (!cardUrl) {
    return res.status(400).json({ error: 'Card URL is required.' });
  }
  try {
    const parsedUrl = new URL(cardUrl);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'Card URL must use http or https.' });
    }
  } catch (_) {
    return res.status(400).json({ error: 'Card URL is invalid.' });
  }
  if (!['personal', 'business', 'personal_business'].includes(profile)) {
    return res.status(400).json({ error: 'Selected profile is invalid.' });
  }
  if (!/^com\.kds\.card\.[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageId)) {
    return res.status(400).json({ error: 'Package identifier is invalid.' });
  }

  const iconBuffer = await resolveApkAssetBuffer(body.iconDataUrl, body.iconUrl);
  const splashBuffer = await resolveApkAssetBuffer(
    body.splashDataUrl || body.iconDataUrl,
    body.splashImageUrl || body.iconUrl
  );
  const photoBuffer = await resolveApkAssetBuffer(
    body.photoDataUrl || body.iconDataUrl,
    body.photoUrl || body.iconUrl
  );

  const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${escHtml(packageId)}"
    android:versionCode="1"
    android:versionName="1.0.0">
    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${escHtml(appName)}"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true">
        <meta-data android:name="com.kds.card.TARGET_URL" android:value="${escHtml(cardUrl)}" />
        <meta-data android:name="com.kds.card.PROFILE_MODE" android:value="${escHtml(profile)}" />
        <meta-data android:name="com.kds.card.SPLASH_BG" android:value="${escHtml(splashBgColor)}" />
        <activity
            android:name="${escHtml(packageId)}.MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

  const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${escHtml(appName)}</string>
    <string name="kds_card_url">${escHtml(cardUrl)}</string>
    <string name="kds_profile">${escHtml(profile)}</string>
    <string name="splash_title">${escHtml(splashTitle)}</string>
    <color name="splash_bg">${escHtml(splashBgColor)}</color>
</resources>`;

  const appConfigJson = JSON.stringify(
    {
      appName,
      packageId,
      internalAppId,
      cardUrl,
      profile,
      splashTitle,
      splashBgColor,
      versionName: '1.0.0',
      versionCode: 1,
      generatedAt: new Date().toISOString()
    },
    null,
    2
  );

  const webviewIndexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>${escHtml(appName)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body,html{width:100%;height:100%;background:${escHtml(splashBgColor)};color:#fff;font-family:system-ui,-apple-system,sans-serif;overflow:hidden}
    .splash{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:${escHtml(splashBgColor)};z-index:10;transition:opacity .35s ease}
    .splash.hide{opacity:0;pointer-events:none}
    .splash-logo{width:88px;height:88px;border-radius:22px;object-fit:cover;border:2px solid rgba(56,189,248,.35)}
    .splash-title{font-size:1.25rem;font-weight:700;text-align:center;padding:0 20px}
    .splash-sub{font-size:.78rem;color:#94a3b8;letter-spacing:.08em;text-transform:uppercase}
    iframe{width:100%;height:100%;border:0;display:block}
  </style>
</head>
<body>
  <div class="splash" id="splash">
    <img class="splash-logo" src="../res/drawable/splash_logo.png" alt="${escHtml(appName)}">
    <div class="splash-title">${escHtml(splashTitle)}</div>
    <div class="splash-sub">KDS Digital Card</div>
  </div>
  <iframe id="cardFrame" src="${escHtml(cardUrl)}" allow="clipboard-write; web-share"></iframe>
  <script>
    const frame = document.getElementById('cardFrame');
    const hideSplash = () => document.getElementById('splash')?.classList.add('hide');
    frame.addEventListener('load', () => setTimeout(hideSplash, 350));
    setTimeout(hideSplash, 1400);
  </script>
</body>
</html>`;

  const dexHeader = Buffer.alloc(112);
  dexHeader.write('dex\n035\0', 0, 'ascii');
  dexHeader.writeUInt32LE(112, 32);
  dexHeader.writeUInt32LE(0x70, 36);
  dexHeader.writeUInt32LE(0x12345678, 40);

  const arscHeader = Buffer.alloc(32);
  arscHeader.writeUInt16LE(0x0002, 0);
  arscHeader.writeUInt16LE(0x000c, 2);
  arscHeader.writeUInt32LE(32, 4);

  const rawEntries = [
    { name: 'AndroidManifest.xml', data: Buffer.from(manifestXml, 'utf8'), store: false },
    { name: 'resources.arsc', data: arscHeader, store: true },
    { name: 'classes.dex', data: dexHeader, store: false },
    { name: 'assets/kds-app-config.json', data: Buffer.from(appConfigJson, 'utf8'), store: false },
    { name: 'assets/index.html', data: Buffer.from(webviewIndexHtml, 'utf8'), store: false },
    { name: 'res/values/strings.xml', data: Buffer.from(stringsXml, 'utf8'), store: false },
    { name: 'res/mipmap-mdpi/ic_launcher.png', data: iconBuffer, store: true },
    { name: 'res/mipmap-hdpi/ic_launcher.png', data: iconBuffer, store: true },
    { name: 'res/mipmap-xhdpi/ic_launcher.png', data: iconBuffer, store: true },
    { name: 'res/mipmap-xxhdpi/ic_launcher.png', data: iconBuffer, store: true },
    { name: 'res/mipmap-xxxhdpi/ic_launcher.png', data: iconBuffer, store: true },
    { name: 'res/drawable/splash_logo.png', data: splashBuffer, store: true },
    { name: 'res/drawable/profile_photo.png', data: photoBuffer, store: true }
  ];

  const manifestLines = [
    'Manifest-Version: 1.0',
    'Created-By: KDS Digital Card APK Builder 1.0',
    `Package-Name: ${packageId}`,
    ''
  ];
  for (const item of rawEntries) {
    const hash = crypto.createHash('sha256').update(item.data).digest('base64');
    manifestLines.push(`Name: ${item.name}`);
    manifestLines.push(`SHA-256-Digest: ${hash}`);
    manifestLines.push('');
  }

  rawEntries.push({
    name: 'META-INF/MANIFEST.MF',
    data: Buffer.from(manifestLines.join('\r\n'), 'utf8'),
    store: false
  });

  const apkBuffer = buildZipBuffer(rawEntries);
  const safeFile = (internalAppId || 'kds-card').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();

  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFile}.apk"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.send(apkBuffer);
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
