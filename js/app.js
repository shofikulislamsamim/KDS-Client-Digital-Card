const STORE_KEY="kds_client_cards_v1";

function esc(v){return String(v??"").replace(/[&<>"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])})}
function qs(s){return document.querySelector(s)}
function slugify(v){return String(v||"client").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50)||"client"}
function cardUrl(id){return "card.html?id="+encodeURIComponent(id)}
function dbToClient(c){if(!c)return null;return {
 id:c.id,slug:c.slug,template:c.template, name:c.full_name,designation:c.designation||"",phone:c.phone||"",whatsapp:c.whatsapp||"",email:c.email||"",location:c.address||"",bio:c.bio||"",
 photo:c.profile_image_url||"",cover:c.cover_image_url||"",company:c.company_name||"",companyRole:c.company_role||"",companyLogo:c.company_logo_url||"",website:c.website||"",tagline:c.company_tagline||"",
 services:Array.isArray(c.services)?c.services.join(", "):(c.services||""),facebook:c.social_links?.facebook||"",instagram:c.social_links?.instagram||"",linkedin:c.social_links?.linkedin||"",youtube:c.social_links?.youtube||"",
 subscriptionActive:!!c.subscription_active,subscriptionStart:c.subscription_start,subscriptionEnd:c.subscription_end
}}
function clientToDb(c){return {
 id:c.id||undefined,slug:c.slug||slugify(c.name),template:c.template||"personal",full_name:c.name,designation:c.designation||null,phone:c.phone||null,whatsapp:c.whatsapp||null,email:c.email||null,address:c.location||null,bio:c.bio||null,
 profile_image_url:c.photo||null,cover_image_url:c.cover||null,company_name:c.company||null,company_tagline:c.tagline||null,
 services:String(c.services||"").split(",").map(x=>x.trim()).filter(Boolean),social_links:{facebook:c.facebook||"",instagram:c.instagram||"",linkedin:c.linkedin||"",youtube:c.youtube||""},
 subscription_active:!!c.subscriptionActive,subscription_start:c.subscriptionStart||null,subscription_end:c.subscriptionEnd||null
}}
async function getClients(){
 const {data,error}=await supabaseClient.from("client_cards").select("*").order("created_at",{ascending:false});
 if(error)throw error;return (data||[]).map(dbToClient)
}
async function getClient(id){
 const {data,error}=await supabaseClient.from("client_cards").select("*").eq("id",id).maybeSingle();
 if(error)throw error;return dbToClient(data)
}
async function saveClient(c){
 const payload=clientToDb(c);
 delete payload.id;
 if(c.id){
   const {data,error}=await supabaseClient.from("client_cards").update(payload).eq("id",c.id).select().single();
   if(error)throw error;return dbToClient(data)
 }
 const {data,error}=await supabaseClient.from("client_cards").insert(payload).select().single();
 if(error)throw error;return dbToClient(data)
}
async function removeClient(id){const {error}=await supabaseClient.from("client_cards").delete().eq("id",id);if(error)throw error}
function subscriptionState(c){if(c.subscriptionActive===false)return{status:"inactive",label:"Inactive"};if(c.subscriptionEnd){const end=new Date(c.subscriptionEnd);if(!isNaN(end.getTime())&&end.getTime()<=Date.now())return{status:"expired",label:"Expired"}}return{status:"active",label:"Active"}}
function isSubscriptionActive(c){return subscriptionState(c).status==="active"}
function formatDateTime(value){if(!value)return"No expiry";const d=new Date(value);if(isNaN(d.getTime()))return"—";return d.toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
function formatDate(value){if(!value)return"No expiry";const d=new Date(value);if(isNaN(d.getTime()))return"—";return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
function addDuration(start,days){const d=new Date(start);d.setDate(d.getDate()+Number(days||0));return d}
function activateSubscription(c,days){c.subscriptionActive=true;c.subscriptionStart=new Date().toISOString();c.subscriptionEnd=days&&Number(days)>0?addDuration(c.subscriptionStart,Number(days)).toISOString():null;return c}
function deactivateSubscription(c){c.subscriptionActive=false;return c}
function vcard(c){const lines=["BEGIN:VCARD","VERSION:3.0","FN:"+c.name];if(c.phone)lines.push("TEL;TYPE=CELL:"+c.phone);if(c.email)lines.push("EMAIL:"+c.email);if(c.company)lines.push("ORG:"+c.company);if(c.designation)lines.push("TITLE:"+c.designation);if(c.location)lines.push("ADR:;;"+c.location);lines.push("END:VCARD");return lines.join("\n")}
function downloadContact(c){const blob=new Blob([vcard(c)],{type:"text/vcard;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=slugify(c.name)+".vcf";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
async function renderCard(){
 const root=qs("#cardRoot");if(!root)return;
 const id=new URLSearchParams(location.search).get("id");
 try{
   const c=await getClient(id);
   if(!c){root.innerHTML='<div class="empty"><h2>Client card পাওয়া যায়নি।</h2><a class="btn-save-contact" href="index.html">Back to Home</a></div>';return}
   const sub=subscriptionState(c);
   if(sub.status!=="active"){
     document.title=c.name+" • Subscription "+sub.label;
     root.innerHTML='<section class="subscription-block '+sub.status+'"><div class="subscription-icon">'+(sub.status==="expired"?"⏰":"🔒")+'</div><h1>Card Unavailable</h1><p>এই digital card-এর subscription এখন <strong>'+esc(sub.label)+'</strong>।</p>'+(c.subscriptionEnd?'<p class="subscription-date">Expiry: '+esc(formatDateTime(c.subscriptionEnd))+'</p>':"")+'<p>Please contact the card owner to activate or renew the subscription.</p></section>';
     return;
   }

   document.title=c.name+" • Digital Visiting Card";
   const photo=c.photo||"https://ui-avatars.com/api/?name="+encodeURIComponent(c.name)+"&background=151d30&color=38bdf8&size=400";
   const cover=c.cover ? '<img class="profile-cover-image" src="'+esc(c.cover)+'" alt="">':'<div class="profile-cover-placeholder"></div>';
   const wa=c.whatsapp?c.whatsapp.replace(/\D/g,""):"";
   const services=String(c.services||"").split(",").map(x=>x.trim()).filter(Boolean);
   const socials=[["Facebook",c.facebook,"f"],["Instagram",c.instagram,"ig"],["LinkedIn",c.linkedin,"in"],["YouTube",c.youtube,"▶"]].filter(x=>x[1]);
   const icon=(type)=> type==="f" ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.7-1.6h1.6V4.8c-.3 0-1.4-.1-2.6-.1-2.6 0-4.3 1.6-4.3 4.4V11H7v3h2.9v8h3.6z"/></svg>' : type==="ig" ? '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></svg>' : type==="in" ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 3.7A2.2 2.2 0 1 1 5 8a2.2 2.2 0 0 1 0-4.3zM3 9h4v12H3V9zm6.5 0h3.8v1.7h.1c.5-1 1.8-2.1 3.8-2.1 4.1 0 4.8 2.7 4.8 6.3V21h-4v-5.4c0-1.3 0-3-1.9-3s-2.2 1.4-2.2 2.9V21h-4V9z"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M10 8l6 4-6 4V8z"/><path d="M21 7.2c-.2-1.2-1.2-2.2-2.4-2.4C16.9 4.5 14.5 4.4 12 4.4s-4.9.1-6.6.4C4.2 5 3.2 6 3 7.2c-.3 1.5-.4 3-.4 4.8s.1 3.3.4 4.8c.2 1.2 1.2 2.2 2.4 2.4 1.7.3 4.1.4 6.6.4s4.9-.1 6.6-.4c1.2-.2 2.2-1.2 2.4-2.4.3-1.5.4-3 .4-4.8s-.1-3.3-.4-4.8z"/></svg>';

   const socialHtml=socials.length?'<div class="socials-section"><div class="section-title">Connect on Social Media</div><div class="social-icons-list">'+socials.map(x=>'<a class="social-icon-link" data-tooltip="'+esc(x[0])+'" aria-label="'+esc(x[0])+'" target="_blank" rel="noopener noreferrer" href="'+esc(x[1])+'">'+icon(x[2])+'</a>').join("")+'</div></div>':"";

   const businessHtml=c.template==="personal_business" ? '<div class="client-business-block">'+
     (c.companyLogo?'<div class="client-business-logo"><img src="'+esc(c.companyLogo)+'" alt="'+esc(c.company||"Company logo")+'"></div>':"")+
     (c.company?'<h2>'+esc(c.company)+'</h2>':"")+
     (c.companyRole?'<div class="client-business-role">'+esc(c.companyRole)+'</div>':"")+
     (c.tagline?'<p class="client-business-tagline">'+esc(c.tagline)+'</p>':"")+
     (c.website?'<a class="btn-secondary client-website" target="_blank" rel="noopener" href="'+esc(c.website)+'">Visit Website</a>':"")+
     (services.length?'<div class="section client-services"><div class="section-title">Services</div><div class="services">'+services.map(x=>'<span class="service">'+esc(x)+'</span>').join("")+'</div></div>':"")+
     '</div>' : "";

   const html='<div class="page-container client-card-container">'+
     '<article class="profile-card" id="clientProfileCard">'+
       '<div class="profile-cover" aria-hidden="true">'+cover+'</div>'+
       '<div class="card-header">'+
         '<div class="avatar-wrapper"><img class="avatar-img" src="'+esc(photo)+'" alt="'+esc(c.name)+'"><div class="status-badge" title="Active"></div></div>'+
         '<h1 class="founder-name">'+esc(c.name)+'</h1>'+
         (c.designation?'<div class="founder-title">'+esc(c.designation)+'</div>':"")+
         (c.company&&c.template!=="personal_business"?'<div class="company-badge">'+esc(c.company)+'</div>':"")+
         (c.bio?'<p class="founder-bio">'+esc(c.bio)+'</p>':"")+
       '</div>'+
       '<div class="actions-grid">'+
         (c.phone?'<a class="btn-action action-call" href="tel:'+esc(c.phone)+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.11 4.11 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>Call</span></a>':"")+
         (wa?'<a class="btn-action action-whatsapp" target="_blank" rel="noopener" href="https://wa.me/'+(wa.startsWith("88")?wa:"88"+wa.replace(/^0/,""))+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span>WhatsApp</span></a>':"")+
         (c.email?'<a class="btn-action action-email" href="mailto:'+esc(c.email)+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg><span>Email</span></a>':"")+
         '<button class="btn-action action-vcard" id="saveContact" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg><span>Save</span></button>'+
       '</div>'+
       '<div class="save-tools"><button class="btn-save-contact" id="saveContactMain" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>Save Contact to Phone (.vcf)</button><button class="btn-save-contact btn-live-pdf" id="shareCard" type="button">Share Card</button></div>'+
       businessHtml+
       socialHtml+
     '</article>'+
     '<div class="qr-card" id="clientQrCard"><div class="qr-frame"><img id="clientQr" width="220" height="220" alt="QR Code"></div><h3 class="qr-title">Scan to Connect</h3><p class="qr-desc">Scan with your smartphone camera to instantly open this digital visiting card.</p><div class="qr-btn-group"><button class="btn-secondary" id="downloadQr" type="button">Download QR</button></div></div>'+
     '<footer class="page-footer"><div>&copy; 2026 Khan Digital Solution. All rights reserved.</div></footer>'+
   '</div>';

   root.innerHTML=html;
   const save=()=>downloadContact(c);
   qs("#saveContact").onclick=save;
   qs("#saveContactMain").onclick=save;
   qs("#shareCard").onclick=async()=>{try{if(navigator.share)await navigator.share({title:c.name,text:"Digital Visiting Card",url:location.href});else throw new Error()}catch(e){if(e?.name!=="AbortError"&&navigator.clipboard){await navigator.clipboard.writeText(location.href);alert("Card link copied.")}}};

   const qrUrl="https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data="+encodeURIComponent(location.href.split("#")[0]);
   const qr=qs("#clientQr"); if(qr)qr.src=qrUrl;
   qs("#downloadQr").onclick=async()=>{try{const res=await fetch(qrUrl);if(!res.ok)throw new Error();const blob=await res.blob();const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=slugify(c.name)+"-QR.png";a.click();setTimeout(()=>URL.revokeObjectURL(u),800)}catch(e){window.open(qrUrl,"_blank","noopener,noreferrer")}};
 }catch(e){console.error(e);root.innerHTML='<div class="empty"><h2>Card load করতে সমস্যা হয়েছে।</h2><p>দয়া করে কিছুক্ষণ পরে আবার চেষ্টা করুন।</p></div>'}
}