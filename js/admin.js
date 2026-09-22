const form = qs("#clientForm");
let selectedTemplate = "personal";
let editingClient = null;
let allClients = [];

const ADMIN_ICONS = {
  copy: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  external: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  power: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>`,
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
}

function updateImagePreviews() {
  const previewMap = [
    ["#photo", "#photoThumb", "#photoPreviewWrap"],
    ["#cover", "#coverThumb", "#coverPreviewWrap"],
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
  if (qs("#duration")) qs("#duration").value = "30";
  if (qs("#customDays")) qs("#customDays").value = "";
  if (qs("#customDaysWrap")) qs("#customDaysWrap").classList.add("hidden");
  updateImagePreviews();
  renderSubscriptionFields({ subscriptionActive: true, subscriptionStart: null, subscriptionEnd: null });
}

function fillForm(c) {
  editingClient = c;
  const fields = [
    "clientId",
    "name",
    "designation",
    "phone",
    "whatsapp",
    "email",
    "bio",
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
    "businessAddress",
    "businessWebsite",
    "businessServices",
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
    else el.value = c[k] || "";
  });
  setTemplate(c.template || "personal");
  if (qs("#formTitle")) qs("#formTitle").textContent = "Edit: " + (c.name || "Client");
  if (qs("#formSubtitle")) qs("#formSubtitle").textContent = "Update client data and manage subscription";
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
  if (actBtn) actBtn.textContent = s.status === "active" ? "Extend / Renew" : "Activate";
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
    box.innerHTML = '<div class="empty-list"><div class="empty-icon">📭</div><p>এখনো কোনো client তৈরি হয়নি। বাম পাশের ফর্ম থেকে নতুন ক্লায়েন্ট যোগ করুন।</p></div>';
    return;
  }

  box.innerHTML = list
    .map((c) => {
      const s = subscriptionState(c);
      const isBiz = c.template === "business" || c.template === "personal_business" || c.template === "business_only";
      const fullUrl = getCardFullUrl(c);

      return `
        <div class="client-item" data-id="${esc(c.id)}">
          <div class="client-item-left">
            <div class="client-item-avatar">
              ${
                c.photo
                  ? `<img src="${esc(sanitizeUrl(c.photo))}" alt="${esc(c.name)}">`
                  : `<div class="avatar-ph">${esc(c.name ? c.name.charAt(0).toUpperCase() : "C")}</div>`
              }
            </div>
            <div class="client-item-meta">
              <div class="client-item-name-row">
                <strong class="client-item-name">${esc(c.name)}</strong>
                <span class="client-template-pill ${isBiz ? "business" : "personal"}">${c.template === "personal_business" ? "Personal + Business" : c.template === "business_only" ? "Business" : "Personal"}</span>
              </div>
              <div class="client-item-sub">
                ${c.designation ? `<span>${esc(c.designation)}</span>` : ""}
                ${c.company ? `<span class="company-name">• ${esc(c.company)}</span>` : ""}
              </div>
              <div class="list-sub">
                <span class="status-badge ${s.status}">${esc(s.label)}</span>
                <span class="expiry-text">Expiry: ${esc(c.subscriptionEnd ? formatDate(c.subscriptionEnd) : "No expiry")}</span>
              </div>
            </div>
          </div>
          <div class="client-actions">
            ${c.template === "personal_business" ? `
              <a class="mini-btn view" href="${cardUrl(c)}" target="_blank" title="Open Personal Profile">
                ${ADMIN_ICONS.external}<span>Personal</span>
              </a>
              <a class="mini-btn view" href="${getCardFullUrl(c, "business")}" target="_blank" title="Open Business Profile">
                ${ADMIN_ICONS.external}<span>Business</span>
              </a>
            ` : `
              <a class="mini-btn view" href="${c.template === "business_only" ? getCardFullUrl(c, "business") : cardUrl(c)}" target="_blank" title="Open Card in New Tab">
                ${ADMIN_ICONS.external}<span>View</span>
              </a>
            `}
            <button class="mini-btn copy" onclick="copyCardLink('${esc(fullUrl)}')" type="button" title="Copy Card Link">
              ${ADMIN_ICONS.copy}<span>Copy</span>
            </button>
            <button class="mini-btn edit" onclick="editClient('${esc(c.id)}')" type="button" title="Edit Client Data">
              ${ADMIN_ICONS.edit}<span>Edit</span>
            </button>
            <button class="mini-btn sub" onclick="quickActivate('${esc(c.id)}')" type="button" title="Activate or Renew">
              ${ADMIN_ICONS.power}<span>Renew</span>
            </button>
            <button class="mini-btn warn" onclick="quickDeactivate('${esc(c.id)}')" type="button" title="Deactivate Card">
              Off
            </button>
            <button class="mini-btn danger" onclick="deleteClient('${esc(c.id)}')" type="button" title="Delete Card">
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
      (c.email || "").toLowerCase().includes(query)
    );
  });
  renderListItems(filtered);
}

