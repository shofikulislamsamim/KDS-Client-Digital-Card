const STORE_KEY = "kds_client_cards_v1";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEMO_CLIENT = {
  id: "demo",
  slug: "demo-kds-digital-card",
  template: "personal_business",
  name: "Shofikul Islam Samim",
  designation: "Digital Marketer | Graphic Designer",
  phone: "+880 1744 188460",
  whatsapp: "+880 1744 188460",
  email: "samim.khanmiyaa@gmail.com",
  location: "Dhaka, Bangladesh",
  bio: "I help businesses grow through digital marketing, creative design and modern strategies. Passionate about innovation, creativity and results.",
  photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80",
  cover: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80",
  company: "Khan Digital Solution",
  companyRole: "CEO & Owner",
  tagline: "Your Growth, Our Mission",
  website: "https://www.kds.com",
  services: "Digital Marketing, Video Editing, Graphic Design, Web Design & Development, IT Solution",
  facebook: "https://facebook.com",
  instagram: "https://instagram.com",
  linkedin: "https://linkedin.com",
  youtube: "https://youtube.com",
  tiktok: "https://tiktok.com",
  subscriptionActive: true,
  subscriptionStart: new Date().toISOString(),
  subscriptionEnd: null
};

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function qs(s) {
  return document.querySelector(s);
}

function slugify(v) {
  return (
    String(v || "client")
      .toLowerCase()
      .trim()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "client"
  );
}

function normalizeWhatsAppNumber(num) {
  if (!num) return "";
  let clean = String(num).trim().replace(/[^\d+]/g, "");
  if (!clean) return "";
  if (clean.startsWith("+")) {
    clean = clean.slice(1);
  } else if (/^01[3-9]\d{8}$/.test(clean)) {
    // Bangladesh mobile number (01XXXXXXXXX) -> 8801XXXXXXXXX
    clean = "880" + clean.slice(1);
  } else if (/^1[3-9]\d{8}$/.test(clean)) {
    clean = "880" + clean;
  }
  return clean;
}

function normalizeUrl(url) {
  if (!url) return "";
  const u = String(url).trim();
  if (!u) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
  if (u.startsWith("//")) return "https:" + u;
  return "https://" + u;
}

function sanitizeUrl(url, allowedSchemes = ["http:", "https:"]) {
  if (!url) return "";
  const norm = normalizeUrl(url);
  try {
    const parsed = new URL(norm, window.location.origin);
    if (!allowedSchemes.includes(parsed.protocol)) {
      return "";
    }
    return parsed.href;
  } catch (e) {
    return "";
  }
}

function cardUrl(clientOrId) {
  let identifier = clientOrId;
  if (clientOrId && typeof clientOrId === "object") {
    identifier = clientOrId.slug || clientOrId.id || "demo";
  }
  return "./card.html?slug=" + encodeURIComponent(identifier || "demo");
}

function getCardFullUrl(clientOrId, profile = "personal") {
  const rel = cardUrl(clientOrId) + (profile === "business" ? "&profile=business" : "");
  try {
    return new URL(rel, window.location.href).href;
  } catch (e) {
    return window.location.origin + "/" + rel;
  }
}

function getLocalCache() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setLocalCache(list) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("Local cache save failed:", e);
  }
}

function dbToClient(c) {
  if (!c) return null;
  return {
    id: c.id,
    slug: c.slug || slugify(c.full_name || c.name),
    template: c.template === "business" || c.template === "personal_business" || c.template === "business_only" ? c.template : "personal",
    name: c.full_name || c.name || "",
    designation: c.designation || "",
    phone: c.phone || "",
    whatsapp: c.whatsapp || "",
    email: c.email || "",
    location: c.address || c.location || "",
    bio: c.bio || "",
    photo: c.profile_image_url || c.photo || "",
    cover: c.cover_image_url || c.cover || "",
    company: c.company_name || c.company || "",
    companyRole: c.company_role || c.companyRole || "",
    companyLogo: c.company_logo_url || c.companyLogo || "",
    website: c.website || "",
    tagline: c.company_tagline || c.tagline || "",
    services: Array.isArray(c.services) ? c.services.join(", ") : (c.services || ""),
    facebook: c.social_links?.facebook || c.facebook || "",
    instagram: c.social_links?.instagram || c.instagram || "",
    linkedin: c.social_links?.linkedin || c.linkedin || "",
    youtube: c.social_links?.youtube || c.youtube || "",
    tiktok: c.social_links?.tiktok || c.tiktok || "",
    subscriptionActive: c.subscription_active !== undefined ? !!c.subscription_active : (c.subscriptionActive !== undefined ? !!c.subscriptionActive : true),
    subscriptionStart: c.subscription_start || c.subscriptionStart || null,
    subscriptionEnd: c.subscription_end || c.subscriptionEnd || null,
    businessSlug: c.business_slug || "",
    businessBio: c.business_bio || "",
    businessPhone: c.business_phone || "",
    businessWhatsapp: c.business_whatsapp || "",
    businessEmail: c.business_email || "",
    businessAddress: c.business_address || "",
    businessWebsite: c.business_website || c.website || "",
    businessServices: Array.isArray(c.business_services) ? c.business_services.join(", ") : (c.business_services || ""),
    businessFacebook: c.business_social_links?.facebook || "",
    businessInstagram: c.business_social_links?.instagram || "",
    businessLinkedin: c.business_social_links?.linkedin || "",
    businessYoutube: c.business_social_links?.youtube || "",
    businessTiktok: c.business_social_links?.tiktok || ""
  };
}

