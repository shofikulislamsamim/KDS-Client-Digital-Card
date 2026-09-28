/* KDS Digital Card — Premium Digital Identity Renderer
 * Preserves the existing multi-client Supabase data model, URLs, and IDs
 * while delivering a cohesive, production-grade Personal & Business identity UI.
 */
(function () {
  let cachedClient = null;
  let cachedIdentifier = null;

  function socialLinks(items) {
    return (items || [])
      .filter(Boolean)
      .map(([key, url, label]) => {
        const safe = sanitizeUrl(url);
        if (!safe) return "";
        return `<a class="social-icon-link" href="${esc(safe)}" target="_blank" rel="noopener noreferrer" data-tooltip="${esc(label)}" aria-label="${esc(label)}">${SVG_ICONS[key] || SVG_ICONS.share}</a>`;
      })
      .filter(Boolean)
      .join("");
  }

  function parseBusinessServices(value, fallbackServices = "") {
    if (Array.isArray(value)) {
      return value
        .map((item) => ({
          name: String(item?.name || item?.title || "").trim(),
          description: String(item?.description || item?.desc || "").trim()
        }))
        .filter((item) => item.name);
    }

    const raw = String(value || "").trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parseBusinessServices(parsed);
      } catch (_) {
        // Legacy comma-separated service data
      }

      return raw
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({ name, description: "" }));
    }

    const legacyRaw = String(fallbackServices || "").trim();
    if (!legacyRaw) return [];
    return legacyRaw
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name, description: "" }));
  }

  function serviceCard(service, index) {
    const name = String(service?.name || "").trim();
    const rawDesc = String(service?.description || "").trim();
    const description = rawDesc === "Professional service" ? "" : rawDesc;

    return `
      <article class="service-card">
        <div class="kds-service-card-top">
          <div class="service-icon-box">${getServiceIcon(name)}</div>
          <span class="service-number">${String(index + 1).padStart(2, "0")}</span>
        </div>
        <h3 class="service-title">${esc(name)}</h3>
        ${description ? `<p class="service-desc">${esc(description)}</p>` : ""}
      </article>
    `;
  }

  function qrBlock(id, title, desc) {
    return `
      <section class="qr-card" id="${id}" aria-label="${esc(title)}">
        <div class="qr-frame">
          <div id="clientQrCanvas" class="qr-generated" role="img" aria-label="QR Code"></div>
        </div>
        <h2 class="qr-title">${esc(title)}</h2>
        <p class="qr-desc">${esc(desc)}</p>
        <div class="qr-btn-group">
          <button type="button" id="downloadQr" class="btn-secondary">
            ${SVG_ICONS.download}<span>Download QR</span>
          </button>
          <button type="button" id="shareCard" class="btn-secondary">
            ${SVG_ICONS.share}<span>Share Card</span>
          </button>
        </div>
      </section>
    `;
  }

  function renderCoverMarkup(coverUrl, id) {
    const safeCover = sanitizeUrl(coverUrl);
    if (!safeCover) {
      return `
        <div class="profile-cover" id="${id}" aria-hidden="true">
          <div class="profile-cover-placeholder"></div>
        </div>
      `;
    }
    return `
      <div class="profile-cover" id="${id}" aria-hidden="true">
        <img
          class="profile-cover-image"
          src="${esc(safeCover)}"
          alt=""
          referrerpolicy="no-referrer"
          loading="eager"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
        />
        <div class="profile-cover-placeholder" style="display:none;"></div>
      </div>
    `;
  }

  function renderPersonalAvatarMarkup(c) {
    const safePhoto = sanitizeUrl(c.photo);
    const initials = getInitials(c.name || c.company, "KD");
    if (!safePhoto) {
      return `
        <div class="avatar-wrapper">
          <div id="personalAvatar" class="avatar-img avatar-placeholder" aria-hidden="true">${esc(initials)}</div>
        </div>
      `;
    }
    return `
      <div class="avatar-wrapper">
        <img
          id="personalAvatar"
          src="${esc(safePhoto)}"
          alt="${esc(c.name)}"
          class="avatar-img"
          referrerpolicy="no-referrer"
          loading="eager"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div class="avatar-img avatar-placeholder" style="display:none;" aria-hidden="true">${esc(initials)}</div>
      </div>
    `;
  }

  function renderBusinessLogoMarkup(c) {
    const safeLogo = sanitizeUrl(c.companyLogo);
    const initials = getInitials(c.company || c.name, "B");
    if (!safeLogo) {
      return `
        <div class="kds-logo-wrapper business-profile-logo">
          <div class="kds-logo-img kds-logo-placeholder" aria-hidden="true">${esc(initials)}</div>
        </div>
      `;
    }
    return `
      <div class="kds-logo-wrapper business-profile-logo">
        <img
          id="businessLogo"
          src="${esc(safeLogo)}"
          alt="${esc(c.company || "Business")}"
          class="kds-logo-img"
          referrerpolicy="no-referrer"
          loading="eager"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div class="kds-logo-img kds-logo-placeholder" style="display:none;" aria-hidden="true">${esc(initials)}</div>
      </div>
    `;
  }

  function renderSwitchThumbMarkup(imageUrl, label) {
    const safeImg = sanitizeUrl(imageUrl);
    const initials = getInitials(label, "KD");
    if (!safeImg) {
      return `<div class="switch-logo switch-logo-placeholder" aria-hidden="true">${esc(initials)}</div>`;
    }
    return `
      <img
        src="${esc(safeImg)}"
        alt=""
        class="switch-logo"
        referrerpolicy="no-referrer"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
      />
      <div class="switch-logo switch-logo-placeholder" style="display:none;" aria-hidden="true">${esc(initials)}</div>
    `;
  }

  function renderDemoPreviewBar(activeProfile, isDemo) {
    if (!isDemo) return "";
    return `
      <nav class="kds-preview-bar" aria-label="Card view mode">
        <span class="kds-preview-label">Identity View</span>
        <div class="kds-preview-tabs">
          <button type="button" class="kds-preview-tab ${activeProfile === "personal" ? "active" : ""}" data-switch-profile="personal">
            ${SVG_ICONS.user}
            <span>Personal Card</span>
          </button>
          <button type="button" class="kds-preview-tab ${activeProfile === "business" ? "active" : ""}" data-switch-profile="business">
            ${SVG_ICONS.briefcase}
            <span>Business Card</span>
          </button>
        </div>
      </nav>
    `;
  }

  function renderPersonal(c, isConnected, isDemo) {
    const phoneDial = formatDialNumber(c.phone);
    const wa = normalizeWhatsAppNumber(c.whatsapp || c.phone);
    const email = String(c.email || "").trim();

    const socials = socialLinks([
      ["facebook", c.facebook, "Facebook"],
      ["instagram", c.instagram, "Instagram"],
      ["linkedin", c.linkedin, "LinkedIn"],
      ["youtube", c.youtube, "YouTube"],
      ["tiktok", c.tiktok, "TikTok"]
    ]);

    const actions = [];
    if (phoneDial) {
      actions.push(`
        <a class="btn-action action-call" href="tel:${esc(phoneDial)}">
          ${SVG_ICONS.call}<span>Call</span>
        </a>`);
    }
    if (wa) {
      actions.push(`
        <a class="btn-action action-whatsapp" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener noreferrer">
          ${SVG_ICONS.whatsapp}<span>WhatsApp</span>
        </a>`);
    }
    if (email) {
      actions.push(`
        <a class="btn-action action-email" href="mailto:${esc(email)}">
          ${SVG_ICONS.email}<span>Email</span>
        </a>`);
    }
    actions.push(`
      <button class="btn-action action-share" id="quickShareBtn" type="button">
        ${SVG_ICONS.share}<span>Share</span>
      </button>`);

    const businessHref = `./card.html?slug=${encodeURIComponent(c.slug || c.id || "demo")}&profile=business`;
    const businessLink = isConnected
      ? `
      <div class="profile-switcher-wrap">
        <a href="${esc(businessHref)}" class="card-nav-switch" data-switch-profile="business">
          <div class="switch-content">
            ${renderSwitchThumbMarkup(c.companyLogo, c.company || "Business")}
            <div class="switch-texts">
              <span class="switch-kicker">Corporate Identity</span>
              <span class="switch-title">${esc(c.company || "Business Profile")}</span>
              <span class="switch-subtitle">${esc(c.tagline || "View Services & Business Details")}</span>
            </div>
          </div>
          <div class="switch-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
        </a>
      </div>
    `
      : "";

    const designation = String(c.designation || "").trim();
    const company = String(c.company || "").trim();
    const bio = String(c.bio || "").trim();

    return `
      <div class="page-container client-card-container" id="personalPageContainer">
        ${renderDemoPreviewBar("personal", isDemo)}
        <article class="profile-card" id="cardPersonal">
          ${renderCoverMarkup(c.cover, "personalProfileCover")}

          <div class="card-header">
            ${renderPersonalAvatarMarkup(c)}
            <h1 class="founder-name" id="personalName">${esc(c.name || "Digital Identity")}</h1>
            ${designation ? `<div class="founder-title" id="personalDesignation">${esc(designation)}</div>` : ""}
            ${company ? `<div class="company-badge" id="personalCompany">${esc(company)}</div>` : ""}
            ${bio ? `<p class="founder-bio" id="personalBio">${esc(bio)}</p>` : ""}
          </div>

          <div class="actions-grid" data-count="${actions.length}">
            ${actions.join("")}
          </div>

          <div class="save-tools">
            <button id="saveContactMain" class="btn-save-contact" type="button">
              ${SVG_ICONS.vcard}<span>Save Contact</span>
            </button>
          </div>

          ${
            socials
              ? `
          <div class="socials-section">
            <div class="section-title">Connect on Social Media</div>
            <div class="social-icons-list">${socials}</div>
          </div>
          `
              : ""
          }

          ${businessLink}
        </article>

        ${qrBlock(
          "cardQr",
          "Scan to View Digital Card",
          "Point your smartphone camera at this QR code to open or share this digital card."
        )}

        <div class="kds-card-bottom-motto">
          <div class="motto-text">CONNECT &nbsp;·&nbsp; COLLABORATE &nbsp;·&nbsp; GROW</div>
        </div>
        <footer class="page-footer">
          <div>&copy; 2026 Khan Digital Solution. All rights reserved.</div>
        </footer>
      </div>
    `;
  }

  function renderBusiness(c, isConnected, isDemo) {
    const phoneDial = formatDialNumber(c.businessPhone);
    const wa = normalizeWhatsAppNumber(c.businessWhatsapp);
    const email = String(c.businessEmail || "").trim();
    const website = sanitizeUrl(c.businessWebsite || c.website);

    const businessAddressText = String(c.businessAddressText || "").trim();
    const rawBusinessMapUrl = String(c.businessAddress || "").trim();
    const explicitMapUrl = rawBusinessMapUrl ? sanitizeUrl(rawBusinessMapUrl) : "";
    const mapUrl =
      explicitMapUrl ||
      (businessAddressText
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessAddressText)}`
        : "");
    const hasBusinessAddress = Boolean(businessAddressText);
    const hasBusinessMap = Boolean(mapUrl);
    const hasBusinessLocation = hasBusinessAddress || hasBusinessMap;

    // Only render actions for which valid data exists. Never show disabled empty buttons.
    const actions = [];
    if (phoneDial) {
      actions.push(`
        <a class="btn-action action-call" href="tel:${esc(phoneDial)}">
          ${SVG_ICONS.call}<span>Call</span>
        </a>`);
    }
    if (wa) {
      actions.push(`
        <a class="btn-action action-whatsapp" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener noreferrer">
          ${SVG_ICONS.whatsapp}<span>WhatsApp</span>
        </a>`);
    }
    if (email) {
      actions.push(`
        <a class="btn-action action-email" href="mailto:${esc(email)}">
          ${SVG_ICONS.email}<span>Inquiries</span>
        </a>`);
    }
    if (website) {
      actions.push(`
        <a class="btn-action action-website" href="${esc(website)}" target="_blank" rel="noopener noreferrer">
          ${SVG_ICONS.website}<span>Website</span>
        </a>`);
    }

    const socials = socialLinks([
      ["facebook", c.businessFacebook, "Facebook"],
      ["instagram", c.businessInstagram, "Instagram"],
      ["linkedin", c.businessLinkedin, "LinkedIn"],
      ["youtube", c.businessYoutube, "YouTube"],
      ["tiktok", c.businessTiktok, "TikTok"]
    ]);

    const services = parseBusinessServices(c.businessServices, c.services);
    const tagline = String(c.tagline || "").trim();
    const businessBio = String(c.businessBio || "").trim();
    const coverToUse = c.businessCover || c.cover || "";
    const personalHref = `./card.html?slug=${encodeURIComponent(c.slug || c.id || "demo")}`;
    const hasBusinessVcfData = Boolean(phoneDial || wa || email || website || businessAddressText || c.company);

    const personalSwitcher = isConnected
      ? `
      <div class="kds-business-profile-link-wrap">
        <a href="${esc(personalHref)}" class="card-nav-switch business-to-personal-switch" data-switch-profile="personal">
          <div class="switch-content">
            ${renderSwitchThumbMarkup(c.photo, c.name || "Personal")}
            <div class="switch-texts">
              <span class="switch-kicker">Executive Identity</span>
              <span class="switch-title">${esc(c.name || "Personal Profile")}</span>
              <span class="switch-subtitle">${esc(c.designation || "View Personal Visiting Card")}</span>
            </div>
          </div>
          <div class="switch-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
        </a>
      </div>
    `
      : "";

    return `
      <div class="page-container business-container client-card-container" id="businessPageContainer">
        ${renderDemoPreviewBar("business", isDemo)}
        <article class="business-hero" id="businessHero">
          <div class="business-profile-cover-wrap">
            ${renderCoverMarkup(coverToUse, "businessProfileCover")}
          </div>

          <div class="business-header-content">
            ${renderBusinessLogoMarkup(c)}
            <h1 class="business-name" id="businessName">${esc(c.company || "Business Profile")}</h1>
            ${tagline ? `<div class="business-tagline" id="businessTagline">${esc(tagline)}</div>` : ""}
            ${businessBio ? `<p class="business-about" id="businessAbout">${esc(businessBio)}</p>` : ""}
          </div>

          ${
            actions.length
              ? `
          <div class="business-actions-wrap">
            <div class="actions-grid" data-count="${actions.length}">
              ${actions.join("")}
            </div>
          </div>`
              : ""
          }

          ${
            hasBusinessVcfData
              ? `
          <div class="save-tools business-save-tools">
            <button id="saveContactMain" class="btn-save-contact" type="button">
              ${SVG_ICONS.vcard}<span>Save Business Contact</span>
            </button>
          </div>`
              : ""
          }

          ${
            socials
              ? `
          <div class="business-social-section">
            <div class="section-title">Connect on Social Media</div>
            <div class="social-icons-list">${socials}</div>
          </div>`
              : ""
          }
        </article>

        ${
          services.length
            ? `
        <section class="services-section" aria-label="Services">
          <div class="section-title">Services &amp; Capabilities</div>
          <div class="services-grid">
            ${services.map((service, index) => serviceCard(service, index)).join("")}
          </div>
        </section>`
            : ""
        }

        ${
          hasBusinessLocation
            ? `
        <section class="business-address-section" aria-label="Business location">
          <div class="business-address-content${!hasBusinessAddress ? " business-address-map-only" : ""}">
            ${
              hasBusinessAddress
                ? `
            <div class="business-address-main">
              <span class="business-address-icon" aria-hidden="true">${SVG_ICONS.location}</span>
              <div class="business-address-info">
                <span class="business-address-label">Office Address</span>
                <div class="business-address-text">${esc(businessAddressText)}</div>
              </div>
            </div>`
                : ""
            }
            ${
              hasBusinessMap
                ? `
            <a class="business-map-link" href="${esc(mapUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open business location in Google Maps">
              ${SVG_ICONS.location}<span>Google Maps</span>
            </a>`
                : ""
            }
          </div>
        </section>`
            : ""
        }

        ${qrBlock(
          "cardBusinessQr",
          "Scan to View Business Profile",
          "Scan with any smartphone camera to view or share our business profile and services."
        )}

        ${personalSwitcher}

        <div class="kds-card-bottom-motto">
          <div class="motto-text">CONNECT &nbsp;·&nbsp; COLLABORATE &nbsp;·&nbsp; GROW</div>
        </div>
        <footer class="page-footer">
          <div>&copy; 2026 Khan Digital Solution. All rights reserved.</div>
        </footer>
      </div>
    `;
  }

  function updateSocialMetaTags(c, isBusiness) {
    const cardTitle = isBusiness
      ? (c.company || "Business Profile") + " • Business Identity"
      : (c.name || "Digital Card") + " • Digital Visiting Card";

    const cardDesc = isBusiness
      ? (c.company || "Business") +
        (c.tagline ? " — " + c.tagline : "") +
        (c.businessBio ? ". " + c.businessBio : "")
      : (c.name || "") +
        (c.designation ? " — " + c.designation : "") +
        (c.company ? " at " + c.company : "") +
        ". Connect and save contact information.";

    const cardPhoto = isBusiness
      ? sanitizeUrl(c.companyLogo || c.businessCover || c.photo)
      : sanitizeUrl(c.photo || c.companyLogo);

    const canonicalUrl = getCardFullUrl(c, isBusiness ? "business" : "personal");

    document.title = cardTitle;

    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement("link");
      canonicalEl.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute("href", canonicalUrl);

    const metaMappings = [
      ['meta[name="description"]', cardDesc],
      ['meta[property="og:title"]', cardTitle],
      ['meta[property="og:description"]', cardDesc],
      ['meta[property="og:url"]', canonicalUrl],
      ['meta[name="twitter:title"]', cardTitle],
      ['meta[name="twitter:description"]', cardDesc]
    ];

    if (cardPhoto) {
      metaMappings.push(['meta[property="og:image"]', cardPhoto]);
      metaMappings.push(['meta[name="twitter:image"]', cardPhoto]);
    }

    metaMappings.forEach(([selector, val]) => {
      const el = document.querySelector(selector);
      if (el && val) el.setAttribute("content", val);
    });
  }

  function renderQrCode(profileUrl) {
    const qrContainer = qs("#clientQrCanvas");
    if (!qrContainer || typeof QRCode === "undefined") return;

    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
      text: profileUrl,
      width: 200,
      height: 200,
      colorDark: "#060d1b",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });

    const keepSingleQrNode = () => {
      const canvas = qrContainer.querySelector("canvas");
      const image = qrContainer.querySelector("img");
      const keep = canvas || image;
      Array.from(qrContainer.children).forEach((node) => {
        if (node !== keep) node.remove();
      });
      if (keep) {
        keep.style.display = "block";
        keep.style.width = "100%";
        keep.style.height = "100%";
        keep.style.maxWidth = "200px";
        keep.style.maxHeight = "200px";
      }
    };

    keepSingleQrNode();
    requestAnimationFrame(keepSingleQrNode);
    setTimeout(keepSingleQrNode, 60);
  }

  function downloadQrWithQuietZone(filenameBase) {
    const sourceCanvas = qs("#clientQrCanvas canvas");
    const sourceImg = qs("#clientQrCanvas img");
    const source = sourceCanvas || sourceImg;
    if (!source) {
      showCardToast("QR code is still preparing. Please try again.", "warn");
      return;
    }

    const exportSize = 520;
    const quietZone = 40;
    const qrDrawSize = exportSize - quietZone * 2;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = exportSize;
    exportCanvas.height = exportSize;
    const ctx = exportCanvas.getContext("2d");

    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, exportSize, exportSize);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, quietZone, quietZone, qrDrawSize, qrDrawSize);

    const a = document.createElement("a");
    a.href = exportCanvas.toDataURL("image/png");
    a.download = slugify(filenameBase || "kds-card") + "-QR.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    showCardToast("QR code downloaded", "success");
  }

  async function shareProfile(profileUrl) {
    const shareData = {
      title: document.title,
      text: document.title,
      url: profileUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(profileUrl);
      showCardToast("Card link copied to clipboard", "success");
    } catch (_) {
      showCardToast("Unable to copy link automatically", "warn");
    }
  }

  async function referenceRenderCard(options = {}) {
    const root = qs("#cardRoot");
    if (!root) return;

    const params = new URLSearchParams(location.search);
    const identifier = params.get("slug") || params.get("id") || params.get("preview") || "demo";
    const isDemo =
      (!params.get("slug") && !params.get("id")) ||
      identifier === "demo" ||
      identifier === "demo-kds-digital-card" ||
      params.has("preview");

    try {
      let c = null;
      if (options?.useCache && cachedClient && cachedIdentifier === identifier) {
        c = { ...cachedClient };
      } else {
        c = await getClient(identifier);
        if (c) {
          cachedClient = { ...c };
          cachedIdentifier = identifier;
        }
      }

      if (!c) {
        document.title = "Card Not Found • KDS Digital Card";
        root.innerHTML = `
          <div class="page-container client-card-container">
            <section class="card-status-box not-found">
              <div class="status-svg-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <h2>Digital Card Not Found</h2>
              <p>This digital card link does not match an active profile or may have been removed.</p>
              <div class="status-box-actions">
                <a class="btn-save-contact" href="./index.html">Return to KDS Home</a>
                <a class="btn-secondary" href="./card.html?preview=demo">View Demo Identity</a>
              </div>
            </section>
          </div>`;
        return;
      }

      const statusOverride = params.get("status");
      if (isDemo && (statusOverride === "expired" || statusOverride === "inactive")) {
        if (statusOverride === "inactive") {
          c.subscriptionActive = false;
        } else {
          c.subscriptionActive = true;
          c.subscriptionEnd = new Date(Date.now() - 86400 * 1000).toISOString();
        }
      }

      const sub = subscriptionState(c);
      if (sub.status !== "active") {
        document.title = (c.name || c.company || "Card") + " • Subscription " + sub.label;
        root.innerHTML = `
          <div class="page-container client-card-container">
            <section class="subscription-block ${esc(sub.status)}">
              <div class="status-svg-badge ${esc(sub.status)}" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div class="subscription-status-pill ${esc(sub.status)}">${esc(sub.label)}</div>
              <h1>Digital Card Unavailable</h1>
              <p class="subscription-msg">This digital identity card is currently <strong>${esc(sub.label.toLowerCase())}</strong>.</p>
              ${
                c.subscriptionEnd
                  ? `<div class="subscription-date-row"><span>Expiration Date:</span> <strong>${esc(formatDateTime(c.subscriptionEnd))}</strong></div>`
                  : ""
              }
              <p class="subscription-hint">Please contact the card owner or administrator to renew access.</p>
              <div class="status-box-actions">
                <a class="btn-secondary" href="./index.html">Return Home</a>
              </div>
            </section>
          </div>`;
        return;
      }

      const templateParam = params.get("template");
      const effectiveTemplate =
        isDemo && ["personal", "personal_business", "business_only", "business"].includes(templateParam)
          ? templateParam === "business"
            ? "personal_business"
            : templateParam
          : c.template;

      const connected = effectiveTemplate === "personal_business" || effectiveTemplate === "business";
      const matchedByBusinessSlug = Boolean(c.businessSlug && identifier === c.businessSlug);
      const requestedBusiness =
        params.get("profile") === "business" ||
        templateParam === "business" ||
        matchedByBusinessSlug;
      const isBusiness =
        effectiveTemplate === "business_only" || (connected && requestedBusiness);

      updateSocialMetaTags(c, isBusiness);

      root.innerHTML = isBusiness
        ? renderBusiness(c, connected, isDemo)
        : renderPersonal(c, connected, isDemo);

      const profile = isBusiness ? "business" : "personal";
      const profileUrl = getCardFullUrl(c, profile);

      renderQrCode(profileUrl);

      const saveBtn = qs("#saveContactMain");
      if (saveBtn) {
        saveBtn.onclick = () => {
          downloadContact(c, profile);
          showCardToast("Contact file (.vcf) downloaded", "success");
        };
      }

      const shareBtn = qs("#shareCard");
      if (shareBtn) shareBtn.onclick = () => shareProfile(profileUrl);

      const quickShare = qs("#quickShareBtn");
      if (quickShare) quickShare.onclick = () => shareProfile(profileUrl);

      const downloadBtn = qs("#downloadQr");
      if (downloadBtn) {
        downloadBtn.onclick = () => {
          const filenameBase = isBusiness
            ? (c.company || c.name || "business") + "-business"
            : c.name || "personal";
          downloadQrWithQuietZone(filenameBase);
        };
      }

      // Smooth client-side switching between Personal and Business views
      root.querySelectorAll("[data-switch-profile]").forEach((trigger) => {
        trigger.addEventListener("click", (evt) => {
          if (evt.metaKey || evt.ctrlKey || evt.shiftKey || evt.altKey) return;
          evt.preventDefault();
          const targetProfile = trigger.getAttribute("data-switch-profile");
          const nextParams = new URLSearchParams(location.search);
          if (!nextParams.get("slug") && !nextParams.get("id") && !nextParams.get("preview")) {
            nextParams.set("slug", c.slug || c.id || "demo");
          }
          if (targetProfile === "business") {
            nextParams.set("profile", "business");
            if (isDemo && nextParams.get("template") === "personal") {
              nextParams.set("template", "personal_business");
            }
          } else {
            nextParams.delete("profile");
            if (isDemo && (nextParams.get("template") === "business" || nextParams.get("template") === "business_only")) {
              nextParams.set("template", "personal_business");
            }
          }
          const nextUrl = `${location.pathname}?${nextParams.toString()}`;
          window.history.pushState({ profile: targetProfile }, "", nextUrl);
          window.scrollTo({ top: 0, behavior: "smooth" });
          referenceRenderCard({ useCache: true });
        });
      });
    } catch (err) {
      console.error("Card render failed:", err);
      root.innerHTML = `
        <div class="page-container client-card-container">
          <section class="card-status-box error">
            <div class="status-svg-badge error" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2>Unable to Load Digital Card</h2>
            <p>Please check your internet connection and try reloading the page.</p>
            <div class="status-box-actions">
              <button class="btn-save-contact" type="button" onclick="location.reload()">Reload Card</button>
              <a class="btn-secondary" href="./index.html">Return Home</a>
            </div>
          </section>
        </div>`;
    }
  }

  window.addEventListener("popstate", () => {
    referenceRenderCard();
  });

  window.renderCard = referenceRenderCard;
})();