window.copyCardLink = async function (url) {
  try {
    await navigator.clipboard.writeText(url);
    showToast("Card link copied to clipboard!", "success");
  } catch (e) {
    prompt("Card link:", url);
  }
};

window.editClient = async function (id) {
  try {
    const c = await getClient(id);
    if (c) {
      fillForm(c);
      const formEl = qs("#clientForm");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      showToast(`Editing "${c.name}"`, "info");
    }
  } catch (e) {
    showError(e);
  }
};

window.quickActivate = async function (id) {
  try {
    const c = await getClient(id);
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
        await saveClient(c);
        if (editingClient && editingClient.id === id) {
          editingClient = c;
          fillForm(c);
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
  try {
    const c = await getClient(id);
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
        await saveClient(c);
        if (editingClient && editingClient.id === id) {
          editingClient = c;
          fillForm(c);
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
  try {
    const c = await getClient(id);
    const clientName = c ? c.name : "This client";

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

    if (!file.type.startsWith("image/")) {
      showToast("Please select a valid image file.", "warn");
      return;
    }

    showToast("Processing image...", "info");

    try {
      // 1. First attempt: Upload to Supabase Storage if available
      let uploadedUrl = null;
      if (window.supabaseClient) {
        try {
          const ext = file.name.split(".").pop() || "jpg";
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
          const { data, error } = await supabaseClient.storage
            .from("card-assets")
            .upload(`uploads/${fileName}`, file, { cacheControl: "3600", upsert: true });

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

      // Do not fall back to data URLs. Public cards must reference a real
      // Supabase Storage asset so images remain persistent and cacheable.
      if (!uploadedUrl) {
        throw new Error("Image upload failed. Please check your admin session and Storage permissions, then try again.");
      }

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

    const data = editingClient || {
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
      "phone",
      "whatsapp",
      "email",
      "bio",
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
      "businessAddress",
      "businessWebsite",
      "businessServices",
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

    if (selectedTemplate === "business_only") {
      data.name = data.company || data.name || "Business";
    }

    try {
      editingClient = await saveClient(data);
      fillForm(editingClient);
      await loadAndRenderList();
      showToast(isNew ? "Client created and activated successfully!" : "Client updated successfully!", "success");
    } catch (e) {
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
  if (qs("#loginPanel")) qs("#loginPanel").classList.remove("hidden");
  if (qs("#unauthorizedPanel")) qs("#unauthorizedPanel").classList.add("hidden");
  if (qs("#adminApp")) qs("#adminApp").classList.add("hidden");
  if (qs("#logoutBtn")) qs("#logoutBtn").classList.add("hidden");
  if (message && qs("#loginMessage")) qs("#loginMessage").textContent = message;
}

function showUnauthorized(email = "") {
  if (qs("#loginPanel")) qs("#loginPanel").classList.add("hidden");
  if (qs("#adminApp")) qs("#adminApp").classList.add("hidden");
  if (qs("#unauthorizedPanel")) qs("#unauthorizedPanel").classList.remove("hidden");
  if (qs("#logoutBtn")) qs("#logoutBtn").classList.remove("hidden");
  const emailBadge = qs("#unauthorizedEmail");
  if (emailBadge) emailBadge.textContent = email || "Current User";
}

function showAdmin() {
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
  if (window.supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  location.reload();
};

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

// Setup image upload handlers
setupImageUpload("#photoFile", "#photo", "#photoThumb", "#photoPreviewWrap");
setupImageUpload("#coverFile", "#cover", "#coverThumb", "#coverPreviewWrap");
setupImageUpload("#companyLogoFile", "#companyLogo", "#companyLogoThumb", "#companyLogoPreviewWrap");

// Start Admin
initAdmin();
