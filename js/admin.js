const form = qs("#clientForm");
let selectedTemplate = "personal";
let editingClient = null;
let allClients = [];
let isAdminAuthenticated = false;

function escJsAttr(v) {
  return esc(String(v ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
}

// Tracks Storage assets uploaded in the current unsaved form session.
// Each entry is keyed by the corresponding URL/text input selector.
const pendingImageUploads = new Map();

function storagePathFromPublicUrl(url) {
  if (!url) return null;
  try {
    const marker = "/storage/v1/object/public/card-assets/";
    const raw = String(url);
    const index = raw.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(raw.slice(index + marker.length));
    return path && !path.includes("..") ? path : null;
  } catch (_) {
    return null;
  }
}

async function removeCardAsset(url) {
  const path = storagePathFromPublicUrl(url);
  if (!path || !window.supabaseClient) return;
  try {
    const { error } = await supabaseClient.storage.from("card-assets").remove([path]);
    if (error) console.warn("Storage cleanup failed:", error);
  } catch (e) {
    console.warn("Storage cleanup failed:", e);
  }
}

function imageValuesFromClient(c) {
  return [
    c?.photo,
    c?.cover,
    c?.businessCover,
    c?.companyLogo
  ].filter(Boolean);
}

async function cleanupPendingUploads({ keepUrls = [], cleanupOldUrls = [] } = {}) {
  const keep = new Set(keepUrls.filter(Boolean));
  const old = new Set(cleanupOldUrls.filter(Boolean));

  for (const entry of pendingImageUploads.values()) {
    if (entry?.newUrl && !keep.has(entry.newUrl)) {
      await removeCardAsset(entry.newUrl);
    }
  }

  for (const url of old) {
    if (!keep.has(url)) await removeCardAsset(url);
  }

  pendingImageUploads.clear();
}

const ADMIN_ICONS = {
  copy: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  external: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  power: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>`,
  apk: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`
};

/* ==========================================================================
   IN-APP MODAL SYSTEM (REPLACES PROMPT & CONFIRM)
   ========================================================================== */
function openModal({ title, bodyHtml, confirmText = "Confirm", isDanger = false, onConfirm }) {
  const backdrop = qs("#adminModalBackdrop");
  const titleEl = qs("#modalTitle");
  const bodyEl = qs("#modalBody");
  const confirmBtn = qs("#modalConfirmBtn");
  const cancelBtn = qs("#modalCancelBtn");
  const closeBtn = qs("#modalCloseBtn");

  if (!backdrop || !titleEl || !bodyEl || !confirmBtn) return;

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  confirmBtn.textContent = confirmText;

  if (isDanger) {
    confirmBtn.className = "btn-primary-sm modal-btn-danger";
  } else {
    confirmBtn.className = "btn-primary-sm";
  }

  const closeModal = () => {
    backdrop.classList.add("hidden");
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
    closeBtn.onclick = null;
  };

  confirmBtn.onclick = async () => {
    if (typeof onConfirm === "function") {
      const shouldClose = await onConfirm();
      if (shouldClose !== false) closeModal();
    } else {
      closeModal();
    }
  };

  cancelBtn.onclick = closeModal;
  closeBtn.onclick = closeModal;

  backdrop.classList.remove("hidden");
}

function showToast(msg, type = "info") {
  const existing = document.querySelectorAll(".admin-toast");
  existing.forEach((el) => el.remove());

  const toast = document.createElement("div");
  toast.className = `admin-toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showError(msg) {
  console.error(msg);
  const text = msg?.message || String(msg);
  showToast(text, "error");
}

function setTemplate(t) {
  selectedTemplate = ["personal", "personal_business", "business_only"].includes(t) ? t : "personal";
  if (qs("#template")) qs("#template").value = selectedTemplate;
  document.querySelectorAll(".template-pick button").forEach((b) => {
    b.classList.toggle("active", b.dataset.template === selectedTemplate);
  });
  const bf = qs("#businessFields");
  if (bf) bf.classList.toggle("hidden", selectedTemplate === "personal");

  const pf = qs("#personalFields");
  if (pf) pf.classList.toggle("hidden", selectedTemplate === "business_only");

  document.querySelectorAll(".personal-media-field, .personal-social-fields").forEach((el) => {
    el.classList.toggle("hidden", selectedTemplate === "business_only");
  });

  const nameInput = qs("#name");
  const companyInput = qs("#company");
  const personalCompanyInput = qs("#personalCompany");
  if (nameInput) nameInput.required = selectedTemplate !== "business_only";
  if (companyInput) companyInput.required = selectedTemplate !== "personal";
  if (personalCompanyInput) personalCompanyInput.required = false;
}

function parseServices(value) {
  if (Array.isArray(value)) {
    return value.map((item) => ({
      name: String(item?.name || item?.title || "").trim(),
      description: String(item?.description || item?.desc || "").trim()
    })).filter((item) => item.name);
  }

  const raw = String(value || "").trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parseServices(parsed);
  } catch (_) {
    // Backward-compatible fallback for old comma-separated service data.
  }

  return raw.split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name, description: "Professional service" }));
}

function serviceEditorRows(value) {
  const list = parseServices(value);
  return list.length ? list : [{ name: "", description: "" }];
}

function renderServiceEditor(value = "") {
  const editor = qs("#servicesEditor");
  if (!editor) return;

  editor.innerHTML = serviceEditorRows(value).map((service, index) => `
    <div class="service-editor-row" data-service-row>
      <div class="service-editor-fields">
        <label>
          <span class="form-label">Service Name</span>
          <input class="form-input service-name-input" type="text" value="${esc(service.name)}" placeholder="Digital Marketing">
        </label>
        <label>
          <span class="form-label">Service Description</span>
          <textarea class="form-textarea service-description-input" rows="2" placeholder="Facebook Ads, social media management and online growth solutions.">${esc(service.description)}</textarea>
        </label>
      </div>
      <button type="button" class="btn-remove-service" onclick="removeServiceRow(this)" aria-label="Remove service">Remove</button>
    </div>
  `).join("");
}

function addServiceRow() {
  const editor = qs("#servicesEditor");
  if (!editor) return;

  const row = document.createElement("div");
  row.className = "service-editor-row";
  row.setAttribute("data-service-row", "");
  row.innerHTML = `
    <div class="service-editor-fields">
      <label>
        <span class="form-label">Service Name</span>
        <input class="form-input service-name-input" type="text" placeholder="Digital Marketing">
      </label>
      <label>
        <span class="form-label">Service Description</span>
        <textarea class="form-textarea service-description-input" rows="2" placeholder="Describe this service briefly."></textarea>
      </label>
    </div>
    <button type="button" class="btn-remove-service" onclick="removeServiceRow(this)" aria-label="Remove service">Remove</button>
  `;
  editor.appendChild(row);
  row.querySelector(".service-name-input")?.focus();
}

function removeServiceRow(button) {
  const editor = qs("#servicesEditor");
  const row = button?.closest("[data-service-row]");
  if (!editor || !row) return;
  row.remove();
  if (!editor.querySelector("[data-service-row]")) addServiceRow();
}

function collectServices() {
  return Array.from(document.querySelectorAll("#servicesEditor [data-service-row]"))
    .map((row) => ({
      name: row.querySelector(".service-name-input")?.value.trim() || "",
      description: row.querySelector(".service-description-input")?.value.trim() || ""
    }))
    .filter((item) => item.name);
}

function serializeServices() {
  return JSON.stringify(collectServices());
}

function updateImagePreviews() {
  const previewMap = [
    ["#photo", "#photoThumb", "#photoPreviewWrap"],
    ["#cover", "#coverThumb", "#coverPreviewWrap"],
    ["#businessCover", "#businessCoverThumb", "#businessCoverPreviewWrap"],
    ["#companyLogo", "#companyLogoThumb", "#companyLogoPreviewWrap"]
  ];

  previewMap.forEach(([inputSel, thumbSel, wrapSel]) => {
    const input = qs(inputSel);
    const thumb = qs(thumbSel);
    const wrap = qs(wrapSel);
    if (!input || !thumb || !wrap) return;

    const val = input.value.trim();
    if (val) {
      thumb.src = val;
      wrap.classList.remove("hidden");
    } else {
      thumb.src = "";
      wrap.classList.add("hidden");
    }
  });
}

function clearForm() {
  editingClient = null;
  if (form) form.reset();
  if (qs("#clientId")) qs("#clientId").value = "";
  const paramTemplate = new URLSearchParams(location.search).get("template");
  setTemplate(["personal", "personal_business", "business_only"].includes(paramTemplate) ? paramTemplate : "personal");
  if (qs("#formTitle")) qs("#formTitle").textContent = "New Client";
  if (qs("#formSubtitle")) qs("#formSubtitle").textContent = "Fill in the client details to generate a visiting card";
  const previewBtn = qs("#previewCurrentBtn");
  if (previewBtn) {
    previewBtn.classList.add("hidden");
    previewBtn.href = "./card.html?preview=demo";
  }
  if (qs("#duration")) qs("#duration").value = "30";
  if (qs("#customDays")) qs("#customDays").value = "";
  if (qs("#customDaysWrap")) qs("#customDaysWrap").classList.add("hidden");
  // A reset/cancel must not leave newly uploaded unsaved assets in Storage.
  cleanupPendingUploads();
  updateImagePreviews();
  renderServiceEditor("");
  renderSubscriptionFields({ subscriptionActive: true, subscriptionStart: null, subscriptionEnd: null });
}

function fillForm(c) {
  editingClient = c;
  const fields = [
    "clientId",
    "name",
    "designation",
    "personalCompany",
    "phone",
    "whatsapp",
    "email",
    "bio",
    "company",
    "tagline",
    "companyLogo",
    "photo",
    "cover",
    "businessCover",
    "facebook",
    "instagram",
    "linkedin",
    "youtube",
    "tiktok",
    "businessBio",
    "businessPhone",
    "businessWhatsapp",
    "businessEmail",
    "businessAddressText",
    "businessAddress",
    "businessWebsite",
    "businessFacebook",
    "businessInstagram",
    "businessLinkedin",
    "businessYoutube",
    "businessTiktok"
  ];
  fields.forEach((k) => {
    const el = qs("#" + k);
    if (!el) return;
    if (k === "clientId") el.value = c.id;
    else if (k === "businessWebsite") el.value = c.businessWebsite || c.website || "";
    else if (k === "businessCover") el.value = c.businessCover || "";
    else el.value = c[k] || "";
  });
  const personalCompany = qs("#personalCompany");
  if (personalCompany) personalCompany.value = c.company || "";
  setTemplate(c.template || "personal");
  renderServiceEditor(c.businessServices || "");
  const displayName = c.template === "business_only" ? c.company || c.name || "Business" : c.name || "Client";
  if (qs("#formTitle")) qs("#formTitle").textContent = "Edit: " + displayName;
  if (qs("#formSubtitle")) qs("#formSubtitle").textContent = "Update client data and manage subscription";
  const previewBtn = qs("#previewCurrentBtn");
  if (previewBtn) {
    previewBtn.href = c.template === "business_only" ? getCardFullUrl(c, "business") : cardUrl(c);
    previewBtn.classList.remove("hidden");
  }
  updateImagePreviews();
  renderSubscriptionFields(c);
}

function renderSubscriptionFields(c) {
  const s = subscriptionState(c);
  const badge = qs("#subscriptionBadge");
  if (badge) {
    badge.textContent = s.label;
    badge.className = "status-badge " + s.status;
  }
  const startEl = qs("#subscriptionStart");
  if (startEl) startEl.textContent = c.subscriptionStart ? formatDateTime(c.subscriptionStart) : "—";
  const endEl = qs("#subscriptionEnd");
  if (endEl) endEl.textContent = c.subscriptionEnd ? formatDateTime(c.subscriptionEnd) : "No expiry";
  const actBtn = qs("#activateBtn");
  if (actBtn) {
    const labelSpan = actBtn.querySelector("span") || actBtn;
    labelSpan.textContent = s.status === "active" ? "Extend / Renew" : "Activate";
  }
}

const VALIDATION_LIMITS = Object.freeze({
  name: 100,
  designation: 120,
  company: 120,
  tagline: 180,
  bio: 1000,
  address: 300,
  phone: 25,
  email: 254,
  url: 500,
  serviceCount: 12,
  serviceName: 80,
  serviceDescription: 240
});

function normalizePhoneForValidation(value) {
  return String(value || "").trim().replace(/[\s().-]/g, "");
}

function isValidPhone(value) {
  const v = normalizePhoneForValidation(value);
  if (!v) return true;
  return /^\+?[0-9]{7,15}$/.test(v);
}

function isValidEmail(value) {
  const v = String(value || "").trim();
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= VALIDATION_LIMITS.email;
}

function isValidPublicUrl(value) {
  const v = String(value || "").trim();
  if (!v) return true;
  const safe = sanitizeUrl(v);
  if (!safe) return false;
  try {
    const parsed = new URL(safe);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      parsed.username === "" && parsed.password === "" &&
      parsed.hostname.length <= 253;
  } catch (_) {
    return false;
  }
}

function validateTextLength(value, max, label) {
  const v = String(value || "").trim();
  if (v.length > max) return label + " সর্বোচ্চ " + max + " অক্ষরের মধ্যে রাখুন।";
  return "";
}

function validateClientForm(data) {
  const errors = [];
  const requiredName = selectedTemplate !== "business_only";
  const requiredCompany = selectedTemplate !== "personal";

  if (requiredName && !data.name) errors.push("Name দিন।");
  if (requiredCompany && !data.company) errors.push("Company Name দিন।");

  const textFields = [
    ["name", VALIDATION_LIMITS.name, "Name"],
    ["designation", VALIDATION_LIMITS.designation, "Designation"],
    ["company", VALIDATION_LIMITS.company, "Company Name"],
    ["tagline", VALIDATION_LIMITS.tagline, "Tagline"],
    ["bio", VALIDATION_LIMITS.bio, "Bio"],
    ["location", VALIDATION_LIMITS.address, "Address"],
    ["businessBio", VALIDATION_LIMITS.bio, "Business Bio"],
    ["businessAddressText", VALIDATION_LIMITS.address, "Business Address"]
  ];
  textFields.forEach(([key, max, label]) => {
    const err = validateTextLength(data[key], max, label);
    if (err) errors.push(err);
  });

  [
    ["phone", "Phone"],
    ["whatsapp", "WhatsApp"],
    ["businessPhone", "Business Phone"],
    ["businessWhatsapp", "Business WhatsApp"]
  ].forEach(([key, label]) => {
    if (!isValidPhone(data[key])) errors.push(label + " number সঠিক নয়।");
    if (String(data[key] || "").length > VALIDATION_LIMITS.phone) {
      errors.push(label + " সর্বোচ্চ " + VALIDATION_LIMITS.phone + " অক্ষরের মধ্যে রাখুন।");
    }
  });

  [
    ["email", "Email"],
    ["businessEmail", "Business Email"]
  ].forEach(([key, label]) => {
    if (!isValidEmail(data[key])) errors.push(label + " address সঠিক নয়।");
  });

  const urlFields = [
    ["website", "Website"],
    ["businessWebsite", "Business Website"],
    ["businessAddress", "Google Maps Location"],
    ["photo", "Profile Photo"],
    ["cover", "Cover Photo"],
    ["businessCover", "Business Cover Photo"],
    ["companyLogo", "Company Logo"],
    ["facebook", "Facebook"],
    ["instagram", "Instagram"],
    ["linkedin", "LinkedIn"],
    ["youtube", "YouTube"],
    ["tiktok", "TikTok"],
    ["businessFacebook", "Business Facebook"],
    ["businessInstagram", "Business Instagram"],
    ["businessLinkedin", "Business LinkedIn"],
    ["businessYoutube", "Business YouTube"],
    ["businessTiktok", "Business TikTok"]
  ];
  urlFields.forEach(([key, label]) => {
    if (String(data[key] || "").length > VALIDATION_LIMITS.url) {
      errors.push(label + " URL অনেক বড়।");
    } else if (!isValidPublicUrl(data[key])) {
      errors.push(label + " URL সঠিক নয়।");
    }
  });

  const services = collectServices();
  if (services.length > VALIDATION_LIMITS.serviceCount) {
    errors.push("সর্বোচ্চ " + VALIDATION_LIMITS.serviceCount + "টি service রাখা যাবে।");
  }
  const seen = new Set();
  services.forEach((service) => {
    const name = service.name.trim();
    const key = name.toLowerCase();
    if (seen.has(key)) errors.push("একই Service Name একাধিকবার দেওয়া হয়েছে: " + name);
    seen.add(key);
    if (name.length > VALIDATION_LIMITS.serviceName) {
      errors.push("Service Name সর্বোচ্চ " + VALIDATION_LIMITS.serviceName + " অক্ষরের মধ্যে রাখুন।");
    }
    if (service.description.length > VALIDATION_LIMITS.serviceDescription) {
      errors.push("Service Description সর্বোচ্চ " + VALIDATION_LIMITS.serviceDescription + " অক্ষরের মধ্যে রাখুন।");
    }
  });

  if (errors.length) {
    return { ok: false, message: errors.slice(0, 5).join("\n") };
  }
  return { ok: true, message: "" };
}

function selectedDuration() {
  const v = qs("#duration") ? qs("#duration").value : "30";
  if (v === "custom") {
    const n = Number(qs("#customDays")?.value);
    return n > 0 ? n : 0;
  }
  if (v === "none") return 0;
  return Number(v);
}

async function activateCurrent() {
  if (!editingClient) {
    showToast("আগে Client তথ্য Save করুন। তারপর Subscription Activate করুন।", "warn");
    return;
  }
  const days = selectedDuration();
  if (qs("#duration")?.value === "custom" && !days) {
    showToast("Custom Days-এ একটি সঠিক দিন সংখ্যা দিন।", "warn");
    return;
  }
  try {
    extendSubscription(editingClient, days);
    editingClient = await saveClient(editingClient);
    fillForm(editingClient);
    await loadAndRenderList();
    showToast(days ? `Subscription activated / renewed for ${days} days!` : "Subscription activated with no expiry!", "success");
  } catch (e) {
    showError(e);
  }
}

async function deactivateCurrent() {
  if (!editingClient) {
    showToast("আগে Client Save করুন।", "warn");
    return;
  }

  openModal({
    title: "Deactivate Subscription",
    bodyHtml: `
      <p class="modal-desc">Are you sure you want to deactivate the digital card subscription for <strong>${esc(editingClient.name)}</strong>?</p>
      <div class="modal-highlight-box">The public digital visiting card will display an inactive card notice until reactivated.</div>
    `,
    confirmText: "Deactivate Card",
    isDanger: true,
    onConfirm: async () => {
      try {
        deactivateSubscription(editingClient);
        editingClient = await saveClient(editingClient);
        fillForm(editingClient);
        await loadAndRenderList();
        showToast("Subscription deactivated.", "info");
      } catch (e) {
        showError(e);
      }
    }
  });
}

function updateStats(list) {
  const totalEl = qs("#statTotal");
  const activeEl = qs("#statActive");
  const inactiveEl = qs("#statInactive");

  if (totalEl) totalEl.textContent = list.length;
  if (activeEl) {
    const activeCount = list.filter((c) => subscriptionState(c).status === "active").length;
    activeEl.textContent = activeCount;
  }
  if (inactiveEl) {
    const inactiveCount = list.filter((c) => subscriptionState(c).status !== "active").length;
    inactiveEl.textContent = inactiveCount;
  }
}

function renderListItems(list) {
  const box = qs("#clientList");
  if (!box) return;

  if (!list.length) {
    box.innerHTML = `
      <div class="empty-list">
        <div class="empty-icon-ring" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>
        </div>
        <p>এখনো কোনো client তৈরি হয়নি। বাম পাশের ফর্ম থেকে নতুন ক্লায়েন্ট যোগ করুন।</p>
      </div>`;
    return;
  }

  box.innerHTML = list
    .map((c) => {
      const s = subscriptionState(c);
      const isBiz = c.template === "business" || c.template === "personal_business" || c.template === "business_only";
      const isBizOnly = c.template === "business_only";
      const displayName = isBizOnly ? c.company || c.name || "Business Card" : c.name || c.company || "Client Card";
      const avatarSrc = isBizOnly ? c.companyLogo || c.photo : c.photo || c.companyLogo;
      const fullUrl = getCardFullUrl(c);

      return `
        <div class="client-item" data-id="${esc(c.id)}">
          <div class="client-item-left">
            <div class="client-item-avatar">
              ${
                avatarSrc
                  ? `<img src="${esc(sanitizeUrl(avatarSrc))}" alt="${esc(displayName)}">`
                  : `<div class="avatar-ph">${esc(displayName ? displayName.charAt(0).toUpperCase() : "C")}</div>`
              }
            </div>
            <div class="client-item-meta">
              <div class="client-item-name-row">
                <strong class="client-item-name">${esc(displayName)}</strong>
                <span class="client-template-pill ${isBiz ? "business" : "personal"}">${c.template === "personal_business" ? "Personal + Business" : c.template === "business_only" ? "Business" : "Personal"}</span>
              </div>
              <div class="client-item-sub">
                ${!isBizOnly && c.designation ? `<span>${esc(c.designation)}</span>` : ""}
                ${!isBizOnly && c.company ? `<span class="company-name">• ${esc(c.company)}</span>` : ""}
                ${isBizOnly && c.tagline ? `<span>${esc(c.tagline)}</span>` : ""}
              </div>
              <div class="list-sub">
                <span class="status-badge ${s.status}">${esc(s.label)}</span>
                <span class="expiry-text">Expiry: ${esc(c.subscriptionEnd ? formatDate(c.subscriptionEnd) : "No expiry")}</span>
              </div>
            </div>
          </div>
          <div class="client-actions">
            ${c.template === "personal_business" ? `
              <a class="mini-btn view" href="${cardUrl(c)}" target="_blank" rel="noopener" title="Open Personal Profile">
                ${ADMIN_ICONS.external}<span>Personal</span>
              </a>
              <a class="mini-btn view" href="${getCardFullUrl(c, "business")}" target="_blank" rel="noopener" title="Open Business Profile">
                ${ADMIN_ICONS.external}<span>Business</span>
              </a>
            ` : `
              <a class="mini-btn view" href="${c.template === "business_only" ? getCardFullUrl(c, "business") : cardUrl(c)}" target="_blank" rel="noopener" title="Open Card in New Tab">
                ${ADMIN_ICONS.external}<span>View</span>
              </a>
            `}
            <button class="mini-btn copy" onclick="copyCardLink('${escJsAttr(fullUrl)}')" type="button" title="Copy Card Link">
              ${ADMIN_ICONS.copy}<span>Copy</span>
            </button>
            <button class="mini-btn edit" onclick="editClient('${escJsAttr(c.id)}')" type="button" title="Edit Client Data">
              ${ADMIN_ICONS.edit}<span>Edit</span>
            </button>
            <button class="mini-btn sub" onclick="quickActivate('${escJsAttr(c.id)}')" type="button" title="Activate or Renew">
              ${ADMIN_ICONS.power}<span>Renew</span>
            </button>
            <button class="mini-btn warn" onclick="quickDeactivate('${escJsAttr(c.id)}')" type="button" title="Deactivate Card">
              Off
            </button>
            <button class="mini-btn app-gen" onclick="openAppGeneratorForClient('${escJsAttr(c.id)}')" type="button" title="Generate Android APK for this client">
              ${ADMIN_ICONS.apk}<span>Generate App</span>
            </button>
            <button class="mini-btn danger" onclick="deleteClient('${escJsAttr(c.id)}')" type="button" title="Delete Card">
              ${ADMIN_ICONS.trash}<span>Delete</span>
            </button>
          </div>
        </div>`;
    })
    .join("");
}

async function loadAndRenderList() {
  try {
    allClients = await getClients();
    updateStats(allClients);
    filterClients();
    if (typeof populateAppGenClientDropdown === "function") {
      populateAppGenClientDropdown();
    }
  } catch (e) {
    const box = qs("#clientList");
    if (box) box.innerHTML = '<div class="empty-list error">Client list load করতে সমস্যা হয়েছে।</div>';
    console.error(e);
  }
}

function filterClients() {
  const query = (qs("#clientSearch")?.value || "").toLowerCase().trim();
  if (!query) {
    renderListItems(allClients);
    return;
  }
  const filtered = allClients.filter((c) => {
    return (
      (c.name || "").toLowerCase().includes(query) ||
      (c.company || "").toLowerCase().includes(query) ||
      (c.designation || "").toLowerCase().includes(query) ||
      (c.phone || "").toLowerCase().includes(query) ||
      (c.email || "").toLowerCase().includes(query) ||
      (c.businessPhone || "").toLowerCase().includes(query) ||
      (c.businessEmail || "").toLowerCase().includes(query) ||
      (c.slug || "").toLowerCase().includes(query)
    );
  });
  renderListItems(filtered);
}

async function findAdminClient(id) {
  const cached = allClients.find((item) => item.id === id);
  if (cached) return { ...cached };
  if (typeof getClientForAdmin === "function") {
    const fromDb = await getClientForAdmin(id);
    if (fromDb) return fromDb;
  }
  return getClient(id);
}

window.copyCardLink = async function (url) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      showToast("Card link copied to clipboard!", "success");
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(ta);
    if (copied) {
      showToast("Card link copied to clipboard!", "success");
      return;
    }
  } catch (e) {
    // Fallback to modal below
  }

  openModal({
    title: "Copy Card Link",
    bodyHtml: `
      <p class="modal-desc">Select and copy the public card link below:</p>
      <input type="text" class="form-input" value="${esc(url)}" readonly onclick="this.select()">
    `,
    confirmText: "Done",
    onConfirm: async () => true
  });
};

window.editClient = async function (id) {
  if (!isAdminAuthenticated) return;
  try {
    const c = await findAdminClient(id);
    if (c) {
      fillForm(c);
      const formEl = qs("#clientForm");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      showToast(`Editing "${c.template === "business_only" ? c.company || c.name : c.name}"`, "info");
    }
  } catch (e) {
    showError(e);
  }
};

window.quickActivate = async function (id) {
  if (!isAdminAuthenticated) return;
  try {
    const c = await findAdminClient(id);
    if (!c) return;

    openModal({
      title: `Renew Subscription • ${c.name}`,
      bodyHtml: `
        <p class="modal-desc">Select the subscription period to add to <strong>${esc(c.name)}</strong>'s card.</p>
        <div class="modal-highlight-box">
          <label class="form-label" style="margin-bottom: 6px;">Subscription Period</label>
          <select id="modalDurationSelect" class="form-select" style="margin-bottom: 8px;">
            <option value="30">30 Days (Standard 1 Month)</option>
            <option value="90">90 Days (Quarterly)</option>
            <option value="180">180 Days (Half Year)</option>
            <option value="365">365 Days (1 Year)</option>
            <option value="1825">1825 Days (5 Years)</option>
            <option value="none">No Expiry (Lifetime)</option>
            <option value="custom">Custom Days</option>
          </select>
          <div id="modalCustomWrap" class="hidden" style="margin-top: 8px;">
            <label class="form-label">Number of Days</label>
            <input id="modalCustomDaysInput" type="number" min="1" max="9999" class="form-input" placeholder="e.g. 45">
          </div>
        </div>
      `,
      confirmText: "Renew Subscription",
      onConfirm: async () => {
        const select = qs("#modalDurationSelect");
        if (!select) return;
        let days = 30;
        if (select.value === "none") days = 0;
        else if (select.value === "custom") {
          const n = Number(qs("#modalCustomDaysInput")?.value);
          if (!n || n <= 0) {
            showToast("Custom Days-এ একটি সঠিক সংখ্যা দিন।", "warn");
            return false;
          }
          days = n;
        } else {
          days = Number(select.value);
        }

        extendSubscription(c, days);
        const saved = await saveClient(c);
        if (editingClient && editingClient.id === id) {
          editingClient = saved;
          fillForm(saved);
        }
        await loadAndRenderList();
        showToast(`"${c.name}" renewed for ${days || "unlimited"} days!`, "success");
      }
    });

    const sel = qs("#modalDurationSelect");
    if (sel) {
      sel.onchange = function () {
        const wrap = qs("#modalCustomWrap");
        if (wrap) wrap.classList.toggle("hidden", this.value !== "custom");
      };
    }
  } catch (e) {
    showError(e);
  }
};

window.quickDeactivate = async function (id) {
  if (!isAdminAuthenticated) return;
  try {
    const c = await findAdminClient(id);
    if (!c) return;

    openModal({
      title: "Deactivate Subscription",
      bodyHtml: `
        <p class="modal-desc">Are you sure you want to turn off the card for <strong>${esc(c.name)}</strong>?</p>
        <div class="modal-highlight-box">The card will immediately stop showing contact actions and show an inactive card message.</div>
      `,
      confirmText: "Turn Off Card",
      isDanger: true,
      onConfirm: async () => {
        deactivateSubscription(c);
        const saved = await saveClient(c);
        if (editingClient && editingClient.id === id) {
          editingClient = saved;
          fillForm(saved);
        }
        await loadAndRenderList();
        showToast(`"${c.name}" subscription deactivated.`, "info");
      }
    });
  } catch (e) {
    showError(e);
  }
};

window.deleteClient = async function (id) {
  if (!isAdminAuthenticated) return;
  try {
    const c = await findAdminClient(id);
    const clientName = c ? (c.template === "business_only" ? c.company || c.name : c.name) : "This client";

    openModal({
      title: "Delete Client Card",
      bodyHtml: `
        <p class="modal-desc">Are you sure you want to permanently delete <strong>${esc(clientName)}</strong>'s visiting card?</p>
        <div class="modal-highlight-box" style="border-color: rgba(239, 68, 68, 0.3); color: #fca5a5;">
          This action is permanent and cannot be undone. The card link and QR code will no longer function.
        </div>
      `,
      confirmText: "Delete Permanently",
      isDanger: true,
      onConfirm: async () => {
        await removeClient(id);
        await loadAndRenderList();
        if (qs("#clientId")?.value === id) clearForm();
        showToast("Client deleted successfully.", "info");
      }
    });
  } catch (e) {
    showError(e);
  }
};

// KDS IMAGE OPTIMIZATION — upload-time resize/compression
async function optimizeImageForStorage(file) {
  if (file.type === "image/gif") return { blob: file, ext: "gif", contentType: file.type };

  const MAX_DIMENSION = 1600;
  const QUALITY = 0.84;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true });

  if (!ctx) {
    bitmap.close();
    return { blob: file, ext: (file.name.split(".").pop() || "jpg").toLowerCase(), contentType: file.type };
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
  if (!blob) {
    return { blob: file, ext: (file.name.split(".").pop() || "jpg").toLowerCase(), contentType: file.type };
  }

  return { blob, ext: "webp", contentType: "image/webp" };
}

// Handle persistent image uploads through Supabase Storage
function setupImageUpload(fileInputId, textInputId, thumbId, wrapId) {
  const fileInput = qs(fileInputId);
  const textInput = qs(textInputId);
  const thumb = qs(thumbId);
  const wrap = qs(wrapId);

  if (!fileInput || !textInput) return;

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Keep uploads predictable and safe for Storage and mobile loading.
    // 5 MB is the existing project limit; reject oversized files before upload.
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    const ALLOWED_IMAGE_TYPES = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ]);

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      showToast("Please select a JPG, PNG, WebP, or GIF image.", "warn");
      fileInput.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      showToast("Image is too large. Maximum allowed size is 5 MB.", "warn");
      fileInput.value = "";
      return;
    }

    showToast("Processing image...", "info");

    try {
      const previousUrl = textInput.value.trim();
      const previousPending = pendingImageUploads.get(textInputId);

      const optimized = await optimizeImageForStorage(file);

      // 1. First attempt: Upload to Supabase Storage if available
      let uploadedUrl = null;
      if (window.supabaseClient) {
        try {
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${optimized.ext}`;
          const { data, error } = await supabaseClient.storage
            .from("card-assets")
            .upload(`uploads/${fileName}`, optimized.blob, {
              cacheControl: "31536000",
              upsert: false,
              contentType: optimized.contentType
            });

          if (!error && data) {
            const { data: pubData } = supabaseClient.storage
              .from("card-assets")
              .getPublicUrl(`uploads/${fileName}`);
            if (pubData?.publicUrl) {
              uploadedUrl = pubData.publicUrl;
            }
          }
        } catch (storageErr) {
          console.warn("Storage upload failed:", storageErr);
        }
      }

      // Clear the file input after a successful upload so selecting the same
    // file again will still fire the change event.
    fileInput.value = "";

    // Do not fall back to data URLs. Public cards must reference a real
      // Supabase Storage asset so images remain persistent and cacheable.
      if (!uploadedUrl) {
        throw new Error("Image upload failed. Please check your admin session and Storage permissions, then try again.");
      }

      // If this field already had a newly uploaded unsaved asset, remove that
      // asset before replacing it so repeated selections do not create orphans.
      if (previousPending?.newUrl && previousPending.newUrl !== uploadedUrl) {
        await removeCardAsset(previousPending.newUrl);
      }

      pendingImageUploads.set(textInputId, {
        newUrl: uploadedUrl,
        oldUrl: previousPending?.oldUrl || previousUrl || ""
      });

      textInput.value = uploadedUrl;
      if (thumb) thumb.src = uploadedUrl;
      if (wrap) wrap.classList.remove("hidden");
      showToast("Image ready!", "success");
    } catch (err) {
      console.error("Image processing error:", err);
      showToast("Failed to process image.", "error");
    }
  });

  // Also sync live if typed manually
  textInput.addEventListener("input", updateImagePreviews);
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveSubmitBtn = qs("#saveClientBtn");
    if (saveSubmitBtn) {
      saveSubmitBtn.disabled = true;
      saveSubmitBtn.innerHTML = `<span>Saving...</span>`;
    }

    const isNew = !editingClient;
    const durDays = selectedDuration();
    const nowIso = new Date().toISOString();

    const data = editingClient
      ? { ...editingClient }
      : {
          id: null,
          template: selectedTemplate,
          subscriptionActive: true,
          subscriptionStart: nowIso,
          subscriptionEnd: durDays > 0 ? addDuration(nowIso, durDays).toISOString() : null
        };

    // If new client, auto-activate with selected duration
    if (isNew) {
      data.subscriptionActive = true;
      data.subscriptionStart = nowIso;
      data.subscriptionEnd = durDays > 0 ? addDuration(nowIso, durDays).toISOString() : null;
    }

    data.template = selectedTemplate;
    const keys = [
      "name",
      "designation",
      "personalCompany",
      "phone",
      "whatsapp",
      "email",
      "bio",
      "location",
      "company",
      "tagline",
      "companyLogo",
      "photo",
      "cover",
      "facebook",
      "instagram",
      "linkedin",
      "youtube",
      "tiktok",
      "businessBio",
      "businessPhone",
      "businessWhatsapp",
      "businessEmail",
      "businessAddressText",
      "businessAddress",
      "businessWebsite",
      "businessCover",
      "businessFacebook",
      "businessInstagram",
      "businessLinkedin",
      "businessYoutube",
      "businessTiktok"
    ];
    keys.forEach((k) => {
      const el = qs("#" + k);
      if (el) data[k] = el.value.trim();
    });

    // Personal Profile uses the dedicated Company Name field.
    // The same database company_name field is shared with the Business Profile
    // so existing cards and the Personal + Business connection remain compatible.
    const personalCompanyValue = String(qs("#personalCompany")?.value || "").trim();
    if (selectedTemplate === "personal") {
      data.company = personalCompanyValue;
    } else if (selectedTemplate === "personal_business" && personalCompanyValue && !String(data.company || "").trim()) {
      data.company = personalCompanyValue;
    }

    if (selectedTemplate === "business_only") {
      data.name = data.company || data.name || "Business";
    }

    const validation = validateClientForm(data);
    if (!validation.ok) {
      await cleanupPendingUploads();
      showToast(validation.message, "error");
      if (saveSubmitBtn) {
        saveSubmitBtn.disabled = false;
        saveSubmitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg><span>Save Client Card</span>`;
      }
      return;
    }

    // Services are stored as structured JSON so every card can show
    // Service Name + Service Description instead of a generic label.
    data.businessServices = serializeServices();

    try {
      const previousImageValues = imageValuesFromClient(editingClient);
      const savedClient = await saveClient(data);

      // DB save succeeded. Only now remove replaced old Storage assets.
      const savedImageValues = imageValuesFromClient(savedClient);
      const oldUrlsToRemove = [];
      pendingImageUploads.forEach((entry) => {
        if (entry?.oldUrl && entry.oldUrl !== entry.newUrl && previousImageValues.includes(entry.oldUrl)) {
          oldUrlsToRemove.push(entry.oldUrl);
        }
      });

      const keepUrls = savedImageValues;
      await cleanupPendingUploads({ keepUrls, cleanupOldUrls: oldUrlsToRemove });

      editingClient = savedClient;
      fillForm(editingClient);
      await loadAndRenderList();
      showToast(isNew ? "Client created and activated successfully!" : "Client updated successfully!", "success");
    } catch (e) {
      // If DB save fails, remove any assets uploaded during this unsaved session.
      await cleanupPendingUploads();
      showError(e);
    } finally {
      if (saveSubmitBtn) {
        saveSubmitBtn.disabled = false;
        saveSubmitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg><span>Save Client Card</span>`;
      }
    }
  });
}

