import { getSportLabel } from "../sport_catalog.mjs?v=pace-release-audit-58";
import { localDateInputValue, nextWeekdayDate } from "../app_logic.mjs?v=pace-release-audit-58";
import { chatRoomCopy, flowCopy } from "./app_copy.mjs?v=pace-release-audit-58";
import { escapeHtml } from "./dom.mjs?v=pace-release-audit-58";

const MAYA_PROFILE_PHOTOS = Object.freeze([
  "assets/maya-profile-01.jpg",
  "assets/maya-profile-02.jpg",
  "assets/maya-profile-03.jpg",
  "assets/maya-profile-04.jpg",
]);

export function createChatFeature({
  getLanguage,
  translate,
  openModal,
  closeModal,
  showToast,
  switchTab,
  verificationMark,
}) {
  let hasChattedBefore = false;

  function roomCopy() {
    const language = getLanguage();
    return chatRoomCopy[language] ?? chatRoomCopy.en;
  }

  function chatFlowCopy() {
    const language = getLanguage();
    return (flowCopy[language] ?? flowCopy.en).chat;
  }

  function inviteCopy() {
    const language = getLanguage();
    return (flowCopy[language] ?? flowCopy.en).invite;
  }

  function setSection(section) {
    document.querySelectorAll("[data-chat-section]").forEach((button) => {
      const active = button.dataset.chatSection === section;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelector("#chat-conversation-panel")?.classList.toggle("hidden", section !== "chat");
    document.querySelector("#chat-profile-panel")?.classList.toggle("hidden", section !== "profile");
  }

  function getProfilePhotos(person, isMaya) {
    const suppliedPhotos = Array.isArray(person.photos) ? person.photos : [];
    const photos = suppliedPhotos.length ? suppliedPhotos : (isMaya ? MAYA_PROFILE_PHOTOS : []);
    return photos
      .map((photo) => typeof photo === "string" ? photo : photo?.url)
      .filter((photo) => typeof photo === "string" && photo.trim())
      .map((photo) => escapeHtml(photo));
  }

  function renderProfileGallery(photos, name) {
    if (!photos.length) return `<div class="chat-profile-photo chat-profile-placeholder" aria-label="${name}"><span>${name.slice(0, 1)}</span></div>`;
    return `<div class="chat-profile-gallery" aria-label="${name} · ${photos.length} photos">${photos.map((photo, index) => `<figure class="chat-profile-photo"><img src="${photo}" alt="${name} · ${escapeHtml(translate("photoCount", index + 1, photos.length))}" ${index ? 'loading="lazy"' : ""} decoding="async" /></figure>`).join("")}</div>`;
  }

  function openConversation(person = { name: "Maya", verified: true }, { section = "chat" } = {}) {
    hasChattedBefore = true;
    const copy = roomCopy();
    const name = escapeHtml(person.name || "Maya");
    const isMaya = person.id ? person.id === "user_maya" : person.name === "Maya" || !person.name;
    const profileBio = escapeHtml(person.bio || (isMaya ? translate("mayaBio") : ""));
    const profileSport = escapeHtml(person.sport || (isMaya ? getSportLabel("running", getLanguage()) : ""));
    const profilePhotos = getProfilePhotos(person, isMaya);
    const profileAge = person.age ?? (isMaya ? 28 : null);
    const profileTags = [profileSport, ...(isMaya ? [escapeHtml(translate("mayaSchedule")), escapeHtml(translate("mayaGoal"))] : [])].filter(Boolean);
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    const chatView = document.querySelector("#chat-view");
    chatView.classList.add("active");
    chatView.innerHTML = `
      <div class="chat-topbar"><button class="chat-back" data-action="back-from-chat" aria-label="${copy.back}" title="${copy.back}"><span class="material-symbols-rounded" aria-hidden="true">arrow_back_ios_new</span></button><div class="chat-person"><span class="chat-avatar${isMaya ? " image-maya" : ""}">${isMaya ? "" : name.slice(0, 1)}</span><span><span class="chat-person-name"><strong>${name}</strong>${person.verified !== false ? verificationMark(translate("selfieVerified")) : ""}</span></span></div><span class="chat-topbar-spacer" aria-hidden="true"></span></div>
      <div class="chat-section-tabs" role="tablist" aria-label="${name}"><button class="active" data-action="show-chat-section" data-chat-section="chat" role="tab" aria-selected="true">${copy.chat}</button><button data-action="show-chat-section" data-chat-section="profile" role="tab" aria-selected="false">${copy.profile}</button></div>
      <section id="chat-conversation-panel" class="chat-section-panel">
        <section class="chat-thread" aria-label="${name} chat"><div class="message incoming">${copy.greeting}</div><div class="message outgoing">${copy.reply}</div><button class="chat-invite-card" data-action="open-invite"><span>${copy.invite}</span><small>${copy.inviteMeta}</small><b>↗</b></button></section>
        <form class="chat-composer" id="chat-composer"><textarea id="chat-message" maxlength="1000" aria-label="${copy.placeholder}" placeholder="${copy.placeholder}"></textarea><button type="submit" aria-label="${copy.send}" title="${copy.send}" disabled><span class="material-symbols-rounded" aria-hidden="true">arrow_upward</span></button></form>
      </section>
      <section id="chat-profile-panel" class="chat-section-panel chat-inline-profile hidden" aria-label="${copy.profile}">${renderProfileGallery(profilePhotos, name)}<div class="chat-profile-summary"><div><h2>${name}${profileAge == null ? "" : ` · ${escapeHtml(profileAge)}`}</h2></div>${person.verified !== false ? verificationMark(translate("selfieVerified")) : ""}</div>${profileBio ? `<p class="chat-profile-bio">${profileBio}</p>` : ""}<div class="chat-profile-tags">${profileTags.map((tag) => `<span>${tag}</span>`).join("")}</div><button class="chat-profile-plan" data-action="open-invite">${copy.invite}<span class="material-symbols-rounded" aria-hidden="true">north_east</span></button></section>
    `;
    setSection(section);
    window.scrollTo({ top: 0, behavior: "instant" });
    chatView.querySelector(`[data-chat-section="${section === "profile" ? "profile" : "chat"}"]`)?.focus({ preventScroll: true });
    const composer = document.querySelector("#chat-composer");
    const input = composer.querySelector("#chat-message");
    const sendButton = composer.querySelector('button[type="submit"]');
    const syncSendButton = () => { sendButton.disabled = !input.value.trim(); };
    input.addEventListener("input", syncSendButton);
    composer.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!input.value.trim()) return;
      const bubble = document.createElement("div");
      bubble.className = "message outgoing";
      bubble.textContent = input.value.trim();
      document.querySelector(".chat-thread").append(bubble);
      input.value = "";
      syncSendButton();
    });
  }

  function openMayaProfile() {
    const copy = chatFlowCopy();
    openModal(`
      <header><div><p class="eyebrow">${copy.eyebrow}</p><h2 id="modal-title">Maya · 28</h2></div><button class="close" data-action="close-modal" aria-label="${translate("close")}">×</button></header>
      <div class="profile-preview image-maya"></div>
      <div class="trust-row">${verificationMark(translate("selfieVerified"))}</div>
      <p>${translate("mayaActivity")}</p><p>${translate("mayaBio")}</p>
    `);
  }

  function openChat() {
    if (hasChattedBefore) return openConversation();
    const copy = chatFlowCopy();
    openModal(`
      <header class="first-chat-header"><div><p class="eyebrow">${copy.eyebrow}</p><h2 id="modal-title">${copy.title}</h2></div><button class="close" data-action="close-modal" aria-label="${translate("close")}">×</button></header>
      <div class="first-chat-person"><span class="chat-avatar image-maya"></span><div>${verificationMark(copy.verified)}<p>${copy.summary}</p></div></div>
      <p class="first-chat-note">${copy.note}</p>
      <div class="first-chat-actions"><button class="primary-button" data-action="open-invite">${copy.invite}<small>${copy.inviteHint}</small></button><button class="outline-button" data-action="open-conversation">${copy.normalChat}<span>↗</span></button></div>
    `);
  }

  function openInvite() {
    const copy = inviteCopy();
    const minimumDate = localDateInputValue();
    const suggestedDate = nextWeekdayDate(6);
    openModal(`
      <header><div><p class="eyebrow">${copy.eyebrow}</p><h2 id="modal-title">${copy.title}</h2></div><button class="close" data-action="close-modal" aria-label="${translate("close")}">×</button></header>
      <form id="invite-form">
        <label>${copy.sport}<input name="sport" type="text" maxlength="60" autocomplete="off" placeholder="${copy.sportPlaceholder}" required /></label>
        <div class="form-row"><label>${copy.date}<input name="date" type="date" min="${minimumDate}" value="${suggestedDate}" required /></label><label>${copy.time}<input name="time" type="time" value="08:00" required /></label></div>
        <label>${copy.place}<input name="place" value="${copy.placeValue}" required /></label>
        <label>${copy.notes}<textarea name="note" placeholder="${copy.notePlaceholder}"></textarea></label>
        <div class="invite-submit-row"><button class="primary-button invite-submit" type="submit" disabled>${copy.send}</button></div>
      </form>
    `);
    const inviteForm = document.querySelector("#invite-form");
    const inviteSubmit = inviteForm.querySelector('[type="submit"]');
    const syncInviteButton = () => { inviteSubmit.disabled = !inviteForm.checkValidity(); };
    inviteForm.addEventListener("input", syncInviteButton);
    inviteForm.addEventListener("change", syncInviteButton);
    syncInviteButton();
    inviteForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!event.target.checkValidity()) return event.target.reportValidity();
      hasChattedBefore = true;
      closeModal();
      showToast(copy.sent);
    });
  }

  return Object.freeze({ openChat, openConversation, openInvite, openMayaProfile, setSection });
}
