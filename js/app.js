const STORE_KEY = "kds_client_cards_v1";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEMO_CLIENT = {
  id: "demo",
  slug: "demo-kds-digital-card",
  businessSlug: "demo-kds-business-card",
  template: "personal_business",
  name: "Shofikul Islam Samim",
  designation: "Owner & CEO",
  phone: "+880 1744 188460",
  whatsapp: "+880 1744 188460",
  email: "samim.khanmiyaa@gmail.com",
  location: "Dhaka, Bangladesh",
  bio: "Helping ambitious businesses grow through Digital Marketing, Creative Brand Design, Video Production, Web Engineering & IT Solutions.",
  photo: "https://xxsoybtxdqcdfkwgmktr.supabase.co/storage/v1/object/public/card-assets/uploads/1790152910652_yrigjm.jpg",
  cover: "https://xxsoybtxdqcdfkwgmktr.supabase.co/storage/v1/object/public/card-assets/uploads/1790152937435_suuyip.png",
  businessCover: "https://xxsoybtxdqcdfkwgmktr.supabase.co/storage/v1/object/public/card-assets/uploads/1790152937435_suuyip.png",
  company: "Khan Digital Solution",
  companyRole: "Founder & Managing Director",
  companyLogo: "",
  tagline: "Your Growth, Our Mission",
  website: "https://khandigitalsolution.com",
  services: "Digital Marketing, Brand Identity, UI/UX Design, Web Development, Business Automation",
  facebook: "https://www.facebook.com/shofikulislamsamim.bd",
  instagram: "https://www.instagram.com/shofikulislamsamim.bd",
  linkedin: "https://bd.linkedin.com/in/shofikulislamsamim",
  youtube: "https://www.youtube.com/@shofikulislamsamim",
  tiktok: "https://www.tiktok.com/@shofikulislamsamim",
  businessBio: "Khan Digital Solution is a full-service digital identity and growth agency delivering high-impact marketing campaigns, modern web platforms, and creative brand systems.",
  businessPhone: "+880 1744 188460",
  businessWhatsapp: "+880 1744 188460",
  businessEmail: "samim.khanmiyaa@gmail.com",
  businessAddressText: "Gulshan Avenue, Dhaka 1212, Bangladesh",
  businessAddress: "https://maps.google.com/?q=Gulshan+Avenue,Dhaka,Bangladesh",
  businessWebsite: "https://khandigitalsolution.com",
  businessServices: JSON.stringify([
    {
      name: "Performance Digital Marketing",
      description: "Data-driven social advertising, search campaigns, and conversion funnels built for measurable ROI."
    },
    {
      name: "Brand Identity & Visual Design",
      description: "Distinctive logo systems, brand guidelines, and executive communication assets."
    },
    {
      name: "Web & Digital Product Engineering",
      description: "Fast, mobile-first corporate websites, landing pages, and custom web applications."
    },
    {
      name: "Video Production & Motion Graphics",
      description: "High-retention commercial edits, promotional reels, and brand storytelling."
    }
  ]),
  businessFacebook: "https://www.facebook.com/shofikulislamsamim.bd",
  businessInstagram: "https://www.instagram.com/shofikulislamsamim.bd",
  businessLinkedin: "https://bd.linkedin.com/in/shofikulislamsamim",
  businessYoutube: "https://www.youtube.com/@shofikulislamsamim",
  businessTiktok: "https://www.tiktok.com/@shofikulislamsamim",
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

function getInitials(name, fallback = "KD") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function normalizeWhatsAppNumber(num) {
  if (!num) return "";
  let clean = String(num).trim().replace(/[^\d+]/g, "");
  if (!clean) return "";
  if (clean.startsWith("+")) {
    clean = clean.slice(1);
  }
  if (clean.startsWith("00")) {
    clean = clean.slice(2);
  }
  if (/^01[3-9]\d{8}$/.test(clean)) {
    // Bangladesh mobile number (01XXXXXXXXX) -> 8801XXXXXXXXX
    clean = "880" + clean.slice(1);
  } else if (/^1[3-9]\d{8}$/.test(clean)) {
    clean = "880" + clean;
  }
  return clean;
}

function formatDialNumber(num) {
  if (!num) return "";
  const raw = String(num).trim();
  const clean = raw.replace(/[^\d+]/g, "");
  if (!clean) return "";
  if (/^01[3-9]\d{8}$/.test(clean)) {
    return "+880" + clean.slice(1);
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

function getCardFullUrl(clientOrId, profile) {
  const resolvedProfile =
    profile ||
    (clientOrId && typeof clientOrId === "object" && clientOrId.template === "business_only"
      ? "business"
      : "personal");
  const rel = cardUrl(clientOrId) + (resolvedProfile === "business" ? "&profile=business" : "");
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
    template:
      c.template === "business"
        ? "personal_business"
        : ["personal", "personal_business", "business_only"].includes(c.template)
        ? c.template
        : "personal",
    name: c.full_name || c.name || "",
    designation: c.designation || "",
    phone: c.phone || "",
    whatsapp: c.whatsapp || "",
    email: c.email || "",
    location: c.address || c.location || "",
    bio: c.bio || "",
    photo: c.profile_image_url || c.photo || "",
    cover: c.cover_image_url || c.cover || "",
    businessCover: c.business_cover_image_url || c.businessCover || "",
    company: c.company_name || c.company || "",
    companyRole: c.company_role || c.companyRole || "",
    companyLogo: c.company_logo_url || c.companyLogo || "",
    website: c.website || "",
    tagline: c.company_tagline || c.tagline || "",
    services: Array.isArray(c.services) ? c.services.join(", ") : c.services || "",
    facebook: c.social_links?.facebook || c.facebook || "",
    instagram: c.social_links?.instagram || c.instagram || "",
    linkedin: c.social_links?.linkedin || c.linkedin || "",
    youtube: c.social_links?.youtube || c.youtube || "",
    tiktok: c.social_links?.tiktok || c.tiktok || "",
    subscriptionActive:
      c.subscription_active !== undefined
        ? !!c.subscription_active
        : c.subscriptionActive !== undefined
        ? !!c.subscriptionActive
        : true,
    subscriptionStart: c.subscription_start || c.subscriptionStart || null,
    subscriptionEnd: c.subscription_end || c.subscriptionEnd || null,
    businessSlug: c.business_slug || c.businessSlug || "",
    businessBio: c.business_bio || c.businessBio || "",
    businessPhone: c.business_phone || c.businessPhone || "",
    businessWhatsapp: c.business_whatsapp || c.businessWhatsapp || "",
    businessEmail: c.business_email || c.businessEmail || "",
    businessAddressText: c.business_address_text || c.businessAddressText || "",
    businessAddress: c.business_address || c.businessAddress || "",
    businessWebsite: c.business_website || c.businessWebsite || c.website || "",
    businessServices: Array.isArray(c.business_services)
      ? JSON.stringify(c.business_services)
      : c.business_services || c.businessServices || "",
    businessFacebook: c.business_social_links?.facebook || c.businessFacebook || "",
    businessInstagram: c.business_social_links?.instagram || c.businessInstagram || "",
    businessLinkedin: c.business_social_links?.linkedin || c.businessLinkedin || "",
    businessYoutube: c.business_social_links?.youtube || c.businessYoutube || "",
    businessTiktok: c.business_social_links?.tiktok || c.businessTiktok || ""
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
    business_cover_image_url: c.businessCover || null,
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
    business_slug:
      c.businessSlug ||
      (["personal_business", "business_only"].includes(c.template)
        ? slugify(c.company || c.name) + "-business"
        : null),
    business_bio: c.businessBio || null,
    business_phone: c.businessPhone || null,
    business_whatsapp: c.businessWhatsapp || null,
    business_email: c.businessEmail || null,
    business_address_text: c.businessAddressText || null,
    business_address: c.businessAddress || null,
    business_website: c.businessWebsite || null,
    business_services: (() => {
      const raw = String(c.businessServices || "").trim();
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return raw
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ name, description: "" }));
      }
    })(),
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