async function initAdmin() {
  try {
    if (!window.supabaseClient) {
      showLogin("Secure database connection is unavailable. Please try again.");
      return;
    }

    const {
      data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session) {
      showLogin();
      return;
    }

    // Strict admin verification in admin_users
    try {
      const { data: adminRecord, error: adminErr } = await supabaseClient
        .from("admin_users")
        .select("user_id,email")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (adminErr || !adminRecord) {
        console.warn("Unauthorized user attempted admin access:", session.user.email);
        showUnauthorized(session.user.email);
        return;
      }

      // Display authenticated admin email
      const userBadge = qs("#adminUserEmail");
      if (userBadge) {
        userBadge.textContent = session.user.email || "Admin";
        userBadge.classList.remove("hidden");
      }
    } catch (authErr) {
      console.error("Admin verification error:", authErr);
      showUnauthorized(session.user.email);
      return;
    }

    showAdmin();
    clearForm();
    await loadAndRenderList();
  } catch (err) {
    console.error("initAdmin error:", err);
    showLogin("Authentication check failed. Please sign in.");
  }
}

function showLogin(message = "") {
  isAdminAuthenticated = false;
  if (qs("#loginPanel")) qs("#loginPanel").classList.remove("hidden");
  if (qs("#unauthorizedPanel")) qs("#unauthorizedPanel").classList.add("hidden");
  if (qs("#adminApp")) qs("#adminApp").classList.add("hidden");
  if (qs("#logoutBtn")) qs("#logoutBtn").classList.add("hidden");
  if (qs("#adminUserEmail")) qs("#adminUserEmail").classList.add("hidden");
  if (message && qs("#loginMessage")) qs("#loginMessage").textContent = message;
}

