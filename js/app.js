const STORE_KEY="kds_client_cards_v1";

function esc(v){return String(v??"").replace(/[&<>"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])})}
function qs(s){return document.querySelector(s)}
function slugify(v){return String(v||"client").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50)||"client"}
function cardUrl(id){return "card.html?id="+encodeURIComponent(id)}
function dbToClient(c){if(!c)return null;return {
 id:c.id,slug:c.slug,template:c.template, name:c.full_name,designation:c.designation||"",phone:c.phone||"",whatsapp:c.whatsapp||"",email:c.email||"",location:c.address||"",bio:c.bio||"",
 photo:c.profile_image_url||"",cover:c.cover_image_url||"",company:c.company_name||"",tagline:c.company_tagline||"",
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
   if(!c){root.innerHTML='<div class="empty"><h2>Client card পাওয়া যায়নি।</h2><a href="index.html">Home</a></div>';return}
   const sub=subscriptionState(c);
   if(sub.status!=="active"){document.title=c.name+" • Subscription "+sub.label;root.innerHTML='<section class="subscription-block '+sub.status+'"><div class="subscription-icon">'+(sub.status==="expired"?"⏰":"🔒")+'</div><h1>Card Unavailable</h1><p>এই digital card-এর subscription এখন <strong>'+esc(sub.label)+'</strong>।</p>'+(c.subscriptionEnd?'<p class="subscription-date">Expiry: '+esc(formatDateTime(c.subscriptionEnd))+'</p>':"")+'<p class="subscription-help">Please contact the card owner to activate or renew the subscription.</p></section>';return}
   document.title=c.name+" • Digital Card";
   const cover=c.cover?'background-image:url("'+esc(c.cover)+'")':"";
   const photo=c.photo||"https://ui-avatars.com/api/?name="+encodeURIComponent(c.name)+"&background=e8eef8&color=155eef&size=300";
   const socials=[["Facebook",c.facebook],["Instagram",c.instagram],["LinkedIn",c.linkedin],["YouTube",c.youtube]].filter(x=>x[1]);
   const services=String(c.services||"").split(",").map(x=>x.trim()).filter(Boolean);
   const wa=c.whatsapp?c.whatsapp.replace(/\D/g,""):"";
   const html='<article class="card-shell"><div class="cover" style="'+cover+'"></div><div class="profile"><img class="avatar" src="'+esc(photo)+'" alt="'+esc(c.name)+'"><div class="identity"><h1>'+esc(c.name)+'</h1><div class="role">'+esc(c.designation)+'</div>'+(c.company?'<div class="company">'+esc(c.company)+'</div>':"")+'</div>'+(c.bio?'<p class="bio">'+esc(c.bio)+'</p>':"")+'<div class="contact-grid">'+(c.phone?'<a class="contact" href="tel:'+esc(c.phone)+'">📞 Call</a>':"")+(wa?'<a class="contact" target="_blank" rel="noopener" href="https://wa.me/88'+esc(wa)+'">💬 WhatsApp</a>':"")+(c.email?'<a class="contact" href="mailto:'+esc(c.email)+'">✉️ Email</a>':"")+(c.location?'<div class="contact">📍 '+esc(c.location)+'</div>':"")+'</div>'+(c.tagline?'<div class="section"><h3>'+esc(c.tagline)+'</h3></div>':"")+(services.length?'<div class="section"><h3>Services</h3><div class="services">'+services.map(s=>'<span class="service">'+esc(s)+'</span>').join("")+'</div></div>':"")+(socials.length?'<div class="section"><h3>Social</h3><div class="socials">'+socials.map(s=>'<a class="social" target="_blank" rel="noopener" href="'+esc(s[1])+'">'+esc(s[0])+'</a>').join("")+'</div></div>':"")+'<div class="card-actions"><button class="btn primary" id="saveContact">Save Contact</button><button class="btn secondary" id="shareCard">Share Card</button></div></div></article>';
   root.innerHTML=html;qs("#saveContact").onclick=()=>downloadContact(c);qs("#shareCard").onclick=async()=>{try{if(navigator.share)await navigator.share({title:c.name,text:"Digital Card",url:location.href});else throw new Error()}catch(e){if(navigator.clipboard){await navigator.clipboard.writeText(location.href);alert("Card link copied.")}}}
 }catch(e){console.error(e);root.innerHTML='<div class="empty"><h2>Card load করতে সমস্যা হয়েছে।</h2><p>দয়া করে কিছুক্ষণ পরে আবার চেষ্টা করুন।</p></div>'}
}