function clientToDb(c) {
  return {
    id: c.id || undefined,
    slug: c.slug || slugify(c.name),
    template: ["personal", "personal_business", "business_only"].includes(c.template) ? c.template : "personal",
    full_name: c.name || "",
    designation: c.designation || null,
    phone: c.phone || null,
    whatsapp: c.whatsapp || null,
    email: c.email || null,
    address: c.location || null,
    bio: c.bio || null,
    profile_image_url: c.photo || null,
    cover_image_url: c.cover || null,
    company_name: c.company || null,
    company_role: c.companyRole || null,
    company_logo_url: c.companyLogo || null,
    company_tagline: c.tagline || null,
    website: c.website || null,
    services: String(c.services || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    social_links: {
      facebook: c.facebook || "",
      instagram: c.instagram || "",
      linkedin: c.linkedin || "",
      youtube: c.youtube || "",
      tiktok: c.tiktok || ""
    },
    subscription_active: !!c.subscriptionActive,
    subscription_start: c.subscriptionStart || null,
    subscription_end: c.subscriptionEnd || null,
    business_slug: c.businessSlug || (["personal_business", "business_only"].includes(c.template)
      ? slugify(c.company || c.name) + "-business"
      : null),
    business_bio: c.businessBio || null,
    business_phone: c.businessPhone || null,
    business_whatsapp: c.businessWhatsapp || null,
    business_email: c.businessEmail || null,
    business_address: c.businessAddress || null,
    business_website: c.businessWebsite || null,
    business_services: String(c.businessServices || "")
      .split(",").map((x) => x.trim()).filter(Boolean),
    business_social_links: {
      facebook: c.businessFacebook || "",
      instagram: c.businessInstagram || "",
      linkedin: c.businessLinkedin || "",
      youtube: c.businessYoutube || "",
      tiktok: c.businessTiktok || ""
    }
  };
}

async function getClients() {
  try {
    if (!window.supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from("client_cards")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const clients = (data || []).map(dbToClient);
    setLocalCache(clients);
    return clients;
  } catch (e) {
    console.error("Supabase getClients error:", e);
    return [];
  }
}

async function getClient(identifier) {
  if (!identifier) return null;
  const idStr = String(identifier).trim();
  if (idStr === "demo") return { ...DEMO_CLIENT };

  try {
    if (window.supabaseClient) {
      let query = supabaseClient.from("public_client_cards").select("*");

      // UUID vs slug check to avoid PostgreSQL 22P02 invalid input syntax error
      if (UUID_REGEX.test(idStr)) {
        query = query.eq("id", idStr);
      } else {
        query = query.eq("slug", idStr);
      }

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        return dbToClient(data);
      }
      if (error) console.warn("Supabase getClient query error:", error);
    }
  } catch (e) {
    console.warn("Supabase error in getClient:", e);
  }

  return null;
}

async function saveClient(c) {
  const payload = clientToDb(c);
  const targetId = c.id || (crypto.randomUUID ? crypto.randomUUID() : "c_" + Date.now());
  payload.id = targetId;

  let savedRecord = null;

  try {
    if (window.supabaseClient) {
      const runSave = async (dataToSave) => {
        if (c.id) {
          return await supabaseClient
            .from("client_cards")
            .update(dataToSave)
            .eq("id", targetId);
        }
        return await supabaseClient
          .from("client_cards")
          .insert(dataToSave);
      };

      let res = await runSave(payload);

      // Graceful fallback if database schema does not yet have company_role column
      if (res.error && (res.error.code === "PGRST204" || res.error.code === "42703" || String(res.error.message).includes("company_role"))) {
        console.warn("Retrying save without company_role column (schema migration pending):", res.error.message);
        const fallbackPayload = { ...payload };
        delete fallbackPayload.company_role;
        res = await runSave(fallbackPayload);
      }

      if (res.error) throw res.error;
      // Do not request a SELECT in the same save operation. The admin RLS rules
      // can save successfully without requiring a returned row.
      savedRecord = { ...c, id: targetId };
    }
  } catch (err) {
    console.error("Supabase saveClient error:", err);
    throw err;
  }

  if (!savedRecord) {
    savedRecord = { ...c, id: targetId };
  }

  // Sync cache
  const cached = getLocalCache();
  const idx = cached.findIndex((x) => x.id === savedRecord.id);
  if (idx >= 0) cached[idx] = savedRecord;
  else cached.unshift(savedRecord);
  setLocalCache(cached);

  return savedRecord;
}

async function removeClient(id) {
  try {
    if (!window.supabaseClient) throw new Error("Secure database connection is unavailable.");

    const { data: client, error: fetchError } = await supabaseClient
      .from("client_cards")
      .select("profile_image_url,cover_image_url,company_logo_url")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw fetchError;

    const assetUrls = [client?.profile_image_url, client?.cover_image_url, client?.company_logo_url]
      .filter(Boolean)
      .map((url) => {
        try {
          const marker = "/storage/v1/object/public/card-assets/";
          const index = String(url).indexOf(marker);
          return index >= 0 ? decodeURIComponent(String(url).slice(index + marker.length)) : null;
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);

    if (assetUrls.length) {
      const { error: storageError } = await supabaseClient.storage
        .from("card-assets")
        .remove(assetUrls);
      if (storageError) console.warn("Some card assets could not be removed:", storageError);
    }

    const { error } = await supabaseClient.from("client_cards").delete().eq("id", id);
    if (error) throw error;
  } catch (e) {
    console.error("Supabase removeClient error:", e);
    throw e;
  }

  const cached = getLocalCache().filter((x) => x.id !== id);
  setLocalCache(cached);
}

function subscriptionState(c) {
  if (c.subscriptionActive === false) {
    return { status: "inactive", label: "Inactive" };
  }
  if (c.subscriptionEnd) {
    const end = new Date(c.subscriptionEnd);
    if (!isNaN(end.getTime()) && end.getTime() <= Date.now()) {
      return { status: "expired", label: "Expired" };
    }
  }
  return { status: "active", label: "Active" };
}

function isSubscriptionActive(c) {
  return subscriptionState(c).status === "active";
}

function formatDateTime(value) {
  if (!value) return "No expiry";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDate(value) {
  if (!value) return "No expiry";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function addDuration(start, days) {
  const d = new Date(start);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function activateSubscription(c, days) {
  c.subscriptionActive = true;
  c.subscriptionStart = new Date().toISOString();
  c.subscriptionEnd =
    days && Number(days) > 0 ? addDuration(c.subscriptionStart, Number(days)).toISOString() : null;
  return c;
}

function extendSubscription(c, days) {
  c.subscriptionActive = true;
  const numDays = Number(days || 0);

  // If currently active with an unexpired end date, add to existing end date
  if (c.subscriptionEnd && new Date(c.subscriptionEnd).getTime() > Date.now()) {
    c.subscriptionEnd = numDays > 0 ? addDuration(c.subscriptionEnd, numDays).toISOString() : null;
  } else {
    // Starting fresh
    c.subscriptionStart = new Date().toISOString();
    c.subscriptionEnd = numDays > 0 ? addDuration(c.subscriptionStart, numDays).toISOString() : null;
  }
  return c;
}

function deactivateSubscription(c) {
  c.subscriptionActive = false;
  return c;
}

function vcard(c) {
  const nameParts = (c.name || "Contact").trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN;CHARSET=UTF-8:" + (c.name || "").trim(),
    "N;CHARSET=UTF-8:" + lastName + ";" + firstName + ";;;",
  ];
  if (c.phone) lines.push("TEL;TYPE=CELL,VOICE:" + c.phone.trim());
  if (c.whatsapp && c.whatsapp.trim() !== c.phone?.trim()) {
    lines.push("TEL;TYPE=WORK,VOICE:" + c.whatsapp.trim());
  }
  if (c.email) lines.push("EMAIL;TYPE=PREF,INTERNET:" + c.email.trim());
  if (c.company) lines.push("ORG;CHARSET=UTF-8:" + c.company.trim());
  const role = c.companyRole || c.designation;
  if (role) lines.push("TITLE;CHARSET=UTF-8:" + role.trim());
  if (c.location) lines.push("ADR;TYPE=WORK;CHARSET=UTF-8:;;" + c.location.trim() + ";;;;");
  if (c.website) lines.push("URL:" + sanitizeUrl(c.website));
  if (c.bio) lines.push("NOTE;CHARSET=UTF-8:" + c.bio.replace(/[\r\n]+/g, " ").trim());
  if (c.photo && c.photo.startsWith("https://")) {
    lines.push("PHOTO;VALUE=URI:" + c.photo.trim());
  }
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function downloadContact(c) {
  const blob = new Blob([vcard(c)], { type: "text/vcard;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = slugify(c.name) + ".vcf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

// Clean recognizable SVG icons for Reference Design
const SVG_ICONS = {
  call: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.11 4.11 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
  email: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  vcard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  website: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  location: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
  briefcase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`,
  linkedin: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.74 1.45-.03 2.76-.97 3.23-2.34.22-.58.29-1.21.28-1.83V.02h-1.92z"/></svg>`
};

function getServiceIcon(serviceName) {
  const s = String(serviceName).toLowerCase();
  if (s.includes("market") || s.includes("seo") || s.includes("ads") || s.includes("sales") || s.includes("growth")) {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
  }
  if (s.includes("video") || s.includes("edit") || s.includes("motion") || s.includes("film") || s.includes("anim")) {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
  }
  if (s.includes("graphic") || s.includes("design") || s.includes("ui") || s.includes("ux") || s.includes("brand") || s.includes("art") || s.includes("logo")) {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>`;
  }
  if (s.includes("web") || s.includes("dev") || s.includes("code") || s.includes("software") || s.includes("app") || s.includes("program")) {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
  }
  if (s.includes("it") || s.includes("solution") || s.includes("support") || s.includes("tech") || s.includes("cloud") || s.includes("host") || s.includes("serv")) {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
}

async function renderCard() {
  const root = qs("#cardRoot");
  if (!root) return;

  const urlParams = new URLSearchParams(location.search);
  const identifier = urlParams.get("slug") || urlParams.get("id") || urlParams.get("preview");
  const isPreviewDemo = !identifier || identifier === "demo" || urlParams.has("preview");

  try {
    const c = await getClient(identifier || "demo");

    if (!c) {
      root.innerHTML = `
        <div class="kds-ref-wrapper">
          <section class="card-status-box not-found">
            <div class="status-box-icon">🔍</div>
            <h2>Client Card পাওয়া যায়নি</h2>
            <p>এই লিংকের সাথে কোনো ডিজিটাল ভিজিটিং কার্ড মিলছে না অথবা লিংকটি মুছে ফেলা হয়েছে।</p>
            <div class="status-box-actions">
              <a class="btn-save-contact" href="./index.html">Back to Home</a>
              <a class="btn-secondary" href="./card.html?preview=demo">View Demo Card</a>
            </div>
          </section>
        </div>`;
      return;
    }

    const sub = subscriptionState(c);
    const fullCardUrl = getCardFullUrl(c, "personal");

    // Dynamic Social Share / OpenGraph Meta Update
    const requestedProfile = urlParams.get("profile") === "business" ? "business" : "personal";
    const metaIsBusiness = !isPreviewDemo && c.template === "business" && requestedProfile === "business";
    const cardTitle = metaIsBusiness ? (c.company || "Business Profile") + " • Company Profile" : c.name + " • Digital Visiting Card";
    const cardDesc = metaIsBusiness ? ((c.company || "Company") + (c.tagline ? " — " + c.tagline : "") + (c.businessBio ? ". " + c.businessBio : "")) : (c.name + (c.designation ? " - " + c.designation : "") + (c.company ? " at " + c.company : "") + ". Connect and save contact information.");
    const cardPhoto = (metaIsBusiness ? sanitizeUrl(c.companyLogo) : sanitizeUrl(c.photo)) || (new URL("./css/style.css", window.location.href).href);

    document.title = cardTitle;
    const metaMappings = [
      ['meta[property="og:title"]', cardTitle],
      ['meta[property="og:description"]', cardDesc],
      ['meta[property="og:image"]', cardPhoto],
      ['meta[property="og:url"]', getCardFullUrl(c, metaIsBusiness ? "business" : "personal")],
      ['meta[name="twitter:title"]', cardTitle],
      ['meta[name="twitter:description"]', cardDesc],
      ['meta[name="twitter:image"]', cardPhoto]
    ];
    metaMappings.forEach(([selector, val]) => {
      const el = document.querySelector(selector);
      if (el && val) el.setAttribute("content", val);
    });

    // If subscription is inactive or expired, show subscription unavailable screen
    if (sub.status !== "active") {
      document.title = c.name + " • Subscription " + sub.label;
      root.innerHTML = `
        <div class="kds-ref-wrapper">
          <section class="subscription-block ${sub.status}">
            <div class="subscription-icon">${sub.status === "expired" ? "⏰" : "🔒"}</div>
            <div class="subscription-status-pill ${sub.status}">${esc(sub.label)}</div>
            <h1>Card Unavailable</h1>
            <p class="subscription-msg">এই ডিজিটাল কার্ডের সাবস্ক্রিপশন মেয়াদ এখন <strong>${esc(sub.label)}</strong>।</p>
            ${c.subscriptionEnd ? `<div class="subscription-date-row"><span>Expiry Date:</span> <strong>${esc(formatDateTime(c.subscriptionEnd))}</strong></div>` : ""}
            <p class="subscription-hint">কার্ডটি পুনরায় সক্রিয় করতে কার্ডের ওনার অথবা অ্যাডমিনের সাথে যোগাযোগ করুন।</p>
            <div class="status-box-actions">
              <a class="btn-secondary" href="./index.html">Back to Home</a>
            </div>
          </section>
        </div>`;
      return;
    }

    // Active Template selection (supports ?template=personal / ?template=business for testing/preview)
    const activeTemplate = isPreviewDemo
    ? (urlParams.get("template") || c.template || "business")
    : (c.template || "personal");
    const isBusinessProfile = !isPreviewDemo && activeTemplate === "business" && requestedProfile === "business";
    const isPersonal = !isBusinessProfile && (activeTemplate === "personal" || activeTemplate === "business");
    const isCombinedPersonal = activeTemplate === "business" && !isBusinessProfile;

    // Assets & sanitized URLs
    const photo =
      sanitizeUrl(c.photo) ||
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80";

    const coverUrl =
      sanitizeUrl(c.cover) ||
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80";

    const waClean = normalizeWhatsAppNumber(isBusinessProfile ? (c.businessWhatsapp || c.businessPhone) : (c.whatsapp || c.phone));
    const websiteClean = sanitizeUrl(isBusinessProfile ? c.businessWebsite : c.website);
    const logoClean = sanitizeUrl(c.companyLogo);
    const profileFullUrl = getCardFullUrl(c, isBusinessProfile ? "business" : "personal");
    const businessProfileUrl = getCardFullUrl(c, "business");
    const personalProfileUrl = getCardFullUrl(c, "personal");

    // Social Links (5 circular colorful buttons matching reference image)
    const socialConfigs = [
      { name: "Facebook", url: sanitizeUrl(isBusinessProfile ? c.businessFacebook : c.facebook) || (isPreviewDemo ? "https://facebook.com" : ""), key: "facebook", bgClass: "soc-fb" },
      { name: "Instagram", url: sanitizeUrl(isBusinessProfile ? c.businessInstagram : c.instagram) || (isPreviewDemo ? "https://instagram.com" : ""), key: "instagram", bgClass: "soc-ig" },
      { name: "LinkedIn", url: sanitizeUrl(isBusinessProfile ? c.businessLinkedin : c.linkedin) || (isPreviewDemo ? "https://linkedin.com" : ""), key: "linkedin", bgClass: "soc-li" },
      { name: "YouTube", url: sanitizeUrl(isBusinessProfile ? c.businessYoutube : c.youtube) || (isPreviewDemo ? "https://youtube.com" : ""), key: "youtube", bgClass: "soc-yt" },
      { name: "TikTok", url: sanitizeUrl(isBusinessProfile ? c.businessTiktok : c.tiktok) || (isPreviewDemo ? "https://tiktok.com" : ""), key: "tiktok", bgClass: "soc-tt" }
    ];

    const activeSocials = socialConfigs.filter(s => s.url);
    const socialsHtml = activeSocials.length ? `
      <div class="kds-social-row">
        ${activeSocials.map(s => `
          <a class="kds-social-circle ${s.bgClass}" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(s.name)}" title="${esc(s.name)}">
            ${SVG_ICONS[s.key] || ""}
          </a>
        `).join("")}
      </div>
    ` : "";

    // Services Chips (for Business Card)
    const servicesList = String(isBusinessProfile ? c.businessServices : c.services || "Digital Marketing, Video Editing, Graphic Design, Web Design & Development, IT Solution")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const servicesChipsHtml = servicesList.length ? `
      <div class="kds-services-grid">
        ${servicesList.map(s => `
          <div class="kds-service-chip">
            <div class="service-chip-icon">${getServiceIcon(s)}</div>
            <span class="service-chip-text">${esc(s)}</span>
          </div>
        `).join("")}
      </div>
    ` : "";


    const personalServicesChipsHtml = String(c.services || "").split(",").map(s => s.trim()).filter(Boolean).length ? `
      <div class="kds-services-grid kds-personal-services">
        ${String(c.services || "").split(",").map(s => s.trim()).filter(Boolean).map(s => `
          <div class="kds-service-chip">
            <div class="service-chip-icon">${getServiceIcon(s)}</div>
            <span class="service-chip-text">${esc(s)}</span>
          </div>
        `).join("")}
      </div>
    ` : "";

    // KDS Signature Brand Monogram SVG (for reference look when no logo is uploaded)
    const kdsBrandLogoSvg = `
      <div class="kds-brand-monogram">
        <svg viewBox="0 0 54 28" width="54" height="28" fill="none">
          <path d="M4 3 V25 H10 V3 Z" fill="#0080FF"/>
          <path d="M10 14 L21 3 H29 L16 15 L30 25 H22 L11 15 Z" fill="#FF5500"/>
          <text x="32" y="21" font-family="'Outfit', sans-serif" font-weight="800" font-size="18" fill="#ffffff" letter-spacing="0.5">DS</text>
        </svg>
      </div>`;

    // Preview Mode Switcher Bar (lets user preview both exact cards from reference image)
    const previewSwitcherHtml = isPreviewDemo ? `
      <div class="kds-demo-switcher-bar">
        <span class="demo-switcher-label">PREVIEW DESIGN:</span>
        <div class="demo-switcher-pills">
          <button type="button" class="demo-pill ${isPersonal ? "active" : ""}" onclick="window.location.search = '?preview=demo&template=personal'">
            ${SVG_ICONS.user}
            <span>Personal Card</span>
          </button>
          <button type="button" class="demo-pill ${!isPersonal ? "active" : ""}" onclick="window.location.search = '?preview=demo&template=business'">
            ${SVG_ICONS.briefcase}
            <span>Personal + Business</span>
          </button>
        </div>
      </div>
    ` : "";

    // Trust Features Banner underneath both cards (matching bottom row in reference image)
    const trustBannerHtml = `
      <div class="kds-trust-banner">
        <div class="trust-item">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
          <span>Mobile Friendly</span>
        </div>
        <div class="trust-item">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Secure & Reliable</span>
        </div>
        <div class="trust-item">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83m13.79-4l-5.74 9.94"/></svg>
          <span>Premium Design</span>
        </div>
        <div class="trust-item">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>Fast Loading</span>
        </div>
        <div class="trust-item">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
          <span>Powered by Supabase</span>
        </div>
        <div class="trust-item">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
          <span>GitHub Pages</span>
        </div>
      </div>
    `;

    // Render Template HTML
    let cardContentHtml = "";

    if (isBusinessProfile) {
      const businessActions = [];
      if (c.businessPhone) businessActions.push(`<a class="kds-action-box" href="tel:${esc(c.businessPhone)}"><div class="action-box-icon">${SVG_ICONS.call}</div><span class="action-box-label">Call</span></a>`);
      if (waClean) businessActions.push(`<a class="kds-action-box" href="https://wa.me/${waClean}" target="_blank" rel="noopener noreferrer"><div class="action-box-icon">${SVG_ICONS.whatsapp}</div><span class="action-box-label">WhatsApp</span></a>`);
      if (c.businessEmail) businessActions.push(`<a class="kds-action-box" href="mailto:${esc(c.businessEmail)}"><div class="action-box-icon">${SVG_ICONS.email}</div><span class="action-box-label">Email</span></a>`);
      if (websiteClean) businessActions.push(`<a class="kds-action-box" href="${esc(websiteClean)}" target="_blank" rel="noopener noreferrer"><div class="action-box-icon">${SVG_ICONS.website}</div><span class="action-box-label">Website</span></a>`);
      if (c.businessAddress) businessActions.push(`<a class="kds-action-box" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.businessAddress)}" target="_blank" rel="noopener noreferrer"><div class="action-box-icon">${SVG_ICONS.location}</div><span class="action-box-label">Location</span></a>`);

      const personalUrl = getCardFullUrl(c, "personal");
      cardContentHtml = `
        <article class="kds-card kds-business-card-layout kds-company-profile-layout" id="clientProfileCard">
          <div class="kds-biz-top-header">
            <div class="kds-biz-brand-flex">
              ${logoClean ? `<img class="kds-biz-top-logo" src="${esc(logoClean)}" alt="${esc(c.company || "Company Logo")}">` : kdsBrandLogoSvg}
              <div class="kds-biz-brand-copy">
                <div class="biz-company-name">${esc(c.company || "Company")}</div>
                <div class="biz-company-motto">${esc(c.tagline || "")}</div>
              </div>
            </div>
            <div class="kds-pill-type-badge">${SVG_ICONS.briefcase}<span>Business Profile</span></div>
          </div>

          <div class="kds-biz-hero-card company-profile-hero">
            <div class="biz-hero-bg-photo" style="background-image: url('${esc(coverUrl)}');"></div>
            <div class="biz-hero-gradient-overlay"></div>
            <div class="biz-hero-inner-content company-profile-hero-inner">
              <div class="biz-hero-avatar-wrap">
                <div class="kds-avatar-halo small">
                  ${logoClean ? `<img class="kds-avatar-img" src="${esc(logoClean)}" alt="${esc(c.company || "Company")}">` : kdsBrandLogoSvg}
                </div>
              </div>
              <div class="biz-hero-meta-wrap">
                <h1 class="biz-hero-founder-name">${esc(c.company || "Company")}</h1>
                <div class="biz-hero-slogan">${esc(c.tagline || "")}</div>
                <p class="company-profile-bio">${esc(c.businessBio || "")}</p>
              </div>
            </div>
          </div>

          ${servicesChipsHtml}

          <div class="kds-action-grid grid-5">
            ${businessActions.join("")}
            <button class="kds-action-box" id="quickShareBtn" type="button"><div class="action-box-icon">${SVG_ICONS.share}</div><span class="action-box-label">Share</span></button>
          </div>

          <div class="kds-social-row company-social-row">${socialsHtml ? socialsHtml.replace('<div class="kds-social-row">','').replace('</div>','') : ""}</div>

          <div class="kds-cta-container">
            <a class="kds-glowing-cta-btn company-profile-link-btn" href="${esc(personalUrl)}">
              <div class="cta-icon-circle">${SVG_ICONS.user}</div>
              <div class="cta-text-group"><span class="cta-main-label">Personal Profile</span><span class="cta-sub-label">${esc(c.name)}</span></div>
            </a>
          </div>

          <div class="kds-qr-connect-box company-qr-bottom">
            <div class="kds-qr-square-frame"><div id="clientQrCanvas"></div></div>
            <div class="kds-qr-meta">
              <h3 class="kds-qr-heading">Scan to Connect</h3>
              <p class="kds-qr-description">View our company profile and contact details.</p>
              <div class="kds-qr-actions-row">
                <button class="kds-glass-pill-btn" id="downloadQr" type="button">${SVG_ICONS.download}<span>Download QR</span></button>
                <button class="kds-glass-pill-btn" id="shareCard" type="button">${SVG_ICONS.share}<span>Share Profile</span></button>
              </div>
            </div>
          </div>

          <div class="kds-card-bottom-motto"><svg class="motto-wave" viewBox="0 0 400 40" preserveAspectRatio="none"><path d="M0,30 Q200,5 400,30 L400,40 L0,40 Z" fill="rgba(14, 165, 233, 0.2)"/></svg><div class="motto-text">BUSINESS &nbsp; • &nbsp; CONNECT &nbsp; • &nbsp; GROW</div></div>
        </article>
      `;
    } else if (isPersonal) {
      // ==========================================
      // TEMPLATE 1: PERSONAL CARD (Reference Left)
      // ==========================================
      const personalActions = [];
      if (c.phone) {
        personalActions.push(`
          <a class="kds-action-box" href="tel:${esc(c.phone)}">
            <div class="action-box-icon">${SVG_ICONS.call}</div>
            <span class="action-box-label">Call</span>
          </a>
        `);
      }
      if (waClean) {
        personalActions.push(`
          <a class="kds-action-box" href="https://wa.me/${waClean}" target="_blank" rel="noopener noreferrer">
            <div class="action-box-icon">${SVG_ICONS.whatsapp}</div>
            <span class="action-box-label">WhatsApp</span>
          </a>
        `);
      }
      if (c.email) {
        personalActions.push(`
          <a class="kds-action-box" href="mailto:${esc(c.email)}">
            <div class="action-box-icon">${SVG_ICONS.email}</div>
            <span class="action-box-label">Email</span>
          </a>
        `);
      }
      if (websiteClean) {
        personalActions.push(`
          <a class="kds-action-box" href="${esc(websiteClean)}" target="_blank" rel="noopener noreferrer">
            <div class="action-box-icon">${SVG_ICONS.website}</div>
            <span class="action-box-label">Website</span>
          </a>
        `);
      } else {
        personalActions.push(`
          <button class="kds-action-box" id="quickShareBtn" type="button">
            <div class="action-box-icon">${SVG_ICONS.share}</div>
            <span class="action-box-label">Share</span>
          </button>
        `);
      }

      cardContentHtml = `
        <article class="kds-card kds-personal-card-layout" id="clientProfileCard">
          <!-- Fluid Abstract Wave Background -->
          <div class="kds-fluid-waves" aria-hidden="true">
            <svg viewBox="0 0 500 240" preserveAspectRatio="none">
              <path d="M-20,90 Q120,10 260,80 T520,30 L520,0 L-20,0 Z" fill="rgba(14, 165, 233, 0.16)"/>
              <path d="M-20,130 Q160,30 300,110 T520,60 L520,0 L-20,0 Z" fill="rgba(2, 132, 199, 0.22)"/>
              <path d="M-20,170 Q140,70 340,140 T520,100 L520,0 L-20,0 Z" fill="rgba(3, 105, 161, 0.18)"/>
            </svg>
          </div>

          ${isCombinedPersonal ? "" : `          <!-- Top Row: Good Vibes Only + Personal Badge -->
          <div class="kds-top-bar">
            <div class="kds-vibes-tag">
              <span class="vibes-script">Good Vibes Only</span>
              <svg class="vibes-line" viewBox="0 0 110 14" fill="none">
                <path d="M4 9 Q 55 1, 106 8" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
                <path d="M16 12 Q 60 5, 94 11" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
              </svg>
            </div>
            <div class="kds-pill-type-badge">
              ${SVG_ICONS.user}
              <span>Personal</span>
            </div>
          </div>`}

          <!-- Centered Glowing Avatar -->
          <div class="kds-avatar-area">
            <div class="kds-avatar-halo">
              <img class="kds-avatar-img" src="${esc(photo)}" alt="${esc(c.name)}">
              <div class="kds-avatar-online-dot" title="Active"></div>
            </div>
          </div>

          <!-- Name, Title, Glowing Jewel Divider & Bio -->
          <div class="kds-profile-header">
            <h1 class="kds-name-title">${esc(c.name)}</h1>
            <div class="kds-designation-title">${esc(c.designation || "Digital Marketer | Graphic Designer")}</div>
            ${c.company ? `<div class="kds-company-name-under-designation">${esc(c.company)}</div>` : ""}

            <div class="kds-jewel-divider">
              <span class="jewel-line"></span>
              <span class="jewel-dot"></span>
              <span class="jewel-line"></span>
            </div>

            <p class="kds-bio-text">
              ${esc(c.bio || "I help businesses grow through digital marketing, creative design and modern strategies. Passionate about innovation, creativity and results.")}
            </p>
          </div>

          ${isCombinedPersonal ? "" : personalServicesChipsHtml}

          <!-- 4-Pack Action Grid: Call / WhatsApp / Email / Website -->
          <div class="kds-action-grid grid-4">
            ${personalActions.join("")}
          </div>

          <!-- Glowing Blue Save Contact CTA -->
          <div class="kds-cta-container">
            <button class="kds-glowing-cta-btn" id="saveContactMain" type="button">
              <div class="cta-icon-circle">
                ${SVG_ICONS.download}
              </div>
              <div class="cta-text-group">
                <span class="cta-main-label">Save Contact</span>
                <span class="cta-sub-label">Add to your phone</span>
              </div>
            </button>
          </div>

          <!-- Social Media -->
          <div class="kds-personal-socials">
            ${socialsHtml}
          </div>

          <!-- Business Profile Link -->
          ${c.template === "business" ? `<div class="kds-cta-container kds-business-profile-link-wrap"><a class="kds-glowing-cta-btn" href="${esc(businessProfileUrl)}"><div class="cta-icon-circle">${SVG_ICONS.briefcase}</div><div class="cta-text-group"><span class="cta-main-label">Business Profile</span><span class="cta-sub-label">${esc(c.company || "View Company Profile")}</span></div></a></div>` : ""}

          <!-- QR Code & Share Box -->
          <div class="kds-qr-connect-box">
            <div class="kds-qr-square-frame">
              <div id="clientQrCanvas"></div>
            </div>
            <div class="kds-qr-meta">
              <h3 class="kds-qr-heading">Scan to Connect</h3>
              <p class="kds-qr-description">Save my contact, visit my social media and more.</p>
              <div class="kds-qr-actions-row">
                <button class="kds-glass-pill-btn" id="downloadQr" type="button">
                  ${SVG_ICONS.download}
                  <span>Download QR</span>
                </button>
                <button class="kds-glass-pill-btn" id="shareCard" type="button">
                  ${SVG_ICONS.share}
                  <span>Share Card</span>
                </button>
              </div>
            </div>
          </div>

          ${isCombinedPersonal ? "" : `          <!-- Bottom Footer Motto -->
          <div class="kds-card-bottom-motto">
            <svg class="motto-wave" viewBox="0 0 400 40" preserveAspectRatio="none">
              <path d="M0,30 Q200,5 400,30 L400,40 L0,40 Z" fill="rgba(14, 165, 233, 0.2)"/>
            </svg>
            <div class="motto-text">CONNECT &nbsp; • &nbsp; COLLABORATE &nbsp; • &nbsp; GROW</div>
          </div>`}
          <!-- Bottom Footer Motto: shown on every card -->
          <div class="kds-card-bottom-motto">
            <svg class="motto-wave" viewBox="0 0 400 40" preserveAspectRatio="none">
              <path d="M0,30 Q200,5 400,30 L400,40 L0,40 Z" fill="rgba(14, 165, 233, 0.2)"/>
            </svg>
            <div class="motto-text">CONNECT &nbsp; • &nbsp; COLLABORATE &nbsp; • &nbsp; GROW</div>
          </div>

        </article>
      `;
    } else {
      // ==========================================================
      // TEMPLATE 2: PERSONAL + BUSINESS PROFILE
      // Simple, commercial business presentation
      // ==========================================================
      const businessPhone = c.businessPhone || c.phone || "";
      const businessWhatsapp = c.businessWhatsapp || c.whatsapp || "";
      const businessEmail = c.businessEmail || c.email || "";
      const businessAddress = c.businessAddress || c.location || "";
      const businessWebsite = sanitizeUrl(c.businessWebsite || c.website || "");
      const businessName = c.company || "Business Profile";
      const businessTagline = c.tagline || "";
      const businessBio = c.businessBio || "";
      const businessLogo = sanitizeUrl(c.companyLogo || "");

      const businessWhatsappClean = normalizeWhatsAppNumber(businessWhatsapp);
      const businessSocialItems = [
        ["facebook", c.businessFacebook, "Facebook"],
        ["instagram", c.businessInstagram, "Instagram"],
        ["linkedin", c.businessLinkedin, "LinkedIn"],
        ["youtube", c.businessYoutube, "YouTube"],
        ["tiktok", c.businessTiktok, "TikTok"]
      ].filter(([, url]) => url).map(([key, url, label]) => {
        const safe = sanitizeUrl(url);
        if (!safe) return "";
        return `<a class="kds-social-icon-link" href="${esc(safe)}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${SVG_ICONS[key] || SVG_ICONS.share}</a>`;
      }).join("");

      const businessServices = String(c.businessServices || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      const businessActions = [];
      if (businessPhone) {
        businessActions.push(`
          <a class="kds-action-box" href="tel:${esc(businessPhone)}">
            <div class="action-box-icon">${SVG_ICONS.call}</div>
            <span class="action-box-label">Call</span>
          </a>
        `);
      }
      if (businessWhatsappClean) {
        businessActions.push(`
          <a class="kds-action-box" href="https://wa.me/${businessWhatsappClean}" target="_blank" rel="noopener noreferrer">
            <div class="action-box-icon">${SVG_ICONS.whatsapp}</div>
            <span class="action-box-label">WhatsApp</span>
          </a>
        `);
      }
      if (businessEmail) {
        businessActions.push(`
          <a class="kds-action-box" href="mailto:${esc(businessEmail)}">
            <div class="action-box-icon">${SVG_ICONS.email}</div>
            <span class="action-box-label">Email</span>
          </a>
        `);
      }
      if (businessWebsite) {
        businessActions.push(`
          <a class="kds-action-box" href="${esc(businessWebsite)}" target="_blank" rel="noopener noreferrer">
            <div class="action-box-icon">${SVG_ICONS.website}</div>
            <span class="action-box-label">Website</span>
          </a>
        `);
      }

      const businessMapUrl = businessAddress
        ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(businessAddress)
        : "";

      cardContentHtml = `
        <article class="kds-card kds-business-card-layout" id="clientProfileCard">
          <div class="kds-biz-top-header">
            <div class="kds-biz-brand-flex">
              ${businessLogo
                ? `<img class="kds-biz-top-logo" src="${esc(businessLogo)}" alt="${esc(businessName)}">`
                : kdsBrandLogoSvg}
              <div class="kds-biz-brand-copy">
                <div class="biz-company-name">${esc(businessName)}</div>
                ${businessTagline ? `<div class="biz-company-motto">${esc(businessTagline)}</div>` : ""}
              </div>
            </div>
            <div class="kds-pill-type-badge">
              ${SVG_ICONS.briefcase}
              <span>Business Profile</span>
            </div>
          </div>

          <div class="kds-biz-details-container">
            <div class="biz-details-header">
              <div class="biz-circle-logo-badge">
                ${businessLogo
                  ? `<img src="${esc(businessLogo)}" alt="${esc(businessName)}">`
                  : kdsBrandLogoSvg}
              </div>
              <div class="biz-header-text">
                <h1 class="biz-panel-title">${esc(businessName)}</h1>
                ${businessTagline ? `<div class="biz-panel-slogan">${esc(businessTagline)}</div>` : ""}
              </div>
            </div>

            ${businessBio ? `
              <div class="kds-biz-description">
                <p>${esc(businessBio)}</p>
              </div>
            ` : ""}

            <div class="biz-contact-rows">
              ${businessActions.length ? `
                <div class="kds-action-grid grid-${Math.min(4, Math.max(1, businessActions.length))}">
                  ${businessActions.join("")}
                </div>
              ` : ""}

              ${businessAddress ? `
                <a class="biz-contact-row" href="${esc(businessMapUrl)}" target="_blank" rel="noopener noreferrer">
                  <div class="biz-contact-icon-circle">${SVG_ICONS.location}</div>
                  <div class="biz-contact-text-pair">
                    <span class="contact-value">${esc(businessAddress)}</span>
                    <span class="contact-label">Google Maps</span>
                  </div>
                </a>
              ` : ""}
            </div>

            ${businessSocialItems ? `
              <div class="kds-personal-socials kds-business-socials">
                ${businessSocialItems}
              </div>
            ` : ""}

            ${businessServices.length ? `
              <div class="kds-business-services-section">
                <div class="kds-section-label">Services</div>
                <div class="kds-services-chips">
                  ${businessServices.map((service) => `<span class="kds-service-chip">${esc(service)}</span>`).join("")}
                </div>
              </div>
            ` : ""}
          </div>

          <div class="kds-cta-container kds-business-profile-link-wrap">
            <a class="kds-glowing-cta-btn" href="${esc(personalProfileUrl)}">
              <div class="cta-icon-circle">${SVG_ICONS.user}</div>
              <div class="cta-text-group">
                <span class="cta-main-label">Personal Profile</span>
                <span class="cta-sub-label">${esc(c.name || "View Personal Profile")}</span>
              </div>
            </a>
          </div>

          <div class="kds-qr-connect-box">
            <div class="kds-qr-square-frame">
              <div id="clientQrCanvas"></div>
            </div>
            <div class="kds-qr-meta">
              <h3 class="kds-qr-heading">Scan to Connect</h3>
              <p class="kds-qr-description">Visit our Business Profile and connect with us.</p>
              <div class="kds-qr-actions-row">
                <button class="kds-glass-pill-btn" id="downloadQr" type="button">
                  ${SVG_ICONS.download}
                  <span>Download QR</span>
                </button>
                <button class="kds-glass-pill-btn" id="shareCard" type="button">
                  ${SVG_ICONS.share}
                  <span>Share Profile</span>
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
    }

    // Wrap the card and bottom trust banner
    root.innerHTML = `
      <div class="kds-ref-wrapper">
        ${previewSwitcherHtml}
        ${cardContentHtml}
        ${trustBannerHtml}
      </div>
    `;

    // Attach Interactive Event Listeners
    const save = () => downloadContact(c);
    const saveMainBtn = qs("#saveContactMain");
    if (saveMainBtn) saveMainBtn.onclick = save;

    const shareHandler = async () => {
      const shareData = {
        title: (isBusinessProfile ? (c.company || "Business Profile") : c.name) + " - Digital Visiting Card",
        text: isBusinessProfile ? (c.company || "Business Profile") + " Company Profile" : (c.name + (c.designation ? ` (${c.designation})` : "") + " Digital Visiting Card"),
        url: profileFullUrl
      };
      try {
        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
          await navigator.share(shareData);
        } else {
          throw new Error("Native share unavailable");
        }
      } catch (e) {
        if (e && e.name !== "AbortError") {
          try {
            await navigator.clipboard.writeText(profileFullUrl);
            alert("Digital card link copied to clipboard:\n" + fullCardUrl);
          } catch (err) {
            prompt("Digital card link:", profileFullUrl);
          }
        }
      }
    };

    const shareBtn = qs("#shareCard");
    if (shareBtn) shareBtn.onclick = shareHandler;

    const quickShareBtn = qs("#quickShareBtn");
    if (quickShareBtn) quickShareBtn.onclick = shareHandler;

    // Client-side QR Code Generation using local qrcode.min.js
    const qrContainer = qs("#clientQrCanvas");
    if (qrContainer) {
      qrContainer.innerHTML = "";
      const qrPixelSize = isBusinessProfile ? 160 : 128;
      if (typeof QRCode !== "undefined") {
        new QRCode(qrContainer, {
          text: profileFullUrl,
          width: qrPixelSize,
          height: qrPixelSize,
          colorDark: "#050b18",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      } else {
        qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=${qrPixelSize}x${qrPixelSize}&margin=2&data=${encodeURIComponent(fullCardUrl)}" width="${qrPixelSize}" height="${qrPixelSize}" alt="QR Code">`;
      }
    }

    // QR Download Handler
    const downloadQrBtn = qs("#downloadQr");
    const handleQrDownload = () => {
      const canvas = qs("#clientQrCanvas canvas");
      if (canvas) {
        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = slugify(isBusinessProfile ? (c.company || c.name) : c.name) + "-QR.png";
        a.click();
      } else {
        const img = qs("#clientQrCanvas img");
        if (img && img.src) {
          const a = document.createElement("a");
          a.href = img.src;
          a.download = slugify(c.name) + "-QR.png";
          a.click();
        }
      }
    };
    if (downloadQrBtn) downloadQrBtn.onclick = handleQrDownload;

    // In business card, clicking the QR box prompts download or share
    const heroQrBox = qs("#heroQrBox");
    if (heroQrBox) {
      heroQrBox.onclick = () => {
        if (confirm("Download QR code image for " + c.name + "?")) {
          handleQrDownload();
        }
      };
    }

  } catch (e) {
    console.error("renderCard error:", e);
    root.innerHTML = `
      <div class="kds-ref-wrapper">
        <section class="card-status-box error">
          <div class="status-box-icon">⚠️</div>
          <h2>Card Load করতে সমস্যা হয়েছে</h2>
          <p>দয়া করে কিছুক্ষণ পরে আবার চেষ্টা করুন অথবা ইন্টারনেট সংযোগ পরীক্ষা করুন।</p>
          <div class="status-box-actions">
            <a class="btn-save-contact" href="javascript:location.reload()">Reload Card</a>
            <a class="btn-secondary" href="./index.html">Back to Home</a>
          </div>
        </section>
      </div>`;
  }
}