function showUnauthorized(email = "") {
  isAdminAuthenticated = false;
  if (qs("#loginPanel")) qs("#loginPanel").classList.add("hidden");
  if (qs("#adminApp")) qs("#adminApp").classList.add("hidden");
  if (qs("#unauthorizedPanel")) qs("#unauthorizedPanel").classList.remove("hidden");
  if (qs("#logoutBtn")) qs("#logoutBtn").classList.remove("hidden");
  const emailBadge = qs("#unauthorizedEmail");
  if (emailBadge) emailBadge.textContent = email || "Current User";
}

function showAdmin() {
  isAdminAuthenticated = true;
  if (qs("#loginPanel")) qs("#loginPanel").classList.add("hidden");
  if (qs("#unauthorizedPanel")) qs("#unauthorizedPanel").classList.add("hidden");
  if (qs("#adminApp")) qs("#adminApp").classList.remove("hidden");
  if (qs("#logoutBtn")) qs("#logoutBtn").classList.remove("hidden");
}

const loginForm = qs("#loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msgEl = qs("#loginMessage");
    if (msgEl) msgEl.textContent = "Signing in...";
    const email = qs("#loginEmail")?.value.trim();
    const password = qs("#loginPassword")?.value;

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        if (msgEl) msgEl.textContent = error.message;
        return;
      }
      if (msgEl) msgEl.textContent = "";
      await initAdmin();
    } catch (err) {
      if (msgEl) msgEl.textContent = err.message || "Login failed";
    }
  });
}

