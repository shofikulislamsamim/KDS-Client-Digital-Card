/* KDS Client Card — Reference Design Renderer
 * Mirrors the original Digital-Visiting-Card visual system while keeping
 * the reusable multi-client Supabase data model.
 */
(function () {
  function socialLinks(items) {
    return (items || [])
      .filter(Boolean)
      .map(([key, url, label]) => {
        const safe = sanitizeUrl(url);
        if (!safe) return "";
        return `<a class="social-icon-link" href="${esc(safe)}" target="_blank" rel="noopener noreferrer" data-tooltip="${esc(label)}" aria-label="${esc(label)}">${SVG_ICONS[key] || SVG_ICONS.share}</a>`;
      })
      .join("");
  }

  function serviceCard(name) {
    return `
      <div class="service-card">
        <div class="service-icon-box">${getServiceIcon(name)}</div>
        <div class="service-title">${esc(name)}</div>
        <div class="service-desc">Professional ${esc(name)} services tailored to your goals.</div>
      </div>
    `;
  }

  function footerMotto() {
    return `
      <div class="kds-card-bottom-motto" style="text-align:center;padding:16px 12px 4px;">
        <div class="motto-text">CONNECT &nbsp; • &nbsp; COLLABORATE &nbsp; • &nbsp; GROW</div>
      </div>
    `;
  }

  function qrBlock(id, title, desc, profileUrl, downloadName) {
    return `
      <div class="qr-card" id="${id}">
        <div class="qr-frame"><div id="clientQrCanvas" class="qr-generated"></div></div>
        <h3 class="qr-title">${esc(title)}</h3>
        <p class="qr-desc">${esc(desc)}</p>
        <div class="qr-btn-group">
          <button type="button" id="downloadQr" class="btn-secondary">
            ${SVG_ICONS.download}<span>Download QR</span>
          </button>
          <button type="button" id="shareCard" class="btn-secondary">
            ${SVG_ICONS.share}<span>Share Card</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderPersonal(c, isConnected) {
    const phone = String(c.phone || c.whatsapp || "").replace(/[^\d+]/g, "");
    const wa = normalizeWhatsAppNumber(c.whatsapp || c.phone);
    const website = sanitizeUrl(c.website);
    const socials = socialLinks([
      ["facebook", c.facebook, "Facebook"],
      ["instagram", c.instagram, "Instagram"],
      ["linkedin", c.linkedin, "LinkedIn"],
      ["youtube", c.youtube, "YouTube"],
      ["tiktok", c.tiktok, "TikTok"]
    ]);

    const actions = [];
    if (phone) actions.push(`
      <a class="btn-action action-call" href="tel:${esc(phone)}">
        ${SVG_ICONS.call}<span>Call</span>
      </a>`);
    if (wa) actions.push(`
      <a class="btn-action action-whatsapp" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener noreferrer">
        ${SVG_ICONS.whatsapp}<span>WhatsApp</span>
      </a>`);
    if (c.email) actions.push(`
      <a class="btn-action action-email" href="mailto:${esc(c.email)}">
        ${SVG_ICONS.email}<span>Email</span>
      </a>`);
    actions.push(`
      <button class="btn-action action-vcard" id="quickShareBtn" type="button">
        ${SVG_ICONS.vcard}<span>Save</span>
      </button>`);

    const businessLink = isConnected ? `
      <a href="./card.html?slug=${encodeURIComponent(c.slug || c.id)}&profile=business" class="card-nav-switch">
        <div class="switch-content">
          <img src="${esc(c.companyLogo || "")}" alt="Company Logo" class="switch-logo" onerror="this.src=''; this.style.visibility='hidden';" />
          <div class="switch-texts">
            <span class="switch-title">${esc(c.company || "Business Profile")}</span>
            <span class="switch-subtitle">View Corporate Profile &rarr;</span>
          </div>
        </div>
        <div class="switch-arrow">&rarr;</div>
      </a>
    ` : "";

    return `
      <div class="page-container" id="personalPageContainer">
        <div class="profile-card" id="cardPersonal">
          <div class="profile-cover" id="personalProfileCover" aria-hidden="true">
            ${c.cover ? `<img class="profile-cover-image" src="${esc(c.cover)}" alt="">` : '<div class="profile-cover-placeholder"></div>'}
          </div>

          <div class="card-header">
            <div class="avatar-wrapper">
              <img id="personalAvatar" src="${esc(c.photo || "")}" alt="${esc(c.name)}" class="avatar-img">
              <div class="status-badge" title="Available for business inquiries"></div>
            </div>
            <h1 class="founder-name" id="personalName">${esc(c.name)}</h1>
            <div class="founder-title" id="personalDesignation">${esc(c.designation || "")}</div>
            ${c.company ? `<div class="company-badge" id="personalCompany">${esc(c.company)}</div>` : ""}
            ${c.bio ? `<p class="founder-bio" id="personalBio">${esc(c.bio)}</p>` : ""}
          </div>

          <div class="actions-grid">
            ${actions.join("")}
          </div>

          <div class="save-tools">
            <button id="saveContactMain" class="btn-save-contact" type="button">
              ${SVG_ICONS.vcard} Save Contact to Phone
            </button>
          </div>

          <div class="socials-section">
            <div class="section-title">Connect on Social Media</div>
            <div class="social-icons-list">${socials}</div>
          </div>

          ${businessLink}
        </div>

        ${qrBlock("cardQr", "Scan to Connect", "Scan with your smartphone camera to instantly view or share this digital visiting card.", getCardFullUrl(c, "personal"), slugify(c.name))}
        <footer class="page-footer"><div>&copy; 2026 Khan Digital Solution. All rights reserved.</div></footer>
      </div>
    `;
  }

  function renderBusiness(c) {
    const phone = String(c.businessPhone || "").replace(/[^\d+]/g, "");
    const wa = normalizeWhatsAppNumber(c.businessWhatsapp);
    const email = c.businessEmail || "";
    const website = sanitizeUrl(c.businessWebsite);
    const mapUrl = c.businessAddress
      ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(c.businessAddress)
      : "";

    const actions = [];
    if (phone) actions.push(`
      <a class="btn-action action-call" href="tel:${esc(phone)}">
        ${SVG_ICONS.call}<span>Call Us</span>
      </a>`);
    if (wa) actions.push(`
      <a class="btn-action action-whatsapp" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener noreferrer">
        ${SVG_ICONS.whatsapp}<span>WhatsApp</span>
      </a>`);
    if (email) actions.push(`
      <a class="btn-action action-email" href="mailto:${esc(email)}">
        ${SVG_ICONS.email}<span>Inquiries</span>
      </a>`);
    if (website) actions.push(`
      <a class="btn-action action-vcard" href="${esc(website)}" target="_blank" rel="noopener noreferrer">
        ${SVG_ICONS.website}<span>Website</span>
      </a>`);
    else if (mapUrl) actions.push(`
      <a class="btn-action action-vcard" href="${esc(mapUrl)}" target="_blank" rel="noopener noreferrer">
        ${SVG_ICONS.location}<span>Location</span>
      </a>`);

    const socials = socialLinks([
      ["facebook", c.businessFacebook, "Facebook"],
      ["instagram", c.businessInstagram, "Instagram"],
      ["linkedin", c.businessLinkedin, "LinkedIn"],
      ["youtube", c.businessYoutube, "YouTube"],
      ["tiktok", c.businessTiktok, "TikTok"]
    ]);

    const services = String(c.businessServices || "")
      .split(",").map(x => x.trim()).filter(Boolean);

    return `
      <div class="page-container business-container" id="businessPageContainer">
        <div class="business-hero" id="businessHero">
          <div class="business-profile-cover profile-cover" id="businessProfileCover" aria-hidden="true">
            ${c.cover ? `<img class="profile-cover-image" src="${esc(c.cover)}" alt="">` : '<div class="profile-cover-placeholder"></div>'}
          </div>

          <div class="kds-logo-wrapper business-profile-logo">
            ${c.companyLogo
              ? `<img id="businessLogo" src="${esc(c.companyLogo)}" alt="${esc(c.company || "Business")}" class="kds-logo-img">`
              : '<div class="kds-logo-img" style="display:flex;align-items:center;justify-content:center;color:#38bdf8;font-weight:800;font-size:1.3rem;">KDS</div>'}
          </div>

          <h1 class="business-name" id="businessName">${esc(c.company || "Business Profile")}</h1>
          ${c.tagline ? `<div class="business-tagline" id="businessTagline">${esc(c.tagline)}</div>` : ""}
          ${c.businessBio ? `<p class="business-about" id="businessAbout">${esc(c.businessBio)}</p>` : ""}

          <div class="actions-grid" style="max-width:480px;margin:0 auto 24px;padding:0;">
            ${actions.join("")}
            ${c.template === "personal_business" ? `<a href="./card.html?slug=${encodeURIComponent(c.slug || c.id)}" class="btn-action action-vcard" title="Personal Visiting Card">
              ${SVG_ICONS.user}<span>Personal</span>
            </a>` : ""}
          </div>

          <div style="margin-top:8px;">
            <div class="section-title" style="justify-content:center;">Connect on Social Media</div>
            <div class="social-icons-list" style="justify-content:center;">${socials}</div>
          </div>
        </div>

        <div class="services-section">
          <div class="section-title">Our Premium Services</div>
          <div class="services-grid">
            ${services.map(serviceCard).join("")}
          </div>
        </div>

        ${qrBlock("cardBusinessQr", "Share Business Profile", "Scan to share or bookmark this business profile and services.", getCardFullUrl(c, "business"), slugify(c.company || c.name) + "-business")}

        ${c.template === "personal_business" ? `<div style="text-align:center;margin-top:10px;"><a href="./card.html?slug=${encodeURIComponent(c.slug || c.id)}" class="btn-save-contact" style="margin:0 auto;max-width:360px;">${SVG_ICONS.user} Back to Personal Visiting Card</a></div>` : ""}
        <footer class="page-footer"><div>&copy; 2026 Khan Digital Solution. All rights reserved.</div></footer>
      </div>
    `;
  }

  async function referenceRenderCard() {
    const root = qs("#cardRoot");
    if (!root) return;

    const params = new URLSearchParams(location.search);
    const identifier = params.get("slug") || params.get("id") || params.get("preview");
    const isDemo = !identifier || identifier === "demo" || params.has("preview");
    const c = await getClient(identifier || "demo");
    if (!c) {
      root.innerHTML = '<div class="page-container"><section class="card-status-box not-found"><h2>Client Card পাওয়া যায়নি</h2><p>এই লিংকের সাথে কোনো সক্রিয় ডিজিটাল কার্ড পাওয়া যায়নি।</p></section></div>';
      return;
    }

    const connected = c.template === "personal_business";
    const requestedBusiness = params.get("profile") === "business";
    // Business view is available for Business-only cards by default, and for
    // Personal + Business cards only when explicitly requested.
    const isBusiness = c.template === "business_only"
      || ((c.template === "business" || connected) && requestedBusiness);

    document.title = isBusiness
      ? (c.company || "Business Profile") + " • Company Profile"
      : c.name + " • Digital Visiting Card";

    root.innerHTML = isBusiness ? renderBusiness(c) : renderPersonal(c, connected);

    const profile = isBusiness ? "business" : "personal";
    const profileUrl = getCardFullUrl(c, profile);

    const qrContainer = qs("#clientQrCanvas");
    if (qrContainer && typeof QRCode !== "undefined") {
      qrContainer.innerHTML = "";
      new QRCode(qrContainer, {
        text: profileUrl,
        width: 200,
        height: 200,
        colorDark: "#050b18",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
      // QRCode.js may create more than one render node (canvas/image).
      // Keep exactly ONE node so two QR codes can never appear side-by-side.
      const keepSingleQrNode = () => {
        const canvas = qrContainer.querySelector("canvas");
        const image = qrContainer.querySelector("img");
        const keep = canvas || image;
        Array.from(qrContainer.children).forEach((node) => {
          if (node !== keep) node.remove();
        });
        if (keep) {
          keep.style.display = "block";
          keep.style.width = "200px";
          keep.style.height = "200px";
          keep.style.maxWidth = "200px";
          keep.style.maxHeight = "200px";
          keep.style.flex = "0 0 200px";
        }
      };
      keepSingleQrNode();
      requestAnimationFrame(keepSingleQrNode);
      setTimeout(keepSingleQrNode, 50);
    }

    const saveBtn = qs("#saveContactMain");
    if (saveBtn) saveBtn.onclick = () => downloadContact(c);

    const shareBtn = qs("#shareCard");
    if (shareBtn) shareBtn.onclick = async () => {
      try {
        await navigator.share({
          title: document.title,
          text: document.title,
          url: profileUrl
        });
      } catch (e) {
        try {
          await navigator.clipboard.writeText(profileUrl);
          alert("Profile link copied to clipboard.");
        } catch (_) {}
      }
    };

    const downloadBtn = qs("#downloadQr");
    if (downloadBtn) downloadBtn.onclick = () => {
      const canvas = qs("#clientQrCanvas canvas");
      if (!canvas) return;
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = slugify(isBusiness ? (c.company || c.name) + "-business" : c.name) + "-QR.png";
      a.click();
    };

    const quickShare = qs("#quickShareBtn");
    if (quickShare) quickShare.onclick = async () => {
      try {
        await navigator.share({title: document.title, text: document.title, url: profileUrl});
      } catch (e) {
        try { await navigator.clipboard.writeText(profileUrl); } catch (_) {}
      }
    };
  }

  window.renderCard = referenceRenderCard;
})();