async function getClientForAdmin(identifier) {
  if (!identifier) return null;
  const idStr = String(identifier).trim();

  const cached = getLocalCache().find(
    (item) => item.id === idStr || item.slug === idStr || item.businessSlug === idStr
  );

  try {
    if (window.supabaseClient) {
      let query = supabaseClient.from("client_cards").select("*");
      if (UUID_REGEX.test(idStr)) {
        query = query.eq("id", idStr);
      } else {
        query = query.or(`slug.eq.${idStr},business_slug.eq.${idStr}`);
      }
      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        return dbToClient(data);
      }
    }
  } catch (e) {
    console.warn("Admin client lookup fallback:", e);
  }

  return cached || null;
}

async function getClient(identifier) {
  if (!identifier) return null;
  const idStr = String(identifier).trim();
  if (idStr === "demo" || idStr === "demo-kds-digital-card" || idStr === "demo-kds-business-card") {
    return { ...DEMO_CLIENT };
  }

  let publicLookupFoundNothing = false;

  try {
    if (window.supabaseClient) {
      let query = supabaseClient.from("public_client_cards").select("*");

      if (UUID_REGEX.test(idStr)) {
        query = query.eq("id", idStr);
      } else {
        query = query.or(`slug.eq.${idStr},business_slug.eq.${idStr}`);
      }

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        return dbToClient(data);
      }
      if (!error && !data) {
        publicLookupFoundNothing = true;
      }
      if (error) console.warn("Supabase getClient query error:", error);

      // If not found in public_client_cards, check if an authenticated admin session
      // exists so inactive/expired cards show their proper Subscription Unavailable state.
      const { data: sessionData } = await supabaseClient.auth.getSession();
      if (sessionData?.session) {
        const adminRecord = await getClientForAdmin(idStr);
        if (adminRecord) return adminRecord;
      }
    }
  } catch (e) {
    console.warn("Supabase error in getClient:", e);
  }

  // Fallback to local cache if this browser has subscription state metadata for the card
  const localMatch = getLocalCache().find(
    (item) => item.id === idStr || item.slug === idStr || item.businessSlug === idStr
  );
  if (localMatch) {
    const mapped = dbToClient(localMatch);
    if (publicLookupFoundNothing && mapped) {
      mapped.subscriptionActive = false;
    }
    return mapped;
  }

  return null;
}