const handleSignOut = async () => {
  isAdminAuthenticated = false;
  allClients = [];
  editingClient = null;
  if (qs("#clientList")) qs("#clientList").innerHTML = "";
  showLogin();
  if (window.supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  location.reload();
};

if (typeof window.addEventListener === "function") {
  window.addEventListener("pageshow", (event) => {
    if (event && event.persisted) {
      initAdmin();
    }
  });
}

const logoutBtn = qs("#logoutBtn");
if (logoutBtn) logoutBtn.addEventListener("click", handleSignOut);

const unauthorizedLogoutBtn = qs("#unauthorizedLogoutBtn");
if (unauthorizedLogoutBtn) unauthorizedLogoutBtn.addEventListener("click", handleSignOut);

// Template selection buttons
document.querySelectorAll(".template-pick button").forEach((b) => {
  b.addEventListener("click", () => setTemplate(b.dataset.template));
});

// Duration change
const durationEl = qs("#duration");
if (durationEl) {
  durationEl.addEventListener("change", function () {
    const customWrap = qs("#customDaysWrap");
    if (customWrap) customWrap.classList.toggle("hidden", this.value !== "custom");
  });
}

// Subscription buttons
const actBtn = qs("#activateBtn");
if (actBtn) actBtn.addEventListener("click", activateCurrent);
const deactBtn = qs("#deactivateBtn");
if (deactBtn) deactBtn.addEventListener("click", deactivateCurrent);

// Form reset button
const resetBtn = qs("#resetBtn");
if (resetBtn) resetBtn.addEventListener("click", clearForm);

// Search input
const searchInput = qs("#clientSearch");
if (searchInput) {
  searchInput.addEventListener("input", filterClients);
}


// Personal/Business Company Name synchronization.
// This uses the existing single company field in the data model, so no
// database migration is required and existing cards remain compatible.
const personalCompanyInput = qs("#personalCompany");
const businessCompanyInput = qs("#company");
if (personalCompanyInput && businessCompanyInput) {
  personalCompanyInput.addEventListener("input", () => {
    if (selectedTemplate === "personal_business") {
      businessCompanyInput.value = personalCompanyInput.value;
    }
  });
  businessCompanyInput.addEventListener("input", () => {
    if (selectedTemplate === "personal_business") {
      personalCompanyInput.value = businessCompanyInput.value;
    }
  });
}

// Setup image upload handlers
setupImageUpload("#photoFile", "#photo", "#photoThumb", "#photoPreviewWrap");
setupImageUpload("#coverFile", "#cover", "#coverThumb", "#coverPreviewWrap");
setupImageUpload("#businessCoverFile", "#businessCover", "#businessCoverThumb", "#businessCoverPreviewWrap");
setupImageUpload("#companyLogoFile", "#companyLogo", "#companyLogoThumb", "#companyLogoPreviewWrap");

// Personal Cover (#cover) and Business Cover (#businessCover) remain
// completely independent. Each upload/input updates only its own preview.

/* ==========================================================================
   KDS CLIENT APP GENERATOR (SHARED BY MAIN MENU & MANAGE CLIENTS)
   ========================================================================== */

const BANGLA_CHAR_MAP = {
  "অ": "o", "আ": "a", "ই": "i", "ঈ": "ee", "উ": "u", "ঊ": "oo", "ঋ": "ri",
  "এ": "e", "ঐ": "oi", "ও": "o", "ঔ": "ou",
  "া": "a", "ি": "i", "ী": "i", "ু": "u", "ূ": "u", "ৃ": "ri",
  "ে": "e", "ৈ": "oi", "ো": "o", "ৌ": "ou",
  "ক": "k", "খ": "kh", "গ": "g", "ঘ": "gh", "ঙ": "ng",
  "চ": "ch", "ছ": "chh", "জ": "j", "ঝ": "jh", "ঞ": "n",
  "ট": "t", "ঠ": "th", "ড": "d", "ঢ": "dh", "ণ": "n",
  "ত": "t", "থ": "th", "দ": "d", "ধ": "dh", "ন": "n",
  "প": "p", "ফ": "ph", "ব": "b", "ভ": "bh", "ম": "m",
  "য": "j", "র": "r", "ল": "l", "শ": "sh", "ষ": "sh", "স": "s", "হ": "h",
  "ড়": "r", "ঢ়": "rh", "য়": "y", "ৎ": "t", "ং": "ng", "ঃ": "h", "ঁ": "n",
  "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9"
};

function transliterateToAscii(input) {
  const raw = String(input || "");
  let out = "";
  for (const ch of raw) {
    if (BANGLA_CHAR_MAP[ch] !== undefined) {
      out += BANGLA_CHAR_MAP[ch];
    } else {
      out += ch;
    }
  }
  return out
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function deterministicHashHex(str, len = 6) {
  const s = String(str || "kds");
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + i;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  const combined = (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).toLowerCase();
  const letters = "abcdefghijklmnop";
  const firstLetter = letters[h1 % 16];
  return (firstLetter + combined).slice(0, Math.max(4, len));
}

function generateAndroidTechnicalIds(displayName, clientId = "", clientsList = allClients) {
  const ascii = transliterateToAscii(displayName || "client");
  let baseSegment = ascii.replace(/[^a-z0-9]/g, "");
  if (!baseSegment) {
    baseSegment = "client" + deterministicHashHex(displayName || clientId || "kds", 6);
  }
  if (!/^[a-z]/.test(baseSegment)) {
    baseSegment = "c" + baseSegment;
  }
  baseSegment = baseSegment.slice(0, 28);

  // Build unique Android-safe suffix from clientId (or deterministic hash)
  const rawCleanId = String(clientId || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  let suffix = rawCleanId
    ? ("a" + rawCleanId.slice(-5)).slice(0, 6)
    : deterministicHashHex(displayName + "::" + clientId, 5);
  if (!/^[a-z]/.test(suffix)) {
    suffix = "k" + suffix;
  }

  // Ensure uniqueness across any clients with identical display names
  const usedPackages = new Set();
  (clientsList || []).forEach((item) => {
    if (!item || item.id === clientId) return;
    const itemName = item.template === "business_only" ? (item.company || item.name) : (item.name || item.company);
    const itemAscii = transliterateToAscii(itemName || "client").replace(/[^a-z0-9]/g, "") || "client";
    const itemBase = (/^[a-z]/.test(itemAscii) ? itemAscii : "c" + itemAscii).slice(0, 28);
    const itemCleanId = String(item.id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const itemSuffix = itemCleanId ? ("a" + itemCleanId.slice(-5)).slice(0, 6) : deterministicHashHex(itemName + "::" + item.id, 5);
    usedPackages.add(`com.kds.card.${itemBase}.${itemSuffix}`);
  });

  let packageId = `com.kds.card.${baseSegment}.${suffix}`;
  let counter = 2;
  while (usedPackages.has(packageId)) {
    packageId = `com.kds.card.${baseSegment}.${suffix}${counter}`;
    counter++;
  }

  const finalSuffix = packageId.split(".").pop();
  const internalAppId = `${baseSegment}_${finalSuffix}`;
  const safeFileName = `kds-${baseSegment}-${finalSuffix}.apk`;

  return {
    internalAppId,
    packageId,
    safeFileName
  };
}

window.generateAndroidTechnicalIds = generateAndroidTechnicalIds;

const appGenState = {
  selectedClientId: "",
  sourceClient: null,
  appName: "",
  profile: "personal",
  cardUrl: "",
  urlManuallyEdited: false,
  iconUrl: "",
  photoUrl: "",
  splashImageUrl: "",
  splashTitle: "",
  splashTitleManuallyEdited: false,
  splashBgColor: "#060a12",
  lastGeneratedBuild: null
};

function getDefaultProfileForClient(c) {
  if (!c) return "personal";
  if (c.template === "business_only") return "business";
  if (c.template === "personal_business") return "personal_business";
  return "personal";
}

function getDefaultCardUrlForProfile(c, profile) {
  if (!c) return getCardFullUrl("demo", "personal");
  if (profile === "business") {
    return getCardFullUrl(c, "business");
  }
  return getCardFullUrl(c, "personal");
}

function formatProfileLabel(profile) {
  if (profile === "business") return "Business";
  if (profile === "personal_business") return "Personal + Business";
  return "Personal";
}

function populateAppGenClientDropdown(searchQuery = "") {
  const select = qs("#appGenClientSelect");
  if (!select) return;

  const query = String(searchQuery || qs("#appGenClientSearch")?.value || "")
    .toLowerCase()
    .trim();

  const previousValue = select.value || appGenState.selectedClientId;
  const filteredClients = query
    ? allClients.filter((c) => {
        return (
          (c.name || "").toLowerCase().includes(query) ||
          (c.company || "").toLowerCase().includes(query) ||
          (c.designation || "").toLowerCase().includes(query) ||
          (c.phone || "").toLowerCase().includes(query) ||
          (c.businessPhone || "").toLowerCase().includes(query) ||
          (c.slug || "").toLowerCase().includes(query)
        );
      })
    : allClients;

  const optionsHtml = [
    `<option value="">— Select an existing client —</option>`,
    ...filteredClients.map((c) => {
      const isBizOnly = c.template === "business_only";
      const displayName = isBizOnly ? c.company || c.name || "Business Card" : c.name || c.company || "Client Card";
      const subLabel = !isBizOnly && c.company ? ` (${c.company})` : "";
      const tplLabel = c.template === "personal_business" ? "Personal + Business" : c.template === "business_only" ? "Business" : "Personal";
      return `<option value="${esc(c.id)}">${esc(displayName + subLabel)} — [${esc(tplLabel)}]</option>`;
    })
  ];

  select.innerHTML = optionsHtml.join("");

  if (previousValue && filteredClients.some((c) => c.id === previousValue)) {
    select.value = previousValue;
  } else if (query && filteredClients.length === 1) {
    select.value = filteredClients[0].id;
    loadClientIntoAppGenerator(filteredClients[0]);
  }
}

function setAppGenProfileSelection(profile, updateUrlIfAuto = true) {
  const validProfile = ["personal", "business", "personal_business"].includes(profile) ? profile : "personal";
  appGenState.profile = validProfile;

  document.querySelectorAll("#appGenProfileGroup [data-app-profile]").forEach((label) => {
    const isMatch = label.getAttribute("data-app-profile") === validProfile;
    label.classList.toggle("active", isMatch);
    const radio = label.querySelector('input[type="radio"]');
    if (radio) radio.checked = isMatch;
  });

  if (updateUrlIfAuto && !appGenState.urlManuallyEdited && appGenState.sourceClient) {
    const nextUrl = getDefaultCardUrlForProfile(appGenState.sourceClient, validProfile);
    appGenState.cardUrl = nextUrl;
    const urlInput = qs("#appGenCardUrl");
    if (urlInput) urlInput.value = nextUrl;
  }

  updateAppGeneratorLivePreview();
}

function loadClientIntoAppGenerator(c) {
  if (!c) return;
  // Clone so App Generator edits never mutate the original client object
  const snapshot = JSON.parse(JSON.stringify(c));
  appGenState.selectedClientId = snapshot.id;
  appGenState.sourceClient = snapshot;

  const isBizOnly = snapshot.template === "business_only";
  const defaultAppName = isBizOnly
    ? snapshot.company || snapshot.name || "Business App"
    : snapshot.name || snapshot.company || "Digital Card App";

  const defaultProfile = getDefaultProfileForClient(snapshot);
  const defaultUrl = getDefaultCardUrlForProfile(snapshot, defaultProfile);
  const defaultIcon = isBizOnly
    ? snapshot.companyLogo || snapshot.photo || ""
    : snapshot.companyLogo || snapshot.photo || "";
  const defaultPhoto = snapshot.photo || snapshot.companyLogo || "";
  const defaultSplashImg = snapshot.companyLogo || snapshot.photo || "";

  appGenState.appName = defaultAppName;
  appGenState.profile = defaultProfile;
  appGenState.cardUrl = defaultUrl;
  appGenState.urlManuallyEdited = false;
  appGenState.iconUrl = defaultIcon;
  appGenState.photoUrl = defaultPhoto;
  appGenState.splashImageUrl = defaultSplashImg;
  appGenState.splashTitle = defaultAppName;
  appGenState.splashTitleManuallyEdited = false;
  appGenState.splashBgColor = "#060a12";
  appGenState.lastGeneratedBuild = null;

  const resultBox = qs("#appGenResultBox");
  if (resultBox) resultBox.classList.add("hidden");

  ["#appGenIconFile", "#appGenPhotoFile", "#appGenSplashImageFile"].forEach((sel) => {
    const fileEl = qs(sel);
    if (fileEl) fileEl.value = "";
  });

  const select = qs("#appGenClientSelect");
  if (select && select.value !== snapshot.id) {
    select.value = snapshot.id;
  }

  const nameInput = qs("#appGenAppName");
  if (nameInput) nameInput.value = appGenState.appName;

  const urlInput = qs("#appGenCardUrl");
  if (urlInput) urlInput.value = appGenState.cardUrl;

  const iconInput = qs("#appGenIconUrl");
  if (iconInput) iconInput.value = appGenState.iconUrl;

  const photoInput = qs("#appGenPhotoUrl");
  if (photoInput) photoInput.value = appGenState.photoUrl;

  const splashImgInput = qs("#appGenSplashImageUrl");
  if (splashImgInput) splashImgInput.value = appGenState.splashImageUrl;

  const splashTitleInput = qs("#appGenSplashTitle");
  if (splashTitleInput) splashTitleInput.value = appGenState.splashTitle;

  const bgColorInput = qs("#appGenSplashBgColor");
  if (bgColorInput) bgColorInput.value = appGenState.splashBgColor;

  const bgHexInput = qs("#appGenSplashBgHex");
  if (bgHexInput) bgHexInput.value = appGenState.splashBgColor;

  const msgEl = qs("#appGenValidationMsg");
  if (msgEl) {
    msgEl.textContent = "";
    msgEl.classList.add("hidden");
  }

  setAppGenProfileSelection(defaultProfile, false);
  updateAppGeneratorLivePreview();
}

function updateAssetPreviewThumb(imgSel, fallbackSel, url, initialsText) {
  const imgEl = qs(imgSel);
  const fbEl = qs(fallbackSel);
  const cleanUrl = String(url || "").trim();
  const isAllowed =
    cleanUrl.startsWith("data:image/") ||
    Boolean(sanitizeUrl(cleanUrl));

  if (fbEl) fbEl.textContent = getInitials(initialsText || "KDS", "KD");

  if (imgEl && isAllowed) {
    imgEl.src = cleanUrl;
    imgEl.classList.remove("hidden");
    if (fbEl) fbEl.classList.add("hidden");
  } else {
    if (imgEl) {
      imgEl.src = "";
      imgEl.classList.add("hidden");
    }
    if (fbEl) fbEl.classList.remove("hidden");
  }
}

function updateAppGeneratorLivePreview() {
  const appName = String(qs("#appGenAppName")?.value ?? appGenState.appName ?? "").trim() || "Digital Card App";
  const cardUrl = String(qs("#appGenCardUrl")?.value ?? appGenState.cardUrl ?? "").trim();
  const iconUrl = String(qs("#appGenIconUrl")?.value ?? appGenState.iconUrl ?? "").trim();
  const photoUrl = String(qs("#appGenPhotoUrl")?.value ?? appGenState.photoUrl ?? "").trim();
  const splashImageUrl = String(qs("#appGenSplashImageUrl")?.value ?? appGenState.splashImageUrl ?? "").trim();
  const splashTitle = String(qs("#appGenSplashTitle")?.value ?? appGenState.splashTitle ?? "").trim() || appName;
  const rawBg = String(qs("#appGenSplashBgHex")?.value ?? appGenState.splashBgColor ?? "#060a12").trim();
  const splashBgColor = /^#[0-9a-fA-F]{6}$/.test(rawBg) ? rawBg : "#060a12";

  appGenState.appName = String(qs("#appGenAppName")?.value ?? appGenState.appName ?? "").trim();
  appGenState.cardUrl = cardUrl;
  appGenState.iconUrl = iconUrl;
  appGenState.photoUrl = photoUrl;
  appGenState.splashImageUrl = splashImageUrl;
  appGenState.splashTitle = String(qs("#appGenSplashTitle")?.value ?? appGenState.splashTitle ?? "").trim();
  appGenState.splashBgColor = splashBgColor;

  // Form asset thumbnails
  updateAssetPreviewThumb("#appGenIconThumb", "#appGenIconFallback", iconUrl, appName);
  updateAssetPreviewThumb("#appGenPhotoThumb", "#appGenPhotoFallback", photoUrl, appName);
  updateAssetPreviewThumb("#appGenSplashThumb", "#appGenSplashFallback", splashImageUrl || iconUrl, splashTitle);

  // Live Preview device card
  const previewNameEl = qs("#previewAppNameText");
  if (previewNameEl) previewNameEl.textContent = appName;

  updateAssetPreviewThumb("#previewAppIconImg", "#previewAppIconInitials", iconUrl, appName);
  updateAssetPreviewThumb("#previewSplashLogoImg", "#previewSplashLogoInitials", splashImageUrl || iconUrl, splashTitle);

  const splashBox = qs("#previewSplashBox");
  if (splashBox) splashBox.style.backgroundColor = splashBgColor;

  const splashTitleEl = qs("#previewSplashTitleText");
  if (splashTitleEl) splashTitleEl.textContent = splashTitle;

  const photoBadgeWrap = qs("#previewPhotoBadgeWrap");
  const photoPreviewImg = qs("#previewAppPhotoImg");
  const photoPreviewLabel = qs("#previewAppPhotoLabel");
  if (photoUrl && (photoUrl.startsWith("data:image/") || sanitizeUrl(photoUrl))) {
    if (photoPreviewImg) {
      photoPreviewImg.src = photoUrl;
      photoPreviewImg.classList.remove("hidden");
    }
    if (photoPreviewLabel) photoPreviewLabel.textContent = "Profile Photo Configured";
    if (photoBadgeWrap) photoBadgeWrap.classList.remove("hidden");
  } else {
    if (photoPreviewImg) {
      photoPreviewImg.src = "";
      photoPreviewImg.classList.add("hidden");
    }
    if (photoPreviewLabel) photoPreviewLabel.textContent = "No Profile Photo Set";
  }

  const profileBadge = qs("#previewAppProfileBadge");
  if (profileBadge) {
    profileBadge.textContent = formatProfileLabel(appGenState.profile);
    profileBadge.className = `client-template-pill ${appGenState.profile === "personal" ? "personal" : "business"}`;
  }

  const behaviorText = qs("#previewAppBehaviorText");
  if (behaviorText) {
    behaviorText.textContent =
      appGenState.profile === "business"
        ? "Opens live Business Profile"
        : appGenState.profile === "personal_business"
        ? "Opens live Personal + Business Card"
        : "Opens live Personal Card";
  }

  const urlText = qs("#previewAppCardUrlText");
  if (urlText) urlText.textContent = cardUrl || "No Card URL configured";

  const openCardBtn = qs("#appGenOpenCardPreviewBtn");
  if (openCardBtn) {
    const safeHref = sanitizeUrl(cardUrl) || "./card.html?preview=demo";
    openCardBtn.href = safeHref;
  }
}

window.openAppGeneratorForClient = async function (clientId) {
  if (!isAdminAuthenticated) return;
  try {
    const client = await findAdminClient(clientId);
    if (!client) {
      showToast("Client not found.", "error");
      return;
    }

    const navAppBtn = qs("#navAppGeneratorBtn");
    const navClientsBtn = qs("#navClientsBtn");
    if (navAppBtn) navAppBtn.classList.add("active");
    if (navClientsBtn) navClientsBtn.classList.remove("active");

    populateAppGenClientDropdown();
    loadClientIntoAppGenerator(client);

    const section = qs("#appGeneratorSection");
    if (section && typeof section.scrollIntoView === "function") {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const displayName = client.template === "business_only" ? client.company || client.name : client.name;
    showToast(`Loaded "${displayName}" into App Generator`, "info");
  } catch (e) {
    showError(e);
  }
};

function isValidAppAssetUrl(value) {
  const v = String(value || "").trim();
  if (!v) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(v)) {
    return true;
  }
  return isValidPublicUrl(v);
}

async function processAppAssetFileToPngDataUrl(file, targetSize = 512) {
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
  ]);

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Please select a valid JPG, PNG, WebP, or GIF image.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large. Maximum allowed size is 5 MB.");
  }

  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, targetSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (ctx) {
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      if (typeof canvas.toDataURL === "function") {
        return canvas.toDataURL("image/png");
      }
    } else {
      bitmap.close();
    }
  }

  // Fallback FileReader data URL for environments without createImageBitmap
  return await new Promise((resolve, reject) => {
    if (typeof FileReader !== "undefined") {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    } else {
      resolve("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==");
    }
  });
}

