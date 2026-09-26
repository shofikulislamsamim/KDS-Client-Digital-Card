import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Supabase Data API configuration.
// The publishable key is safe for public/client use; RLS remains the security boundary.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xxsoybtxdqcdfkwgmktr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_anyy_6KDjdreKItxKQBlbg_pAkCgKK_';

const DEFAULT_PREVIEW_IMAGE =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=85';

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

async function getPublicClient(slug) {
  if (!slug) return null;

  const endpoint =
    `${SUPABASE_URL}/rest/v1/public_client_cards?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`;

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

  const slug = String(req.query.slug || '').trim();
  const profile = String(req.query.profile || 'personal').toLowerCase();

  let client = null;
  if (slug && slug !== 'demo') {
    try {
      client = await getPublicClient(slug);
    } catch (error) {
      console.warn('Dynamic social preview lookup failed:', error.message);
    }
  }

  const template = String(client?.template || '').toLowerCase();
  const isBusinessOnly = template === 'business_only' || template === 'business';

  // Personal and Personal + Business always use the personal profile photo.
  // Business-only uses the business logo when available, then falls back to
  // the business cover/profile asset, then the personal photo.
  let previewImage =
    (isBusinessOnly
      ? (client?.company_logo_url || client?.business_cover_image_url || client?.profile_image_url)
      : client?.profile_image_url) ||
    DEFAULT_PREVIEW_IMAGE;

  previewImage = absoluteUrl(req, previewImage) || DEFAULT_PREVIEW_IMAGE;

  const name = client?.full_name || client?.name || 'KDS Digital Visiting Card';
  const company = client?.company_name || client?.company || '';
  const designation = client?.designation || '';
  const title = isBusinessOnly && company
    ? `${company} • Business Profile`
    : `${name} • Digital Visiting Card`;
  const description = isBusinessOnly
    ? (client?.business_bio || client?.bio || `Professional business profile for ${company || name}.`)
    : (client?.bio || (designation ? `${name} — ${designation}` : `Professional digital visiting card for ${name}.`));

  const canonicalUrl = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`).href;

  // Replace only the social metadata values. The actual card UI continues
  // to be rendered by the existing client-side code exactly as before.
  html = html
    .replace(/<title>[^<]*<\/title>/i, `<title>${escHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/i, `<meta name="description" content="${escHtml(description)}" />`)
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

// Serve static assets from root directory.
app.use(express.static(__dirname));

// Fallback to index.html for unmatched routes.
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