async function saveClient(c) {
  const payload = clientToDb(c);
  const isNewCard = !c.id;
  const targetId = c.id || (crypto.randomUUID ? crypto.randomUUID() : "c_" + Date.now());
  payload.id = targetId;

  if (isNewCard) {
    const uniqueToken = String(targetId).replace(/[^a-zA-Z0-9]/g, "").slice(-12).toLowerCase() || String(Date.now());
    const baseSlug = slugify(c.name || c.company || "client");
    payload.slug = `${baseSlug}-${uniqueToken}`;

    if (payload.business_slug) {
      const businessBase = slugify(c.company || c.name || "business");
      payload.business_slug = `${businessBase}-${uniqueToken}-business`;
    }
  }

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

      if (
        res.error &&
        (res.error.code === "PGRST204" ||
          res.error.code === "42703" ||
          String(res.error.message).includes("company_role"))
      ) {
        console.warn("Retrying save without company_role column:", res.error.message);
        const fallbackPayload = { ...payload };
        delete fallbackPayload.company_role;
        res = await runSave(fallbackPayload);
      }

      if (res.error) throw res.error;
      savedRecord = { ...c, id: targetId, slug: payload.slug, businessSlug: payload.business_slug };
    }
  } catch (err) {
    console.error("Supabase saveClient error:", err);
    throw err;
  }

  if (!savedRecord) {
    savedRecord = { ...c, id: targetId, slug: payload.slug, businessSlug: payload.business_slug };
  }

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
      .select("profile_image_url,cover_image_url,business_cover_image_url,company_logo_url")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw fetchError;

    const assetUrls = [
      client?.profile_image_url,
      client?.cover_image_url,
      client?.business_cover_image_url,
      client?.company_logo_url
    ]
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

const SUBSCRIPTION_TIME_ZONE = "Asia/Dhaka";