function setupAppGenImageInput(fileInputSel, urlInputSel, stateKey, targetSize = 512) {
  const fileInput = qs(fileInputSel);
  const urlInput = qs(urlInputSel);
  if (fileInput && urlInput) {
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await processAppAssetFileToPngDataUrl(file, targetSize);
        urlInput.value = dataUrl;
        appGenState[stateKey] = dataUrl;
        fileInput.value = "";
        updateAppGeneratorLivePreview();
        showToast("App image updated for APK build!", "success");
      } catch (err) {
        fileInput.value = "";
        showError(err);
      }
    });

    urlInput.addEventListener("input", () => {
      appGenState[stateKey] = urlInput.value.trim();
      updateAppGeneratorLivePreview();
    });
  }
}

function validateAppGeneratorConfig() {
  const appName = String(qs("#appGenAppName")?.value ?? appGenState.appName ?? "").trim();
  const cardUrl = String(qs("#appGenCardUrl")?.value ?? appGenState.cardUrl ?? "").trim();
  const profile = appGenState.profile;
  const iconUrl = String(qs("#appGenIconUrl")?.value ?? appGenState.iconUrl ?? "").trim();
  const photoUrl = String(qs("#appGenPhotoUrl")?.value ?? appGenState.photoUrl ?? "").trim();
  const splashImageUrl = String(qs("#appGenSplashImageUrl")?.value ?? appGenState.splashImageUrl ?? "").trim();
  const splashTitle = String(qs("#appGenSplashTitle")?.value ?? appGenState.splashTitle ?? "").trim() || appName;
  const rawBg = String(qs("#appGenSplashBgHex")?.value ?? appGenState.splashBgColor ?? "#060a12").trim();

  if (!appName) {
    return { ok: false, message: "App Name is required before generating the APK." };
  }
  if (appName.length > 80) {
    return { ok: false, message: "App Name must be 80 characters or fewer." };
  }
  if (!cardUrl) {
    return { ok: false, message: "Card URL is required before generating the APK." };
  }
  const sanitizedCardUrl = sanitizeUrl(cardUrl);
  if (!sanitizedCardUrl) {
    return { ok: false, message: "Card URL must be a valid http:// or https:// link." };
  }
  if (!["personal", "business", "personal_business"].includes(profile)) {
    return { ok: false, message: "Selected profile is invalid." };
  }
  if (!isValidAppAssetUrl(iconUrl)) {
    return { ok: false, message: "App Icon must be a valid image URL or uploaded image." };
  }
  if (!isValidAppAssetUrl(photoUrl)) {
    return { ok: false, message: "Profile / Card Photo must be a valid image URL or uploaded image." };
  }
  if (!isValidAppAssetUrl(splashImageUrl)) {
    return { ok: false, message: "Splash image must be a valid image URL or uploaded image." };
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(rawBg)) {
    return { ok: false, message: "Splash background color must be a valid 6-digit hex color (e.g. #060a12)." };
  }

  const techIds = generateAndroidTechnicalIds(
    appName,
    appGenState.selectedClientId || appName,
    allClients
  );

  if (!/^com\.kds\.card\.[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(techIds.packageId)) {
    return { ok: false, message: "Failed to generate a valid Android package identifier." };
  }

  return {
    ok: true,
    config: {
      clientId: appGenState.selectedClientId || null,
      appName,
      cardUrl: sanitizedCardUrl,
      profile,
      iconUrl,
      photoUrl,
      splashImageUrl,
      splashTitle,
      splashBgColor: rawBg,
      internalAppId: techIds.internalAppId,
      packageId: techIds.packageId,
      safeFileName: techIds.safeFileName,
      versionName: "1.0.0",
      versionCode: 1,
      minSdkVersion: 24,
      targetSdkVersion: 34
    }
  };
}

// Client-side fallback ZIP/APK builder so APK generation works on both Node.js and static hosts
const CLIENT_CRC_TABLE = (() => {
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

function crc32Bytes(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CLIENT_CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function generateClientApk(e) {
  if (e && typeof e.preventDefault === "function") e.preventDefault();

  const msgEl = qs("#appGenValidationMsg");
  if (msgEl) {
    msgEl.textContent = "";
    msgEl.classList.add("hidden");
  }

  // Ensure admin is authenticated before allowing APK generation
  if (window.supabaseClient) {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const session = sessionData?.session;
    let isAuthorizedAdmin = false;
    if (session?.user?.id) {
      const { data: adminRecord, error: adminErr } = await supabaseClient
        .from("admin_users")
        .select("user_id,email")
        .eq("user_id", session.user.id)
        .maybeSingle();
      isAuthorizedAdmin = Boolean(!adminErr && adminRecord);
    }
    if (!session || !isAuthorizedAdmin) {
      const errMsg = "Authentication required: Only authorized administrators can generate APKs.";
      if (msgEl) {
        msgEl.textContent = errMsg;
        msgEl.classList.remove("hidden");
      }
      showToast(errMsg, "error");
      return null;
    }
  }

  const validation = validateAppGeneratorConfig();
  if (!validation.ok) {
    if (msgEl) {
      msgEl.textContent = validation.message;
      msgEl.classList.remove("hidden");
    }
    showToast(validation.message, "error");
    return null;
  }

  const config = validation.config;
  const genBtn = qs("#generateApkBtn");
  if (genBtn) {
    genBtn.disabled = true;
    genBtn.innerHTML = `<span>Generating APK...</span>`;
  }

  try {
    let apkBlob = null;

    if (window.supabaseClient && typeof fetch === "function") {
      try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          const response = await fetch("/api/generate-apk", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              appName: config.appName,
              cardUrl: config.cardUrl,
              profile: config.profile,
              packageId: config.packageId,
              internalAppId: config.internalAppId,
              splashTitle: config.splashTitle,
              splashBgColor: config.splashBgColor,
              iconUrl: config.iconUrl,
              photoUrl: config.photoUrl,
              splashImageUrl: config.splashImageUrl,
              iconDataUrl: config.iconUrl.startsWith("data:image/") ? config.iconUrl : "",
              photoDataUrl: config.photoUrl.startsWith("data:image/") ? config.photoUrl : "",
              splashDataUrl: config.splashImageUrl.startsWith("data:image/") ? config.splashImageUrl : ""
            })
          });
          if (response.ok) {
            apkBlob = await response.blob();
          }
        }
      } catch (_) {
        // Fallback to in-memory client APK builder below
      }
    }

    const apkBytes = buildClientApkBytes(config);
    if (!apkBlob) {
      apkBlob = new Blob([apkBytes], { type: "application/vnd.android.package-archive" });
    }

    const buildRecord = {
      ...config,
      apkBytes,
      apkBlob,
      generatedAt: new Date().toISOString()
    };

    appGenState.lastGeneratedBuild = buildRecord;

    const resultBox = qs("#appGenResultBox");
    const resName = qs("#resultAppName");
    const resUrl = qs("#resultCardUrl");
    const resProfile = qs("#resultProfile");

    if (resName) resName.textContent = config.appName;
    if (resUrl) resUrl.textContent = config.cardUrl;
    if (resProfile) resProfile.textContent = formatProfileLabel(config.profile);
    if (resultBox) resultBox.classList.remove("hidden");

    showToast(`APK generated for "${config.appName}"`, "success");
    return buildRecord;
  } catch (err) {
    showError(err);
    return null;
  } finally {
    if (genBtn) {
      genBtn.disabled = false;
      genBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Generate APK</span>`;
    }
  }
}

function downloadGeneratedApk() {
  const build = appGenState.lastGeneratedBuild;
  if (!build || !build.apkBlob) {
    showToast("Please generate the APK first.", "warn");
    return false;
  }

  const url = typeof URL.createObjectURL === "function" ? URL.createObjectURL(build.apkBlob) : "";
  const a = document.createElement("a");
  a.href = url || "#";
  a.download = build.safeFileName || "kds-digital-card.apk";
  document.body.appendChild(a);
  if (typeof a.click === "function") a.click();
  if (typeof a.remove === "function") a.remove();
  if (url && typeof URL.revokeObjectURL === "function") {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  showToast(`Downloading ${a.download}`, "success");
  return true;
}

async function openGeneratedAppSimulator(buildToOpen = appGenState.lastGeneratedBuild) {
  const build = buildToOpen || appGenState.lastGeneratedBuild;
  if (!build) {
    showToast("Generate an APK first to open the generated App.", "warn");
    return null;
  }

  const backdrop = qs("#generatedAppViewerBackdrop");
  const titleEl = qs("#generatedAppViewerTitle");
  const subEl = qs("#generatedAppViewerSub");
  const splashOverlay = qs("#generatedAppSplashOverlay");
  const splashTitleEl = qs("#generatedAppSplashTitle");
  const iframeEl = qs("#generatedAppIframe");

  if (titleEl) titleEl.textContent = build.appName;
  if (subEl) subEl.textContent = `${formatProfileLabel(build.profile)} • ${build.cardUrl}`;
  if (splashOverlay) {
    splashOverlay.style.backgroundColor = build.splashBgColor || "#060a12";
    splashOverlay.classList.remove("hidden");
  }
  if (splashTitleEl) splashTitleEl.textContent = build.splashTitle || build.appName;
  updateAssetPreviewThumb(
    "#generatedAppSplashImg",
    "#generatedAppSplashInitials",
    build.splashImageUrl || build.iconUrl,
    build.splashTitle || build.appName
  );

  if (iframeEl) {
    iframeEl.src = build.cardUrl;
  }
  if (backdrop) {
    backdrop.classList.remove("hidden");
  }

  setTimeout(() => {
    if (splashOverlay) splashOverlay.classList.add("hidden");
  }, 600);

  // Also resolve the live card state from the configured Card URL so callers/tests
  // can inspect the exact live data and subscription status opened by the generated App.
  try {
    const parsed = new URL(build.cardUrl, location.origin);
    const slugOrId = parsed.searchParams.get("slug") || parsed.searchParams.get("id") || build.clientId;
    const urlProfile = parsed.searchParams.get("profile") || build.profile;
    const liveClient = slugOrId ? await getClient(slugOrId) : null;
    const liveSub = liveClient ? subscriptionState(liveClient) : { status: "not_found", label: "Not Found" };
    return {
      openedUrl: build.cardUrl,
      profile: urlProfile,
      liveClient,
      subscriptionStatus: liveSub.status,
      isAvailable: liveSub.status === "active"
    };
  } catch (_) {
    return {
      openedUrl: build.cardUrl,
      profile: build.profile,
      liveClient: null,
      subscriptionStatus: "unknown",
      isAvailable: false
    };
  }
}

window.generateClientApk = generateClientApk;
window.downloadGeneratedApk = downloadGeneratedApk;
window.openGeneratedAppSimulator = openGeneratedAppSimulator;
window.appGenState = appGenState;

function initAppGeneratorEvents() {
  const navClientsBtn = qs("#navClientsBtn");
  const navAppBtn = qs("#navAppGeneratorBtn");

  if (navClientsBtn) {
    navClientsBtn.addEventListener("click", () => {
      navClientsBtn.classList.add("active");
      if (navAppBtn) navAppBtn.classList.remove("active");
      const target = qs(".admin-wrap-inner");
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (navAppBtn) {
    navAppBtn.addEventListener("click", () => {
      navAppBtn.classList.add("active");
      if (navClientsBtn) navClientsBtn.classList.remove("active");
      populateAppGenClientDropdown();
      if (!appGenState.selectedClientId && allClients.length > 0) {
        loadClientIntoAppGenerator(allClients[0]);
      }
      const section = qs("#appGeneratorSection");
      if (section && typeof section.scrollIntoView === "function") {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  const clientSearchInput = qs("#appGenClientSearch");
  if (clientSearchInput) {
    clientSearchInput.addEventListener("input", function () {
      populateAppGenClientDropdown(this.value);
    });
  }

  const clientSelect = qs("#appGenClientSelect");
  if (clientSelect) {
    clientSelect.addEventListener("change", async function () {
      const id = this.value;
      if (!id) return;
      const c = await findAdminClient(id);
      if (c) loadClientIntoAppGenerator(c);
    });
  }

  const resetDefaultsBtn = qs("#appGenResetDefaultsBtn");
  if (resetDefaultsBtn) {
    resetDefaultsBtn.addEventListener("click", async () => {
      if (!appGenState.selectedClientId) {
        showToast("Select a client first.", "warn");
        return;
      }
      const c = await findAdminClient(appGenState.selectedClientId);
      if (c) {
        loadClientIntoAppGenerator(c);
        showToast("Reloaded client defaults into App Generator.", "info");
      }
    });
  }

  const appNameInput = qs("#appGenAppName");
  if (appNameInput) {
    appNameInput.addEventListener("input", function () {
      appGenState.appName = this.value;
      if (!appGenState.splashTitleManuallyEdited) {
        appGenState.splashTitle = this.value;
        const splashTitleInput = qs("#appGenSplashTitle");
        if (splashTitleInput) splashTitleInput.value = this.value;
      }
      updateAppGeneratorLivePreview();
    });
  }

  document.querySelectorAll("#appGenProfileGroup [data-app-profile]").forEach((label) => {
    label.addEventListener("click", () => {
      const profile = label.getAttribute("data-app-profile");
      setAppGenProfileSelection(profile, true);
    });
  });

  const cardUrlInput = qs("#appGenCardUrl");
  if (cardUrlInput) {
    cardUrlInput.addEventListener("input", function () {
      appGenState.cardUrl = this.value.trim();
      appGenState.urlManuallyEdited = true;
      updateAppGeneratorLivePreview();
    });
  }

  const resetUrlBtn = qs("#appGenResetUrlBtn");
  if (resetUrlBtn) {
    resetUrlBtn.addEventListener("click", () => {
      appGenState.urlManuallyEdited = false;
      if (appGenState.sourceClient) {
        const defaultUrl = getDefaultCardUrlForProfile(appGenState.sourceClient, appGenState.profile);
        appGenState.cardUrl = defaultUrl;
        if (cardUrlInput) cardUrlInput.value = defaultUrl;
        updateAppGeneratorLivePreview();
      }
    });
  }

  // Image upload & URL inputs for Icon, Photo, and Splash
  setupAppGenImageInput("#appGenIconFile", "#appGenIconUrl", "iconUrl", 512);
  setupAppGenImageInput("#appGenPhotoFile", "#appGenPhotoUrl", "photoUrl", 800);
  setupAppGenImageInput("#appGenSplashImageFile", "#appGenSplashImageUrl", "splashImageUrl", 800);

  // Quick asset actions — App Icon
  const iconUseLogoBtn = qs("#appGenIconUseLogoBtn");
  if (iconUseLogoBtn) {
    iconUseLogoBtn.addEventListener("click", () => {
      const url = appGenState.sourceClient?.companyLogo || "";
      if (!url) {
        showToast("Selected client does not have a company logo.", "warn");
        return;
      }
      appGenState.iconUrl = url;
      if (qs("#appGenIconUrl")) qs("#appGenIconUrl").value = url;
      updateAppGeneratorLivePreview();
    });
  }

  const iconUsePhotoBtn = qs("#appGenIconUsePhotoBtn");
  if (iconUsePhotoBtn) {
    iconUsePhotoBtn.addEventListener("click", () => {
      const url = appGenState.sourceClient?.photo || "";
      if (!url) {
        showToast("Selected client does not have a profile photo.", "warn");
        return;
      }
      appGenState.iconUrl = url;
      if (qs("#appGenIconUrl")) qs("#appGenIconUrl").value = url;
      updateAppGeneratorLivePreview();
    });
  }

  const iconRemoveBtn = qs("#appGenIconRemoveBtn");
  if (iconRemoveBtn) {
    iconRemoveBtn.addEventListener("click", () => {
      appGenState.iconUrl = "";
      if (qs("#appGenIconUrl")) qs("#appGenIconUrl").value = "";
      updateAppGeneratorLivePreview();
    });
  }

  // Quick asset actions — Profile / Card Photo
  const photoUseClientBtn = qs("#appGenPhotoUseClientBtn");
  if (photoUseClientBtn) {
    photoUseClientBtn.addEventListener("click", () => {
      const url = appGenState.sourceClient?.photo || appGenState.sourceClient?.companyLogo || "";
      if (!url) {
        showToast("Selected client does not have a saved photo.", "warn");
        return;
      }
      appGenState.photoUrl = url;
      if (qs("#appGenPhotoUrl")) qs("#appGenPhotoUrl").value = url;
      updateAppGeneratorLivePreview();
    });
  }

  const photoRemoveBtn = qs("#appGenPhotoRemoveBtn");
  if (photoRemoveBtn) {
    photoRemoveBtn.addEventListener("click", () => {
      appGenState.photoUrl = "";
      if (qs("#appGenPhotoUrl")) qs("#appGenPhotoUrl").value = "";
      updateAppGeneratorLivePreview();
    });
  }

  // Quick asset actions — Splash Screen
  const splashUseIconBtn = qs("#appGenSplashUseIconBtn");
  if (splashUseIconBtn) {
    splashUseIconBtn.addEventListener("click", () => {
      const url = appGenState.iconUrl || appGenState.sourceClient?.companyLogo || appGenState.sourceClient?.photo || "";
      appGenState.splashImageUrl = url;
      if (qs("#appGenSplashImageUrl")) qs("#appGenSplashImageUrl").value = url;
      updateAppGeneratorLivePreview();
    });
  }

  const splashUseLogoBtn = qs("#appGenSplashUseLogoBtn");
  if (splashUseLogoBtn) {
    splashUseLogoBtn.addEventListener("click", () => {
      const url = appGenState.sourceClient?.companyLogo || "";
      if (!url) {
        showToast("Selected client does not have a company logo.", "warn");
        return;
      }
      appGenState.splashImageUrl = url;
      if (qs("#appGenSplashImageUrl")) qs("#appGenSplashImageUrl").value = url;
      updateAppGeneratorLivePreview();
    });
  }

  const splashRemoveBtn = qs("#appGenSplashRemoveBtn");
  if (splashRemoveBtn) {
    splashRemoveBtn.addEventListener("click", () => {
      appGenState.splashImageUrl = "";
      if (qs("#appGenSplashImageUrl")) qs("#appGenSplashImageUrl").value = "";
      updateAppGeneratorLivePreview();
    });
  }

  const splashTitleInput = qs("#appGenSplashTitle");
  if (splashTitleInput) {
    splashTitleInput.addEventListener("input", function () {
      appGenState.splashTitle = this.value;
      appGenState.splashTitleManuallyEdited = Boolean(this.value.trim());
      updateAppGeneratorLivePreview();
    });
  }

  const bgColorInput = qs("#appGenSplashBgColor");
  const bgHexInput = qs("#appGenSplashBgHex");
  if (bgColorInput && bgHexInput) {
    bgColorInput.addEventListener("input", function () {
      bgHexInput.value = this.value;
      appGenState.splashBgColor = this.value;
      updateAppGeneratorLivePreview();
    });
    bgHexInput.addEventListener("input", function () {
      const val = this.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        bgColorInput.value = val;
        appGenState.splashBgColor = val;
        updateAppGeneratorLivePreview();
      }
    });
  }

  const appGenForm = qs("#appGeneratorForm");
  if (appGenForm) {
    appGenForm.addEventListener("submit", generateClientApk);
  }

  const downloadBtn = qs("#downloadApkBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", downloadGeneratedApk);
  }

  const openAppBtn = qs("#openGeneratedAppBtn");
  if (openAppBtn) {
    openAppBtn.addEventListener("click", () => openGeneratedAppSimulator());
  }

  const regenBtn = qs("#regenerateApkBtn");
  if (regenBtn) {
    regenBtn.addEventListener("click", generateClientApk);
  }

  const closeViewerBtn = qs("#generatedAppViewerCloseBtn");
  if (closeViewerBtn) {
    closeViewerBtn.addEventListener("click", () => {
      const backdrop = qs("#generatedAppViewerBackdrop");
      const iframe = qs("#generatedAppIframe");
      if (backdrop) backdrop.classList.add("hidden");
      if (iframe) iframe.src = "about:blank";
    });
  }
}

initAppGeneratorEvents();

// Start Admin
initAdmin();