function subscriptionState(c) {
  if (!c || c.subscriptionActive === false) {
    return { status: "inactive", label: "Inactive" };
  }

  if (c.subscriptionEnd) {
    const end = new Date(c.subscriptionEnd);
    if (Number.isNaN(end.getTime()) || end.getTime() <= Date.now()) {
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
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SUBSCRIPTION_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
}

function formatDate(value) {
  if (!value) return "No expiry";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SUBSCRIPTION_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(d);
}

function addDuration(start, days) {
  const startMs = new Date(start).getTime();
  const numDays = Number(days || 0);
  if (!Number.isFinite(startMs) || !Number.isFinite(numDays)) return new Date(NaN);
  return new Date(startMs + numDays * 24 * 60 * 60 * 1000);
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
  const currentEnd = c.subscriptionEnd ? new Date(c.subscriptionEnd) : null;
  const currentEndMs = currentEnd && !Number.isNaN(currentEnd.getTime()) ? currentEnd.getTime() : 0;

  if (currentEndMs > Date.now()) {
    c.subscriptionEnd = numDays > 0 ? addDuration(c.subscriptionEnd, numDays).toISOString() : null;
  } else {
    c.subscriptionStart = new Date().toISOString();
    c.subscriptionEnd = numDays > 0 ? addDuration(c.subscriptionStart, numDays).toISOString() : null;
  }
  return c;
}

function deactivateSubscription(c) {
  c.subscriptionActive = false;
  return c;
}

function escapeVCardText(val) {
  return String(val || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .trim();
}

function vcard(c, profile = "personal") {
  const isBusiness = profile === "business" || c.template === "business_only";

  const fullName = isBusiness
    ? String(c.company || c.name || "Business Contact").trim()
    : String(c.name || c.company || "Contact").trim();

  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN;CHARSET=UTF-8:" + escapeVCardText(fullName),
    "N;CHARSET=UTF-8:" + escapeVCardText(lastName) + ";" + escapeVCardText(firstName) + ";;;"
  ];

  const primaryPhone = isBusiness
    ? String(c.businessPhone || c.phone || "").trim()
    : String(c.phone || c.businessPhone || "").trim();

  const secondaryWa = isBusiness
    ? String(c.businessWhatsapp || c.whatsapp || "").trim()
    : String(c.whatsapp || c.businessWhatsapp || "").trim();

  const normPrimary = normalizeWhatsAppNumber(primaryPhone);
  const normSecondary = normalizeWhatsAppNumber(secondaryWa);

  if (primaryPhone) {
    lines.push("TEL;TYPE=CELL,VOICE:" + formatDialNumber(primaryPhone));
  }
  if (secondaryWa && normSecondary && normSecondary !== normPrimary) {
    lines.push("TEL;TYPE=WORK,VOICE:" + formatDialNumber(secondaryWa));
  }

  const email = isBusiness
    ? String(c.businessEmail || c.email || "").trim()
    : String(c.email || c.businessEmail || "").trim();
  if (email) {
    lines.push("EMAIL;TYPE=PREF,INTERNET:" + email);
  }

  const company = String(c.company || "").trim();
  if (company) {
    lines.push("ORG;CHARSET=UTF-8:" + escapeVCardText(company));
  }

  const role = isBusiness
    ? String(c.tagline || c.designation || c.companyRole || "").trim()
    : String(c.designation || c.companyRole || "").trim();
  if (role) {
    lines.push("TITLE;CHARSET=UTF-8:" + escapeVCardText(role));
  }

  const address = isBusiness
    ? String(c.businessAddressText || c.location || "").trim()
    : String(c.location || c.businessAddressText || "").trim();
  if (address) {
    lines.push("ADR;TYPE=WORK;CHARSET=UTF-8:;;" + escapeVCardText(address) + ";;;;");
  }

  const website = isBusiness
    ? sanitizeUrl(c.businessWebsite || c.website)
    : sanitizeUrl(c.website || c.businessWebsite);
  if (website) {
    lines.push("URL:" + website);
  }

  const bio = isBusiness
    ? String(c.businessBio || c.bio || "").trim()
    : String(c.bio || c.businessBio || "").trim();
  if (bio) {
    lines.push("NOTE;CHARSET=UTF-8:" + escapeVCardText(bio));
  }

  const photoUrl = isBusiness
    ? sanitizeUrl(c.companyLogo || c.photo)
    : sanitizeUrl(c.photo || c.companyLogo);
  if (photoUrl && photoUrl.startsWith("https://")) {
    lines.push("PHOTO;VALUE=URI:" + photoUrl);
  }

  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function downloadContact(c, profile = "personal") {
  const isBusiness = profile === "business" || c.template === "business_only";
  const vcfContent = vcard(c, isBusiness ? "business" : "personal");
  const blob = new Blob([vcfContent], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const filenameBase = isBusiness
    ? c.company || c.name || "business-contact"
    : c.name || c.company || "contact";
  a.download = slugify(filenameBase) + ".vcf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showCardToast(message, type = "success") {
  const existing = document.querySelectorAll(".kds-card-toast");
  existing.forEach((el) => el.remove());

  const toast = document.createElement("div");
  toast.className = `kds-card-toast ${type}`;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 260);
  }, 2600);
}

// Crisp recognizable SVG icons across Personal, Business, and Admin views
const SVG_ICONS = {
  call: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.11 4.11 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
  email: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  vcard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  website: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  location: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  briefcase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`,
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
