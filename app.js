import { POPULAR_SPORT_IDS, SPORTS, getSportLabel } from "./sport_catalog.mjs?v=pace-release-audit-58";
import { PaceApiClient } from "./api_client.mjs?v=pace-release-audit-58";
import { createConnectionFeed } from "./connection_feed.mjs?v=pace-release-audit-58";
import { createHttpPaceRepository, createLocalPaceRepository } from "./pace_repository.mjs?v=pace-release-audit-58";
import { translations, matchSuccessCopy, sportLabels, otherSportLabels, singleSportText, sportCatalogCopy, swipeLabels, discoveryFilterCopy, flowCopy, verificationCopy } from "./features/app_copy.mjs?v=pace-release-audit-58";
import { createOnboarding } from "./features/onboarding.mjs?v=pace-release-audit-58";
import { createLaunchAssetPreparer } from "./features/launch_assets.mjs?v=pace-release-audit-58";
import { createChatFeature } from "./features/chat.mjs?v=pace-release-audit-58";
import { createMomentsFeature } from "./features/moments.mjs?v=pace-release-audit-58";
import { createAccountFeature } from "./features/account.mjs?v=pace-release-audit-58";

import { createMembershipFeature } from "./features/membership.mjs?v=pace-release-audit-58";
import { createStoreKitBridge } from "./features/storekit_bridge.mjs?v=pace-release-audit-58";
import { createTrainFeature } from "./features/train.mjs?v=pace-release-audit-58";
import { createPreviewActivities } from "./features/activity_seed.mjs?v=pace-release-audit-58";

const DISCOVERY_GOAL_IDS = ["casual", "race-prep", "social"];
const DISCOVERY_SCHEDULE_IDS = ["weekdays", "weekends", "flexible"];
const DISCOVERY_PHOTOS = [
  { url: null, position: "center 38%" },
  { url: "assets/maya-profile-02.jpg", position: "center 34%" },
  { url: "assets/maya-profile-03.jpg", position: "center 38%" },
  { url: "assets/maya-profile-04.jpg", position: "center 34%" },
];

const initialCandidates = [{ id: "maya", distanceKm: 9, sportIds: ["running", "cycling", "strength-training"], schedule: "weekends", goal: "race-prep" }];
let previewSessionStorage = null;
try { previewSessionStorage = window.localStorage; } catch { /* Private browsing may disable persistence. */ }
const repository = document.querySelector('meta[name="pace-data-adapter"]')?.content === "http"
  ? createHttpPaceRepository(new PaceApiClient())
  : createLocalPaceRepository({ candidates: initialCandidates, posts: createConnectionFeed(), activities: createPreviewActivities(), sessionStorage: previewSessionStorage });
let sessionActive = false;

const state = {
  distance: 12,
  likesRemaining: 12,
  language: "en",
  chatReturnTab: "connect",
  selectedSportId: null,
  discoveryPhotoIndex: 0,
  unreadNotifications: 0,
  discoveryPreferences: { goal: "casual", schedule: "flexible" },
};

function t(key, ...args) {
  const value = translations[state.language]?.[key] ?? translations.en[key] ?? key;
  return typeof value === "function" ? value(...args) : value;
}

function applyLanguage(language) {
  state.language = language;
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => { element.setAttribute("aria-label", t(element.dataset.i18nAria)); });
  document.querySelectorAll("[data-sport-label]").forEach((element) => { element.textContent = (sportLabels[language] ?? sportLabels.en)[element.dataset.sportLabel]; });
  document.querySelectorAll("[data-sport-id-label]").forEach((element) => { element.textContent = getSportLabel(element.dataset.sportIdLabel, language); });
  document.querySelectorAll("[data-other-label]").forEach((element) => { element.textContent = otherSportLabels[language] ?? otherSportLabels.en; });
  document.querySelectorAll("[data-swipe-label]").forEach((element) => { element.textContent = (swipeLabels[language] ?? swipeLabels.en)[element.dataset.swipeLabel]; });
  if (sessionActive) void membership.refresh();
  if (document.querySelector("#train-view").classList.contains("active")) void train.refresh();
  document.querySelector("#like-count").textContent = t("likes", state.likesRemaining);
  updateDiscoverySummary();
  setDiscoveryPhoto(state.discoveryPhotoIndex);
  moments.render();
  account.renderProfileDetails();
  account.renderSettingsPanel();
  renderNotificationBadge();
  try { localStorage.setItem("pace-language", language); } catch { /* local storage is optional in the prototype */ }
}

const modalRoot = document.querySelector("#modal-root");
const modal = document.querySelector("#modal");
const toast = document.querySelector("#toast");
const discoveryCard = document.querySelector("#discovery-card");
const waitlist = document.querySelector("#waitlist-state");
const onboardingRoot = document.querySelector("#onboarding-root");
const appShell = document.querySelector(".app-shell");
const profileEditor = document.querySelector("#edit-profile-view");

function renderNotificationBadge() {
  const badge = document.querySelector("[data-notification-dot]");
  if (badge) badge.hidden = state.unreadNotifications <= 0;
}

function setDiscoveryPhoto(nextIndex) {
  const total = DISCOVERY_PHOTOS.length;
  const normalizedIndex = ((nextIndex % total) + total) % total;
  const selectedPhoto = DISCOVERY_PHOTOS[normalizedIndex];
  const photoElement = discoveryCard.querySelector("[data-discovery-photo]");
  const statusElement = document.querySelector("#discovery-gallery-status");
  const photoLabel = t("photoCount", normalizedIndex + 1, total);

  state.discoveryPhotoIndex = normalizedIndex;
  if (selectedPhoto.url) photoElement.style.backgroundImage = `url("${selectedPhoto.url}")`;
  else photoElement.style.removeProperty("background-image");
  photoElement.style.backgroundPosition = selectedPhoto.position;
  photoElement.setAttribute("aria-label", `Maya · ${photoLabel}`);
  statusElement.textContent = photoLabel;
  discoveryCard.querySelectorAll(".card-progress span").forEach((item, index) => item.classList.toggle("active", index === normalizedIndex));
  discoveryCard.querySelector("[data-action='previous-discovery-photo']")?.setAttribute("aria-label", `${t("previousPhoto")} · ${photoLabel}`);
  discoveryCard.querySelector("[data-action='next-discovery-photo']")?.setAttribute("aria-label", `${t("nextPhoto")} · ${photoLabel}`);

  const nextPhoto = DISCOVERY_PHOTOS[(normalizedIndex + 1) % total];
  if (nextPhoto.url) {
    const preload = new Image();
    preload.src = nextPhoto.url;
  }
}

const membership = createMembershipFeature({
  repository,
  bridge: createStoreKitBridge(),
  getLanguage: () => state.language,
  modalElement: modal,
  openModal, closeModal, showToast,
  likesRoot: document.querySelector("#plus-interest"),
});
const train = createTrainFeature({
  root: document.querySelector("#train-view"),
  repository,
  getLanguage: () => state.language,
  openModal, closeModal, showToast,
  onUpgrade: (reason) => membership.openPlus(reason),
});

const account = createAccountFeature({
  repository,
  getLanguage: () => state.language,
  translate: t,
  changeLanguage: applyLanguage,
  modalElement: modal,
  openModal,
  closeModal,
  profileEditorElement: profileEditor,
  settingsPanelElement: document.querySelector("#profile-settings-panel"),
  openProfileEditor,
  closeProfileEditor,
  showToast,
  verificationMark,
});

function showProfileSection(section = "profile") {
  document.querySelectorAll("[data-profile-section]").forEach((tab) => {
    const isActive = tab.dataset.profileSection === section;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });
  document.querySelectorAll("[data-profile-panel]").forEach((panel) => {
    panel.toggleAttribute("hidden", panel.dataset.profilePanel !== section);
  });
  if (section === "settings") account.renderSettingsPanel();
}

const onboarding = createOnboarding({
  onboardingRoot,
  appShell,
  onProfileChange: account.saveProfile,
  authenticate: repository.authenticate,
  restoreSession: repository.restoreSession,
  completeOnboarding: repository.completeOnboarding,
  getLanguage: () => state.language,
  prepareVisuals: createLaunchAssetPreparer(),
  onAuthenticated: async () => {
    sessionActive = true;
    switchTab("discover");
    void moments.start();
    void membership.refresh();
    await setDiscoveryState();
  },
  signOut: async () => {
    await repository.signOut();
    sessionActive = false;
  },
});

const chat = createChatFeature({
  getLanguage: () => state.language,
  translate: t,
  openModal,
  closeModal,
  showToast,
  switchTab,
  verificationMark,
});

const moments = createMomentsFeature({
  repository,
  getLanguage: () => state.language,
  translate: t,
  openModal,
  closeModal,
  showToast,
  switchTab,
  verificationMark,
  openConversation: chat.openConversation,
});

let toastTimer = null;

function showToast(message) {
  const text = String(message ?? "").trim();
  window.clearTimeout(toastTimer);
  if (!text) {
    toast.classList.add("hidden");
    return;
  }
  toast.querySelector("[data-toast-message]").textContent = text;
  toast.classList.remove("hidden");
  toastTimer = window.setTimeout(() => toast.classList.add("hidden"), 3200);
}

let modalTrigger = null;

function closeModal({ restoreFocus = true } = {}) {
  modalRoot.classList.add("hidden");
  modalRoot.setAttribute("aria-hidden", "true");
  modal.replaceChildren();
  modal.removeAttribute("aria-describedby");
  document.body.classList.remove("modal-open");
  if (onboardingRoot.classList.contains("hidden")) appShell.removeAttribute("inert");
  if (restoreFocus) {
    const target = modalTrigger?.isConnected ? modalTrigger : document.querySelector(".view.active button, .tab.active");
    target?.focus();
  }
  modalTrigger = null;
}

function openModal(content) {
  if (modalRoot.classList.contains("hidden")) modalTrigger = document.activeElement;
  modal.removeAttribute("aria-describedby");
  modal.innerHTML = content;
  modalRoot.classList.remove("hidden");
  modalRoot.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  appShell.setAttribute("inert", "");
  modal.querySelector("[data-autofocus], .close, button, input, select, textarea")?.focus();
}

let profileEditorTrigger = null;

function openProfileEditor() {
  profileEditorTrigger = document.activeElement;
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  profileEditor.classList.add("active");
  appShell.classList.add("profile-editor-open");
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.requestAnimationFrame(() => profileEditor.querySelector("#profile-editor-title")?.focus());
}

function closeProfileEditor({ restoreFocus = true } = {}) {
  appShell.classList.remove("profile-editor-open");
  switchTab("me");
  if (restoreFocus) window.requestAnimationFrame(() => profileEditorTrigger?.focus());
  profileEditorTrigger = null;
}

let discoveryRequestId = 0;

async function setDiscoveryState() {
  const requestId = ++discoveryRequestId;
  try {
    const result = await repository.discover({
      distanceKm: state.distance,
      sportId: state.selectedSportId,
      goal: state.discoveryPreferences.goal,
      schedule: state.discoveryPreferences.schedule,
    });
    if (requestId !== discoveryRequestId) return;
    const hasResults = result.state === "results";
    discoveryCard.classList.toggle("hidden", !hasResults);
    document.querySelector(".card-actions").classList.toggle("hidden", !hasResults);
    waitlist.classList.toggle("hidden", hasResults);
  } catch {
    if (requestId !== discoveryRequestId) return;
    discoveryCard.classList.add("hidden");
    document.querySelector(".card-actions").classList.add("hidden");
    waitlist.classList.remove("hidden");
    showToast(t("requestFailed"));
  }
}

function animateDiscoveryDecision(kind) {
  const actions = document.querySelector(".card-actions");
  discoveryCard.classList.remove("is-dragging", "is-resetting");
  discoveryCard.style.removeProperty("transform");
  discoveryCard.querySelectorAll(".swipe-stamp").forEach((stamp) => stamp.style.removeProperty("opacity"));
  discoveryCard.classList.add(kind === "like" ? "is-liking" : "is-skipping");
  actions.classList.add(kind === "like" ? "is-liking" : "is-skipping");
  window.setTimeout(() => {
    discoveryCard.classList.remove("is-liking", "is-skipping");
    actions.classList.remove("is-liking", "is-skipping");
    discoveryCard.animate([{ opacity: 0, transform: "translateY(22px) scale(.93)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], { duration: 380, easing: "cubic-bezier(.16,1,.3,1)" });
  }, 580);
}

function performDiscoveryDecision(kind) {
  if (kind === "like") {
    state.likesRemaining = Math.max(0, state.likesRemaining - 1);
    document.querySelector("#like-count").textContent = t("likes", state.likesRemaining);
    window.setTimeout(openMatchSuccess, 520);
  }
  animateDiscoveryDecision(kind);
}

const matchSuccessRoot = document.querySelector("#match-success-root");
const matchSuccessDialog = document.querySelector("#match-success-dialog");
let matchSuccessTrigger = null;

function currentMatchSuccessCopy() {
  return matchSuccessCopy[state.language] ?? matchSuccessCopy.en;
}

function closeMatchSuccess({ restoreFocus = true } = {}) {
  matchSuccessRoot.classList.add("hidden");
  matchSuccessRoot.setAttribute("aria-hidden", "true");
  document.body.classList.remove("match-success-open");
  appShell.removeAttribute("inert");
  matchSuccessDialog.replaceChildren();
  if (restoreFocus) matchSuccessTrigger?.focus();
  matchSuccessTrigger = null;
}

function openMatchSuccess() {
  const copy = currentMatchSuccessCopy();
  matchSuccessTrigger = document.activeElement;
  matchSuccessDialog.innerHTML = `
    <button class="match-success-close" data-action="close-match-success" aria-label="${copy.close}">×</button>
    <div class="match-success-intro">
      <p class="match-success-kicker">${copy.kicker}</p>
      <h2 id="match-success-title">${copy.title}</h2>
      <p id="match-success-description" class="match-success-description"><strong>Maya</strong> ${copy.description.replace(/^Maya\s*/, "")}</p>
      <div class="match-success-sports" aria-label="${t("mayaActivity")}">
        <span class="match-sport-chip match-sport-run" data-match-sport="0"><span>RUN</span></span>
        <span class="match-sport-chip match-sport-cycle" data-match-sport="1"><span>RIDE</span></span>
        <span class="match-sport-chip match-sport-strength" data-match-sport="2"><span>LIFT</span></span>
      </div>
    </div>
    <img class="match-route-art" src="assets/match-route-ribbon.png" alt="" aria-hidden="true" />
    <div class="match-success-hero" aria-hidden="true">
      <div class="match-identity-card match-maya-card"><span class="match-card-name">MAYA</span><span class="match-card-verified">✓</span></div>
      <div class="match-identity-card match-kevin-card"><span class="match-card-name">KEVIN</span><strong>K</strong></div>
    </div>
    <button class="match-success-chat" data-action="open-match-chat">${copy.chat}</button>
  `;

  const existingSportLogos = document.querySelectorAll("#discovery-card .sport-logo");
  matchSuccessDialog.querySelectorAll("[data-match-sport]").forEach((chip) => {
    const source = existingSportLogos[Number(chip.dataset.matchSport)];
    const fallback = chip.querySelector("span");
    if (!source) return;
    chip.replaceChildren(source.cloneNode(true));
    fallback?.remove();
  });

  const discoveryPhoto = discoveryCard.querySelector("[data-discovery-photo]");
  const mayaMatchCard = matchSuccessDialog.querySelector(".match-maya-card");
  const discoveryPhotoStyle = getComputedStyle(discoveryPhoto);
  mayaMatchCard.style.backgroundImage = discoveryPhotoStyle.backgroundImage;
  mayaMatchCard.style.backgroundPosition = discoveryPhotoStyle.backgroundPosition;

  matchSuccessRoot.classList.remove("hidden");
  matchSuccessRoot.setAttribute("aria-hidden", "false");
  document.body.classList.add("match-success-open");
  appShell.setAttribute("inert", "");
  matchSuccessDialog.querySelector(".match-success-close")?.focus();
}

let swipePointerId = null;
let swipeStartX = 0;
let swipeStartY = 0;
let swipeDeltaX = 0;

function updateSwipeCard(deltaX, deltaY) {
  const rotation = Math.max(-14, Math.min(14, deltaX / 16));
  const scale = 1 - Math.min(.025, Math.abs(deltaX) / 9000);
  discoveryCard.style.transform = `translate3d(${deltaX}px,${deltaY * 0.08}px,0) rotate(${rotation}deg) scale(${scale})`;
  const strength = Math.min(1, Math.abs(deltaX) / 76);
  discoveryCard.querySelector(".swipe-like").style.opacity = deltaX > 0 ? strength : 0;
  discoveryCard.querySelector(".swipe-skip").style.opacity = deltaX < 0 ? strength : 0;
}

function finishSwipe(event) {
  if (event.pointerId !== swipePointerId) return;
  const completedDirection = Math.abs(swipeDeltaX) >= 78 ? (swipeDeltaX > 0 ? "like" : "skip") : null;
  swipePointerId = null;
  if (completedDirection) {
    performDiscoveryDecision(completedDirection);
    return;
  }
  discoveryCard.classList.remove("is-dragging");
  discoveryCard.classList.add("is-resetting");
  updateSwipeCard(0, 0);
  window.setTimeout(() => {
    discoveryCard.classList.remove("is-resetting");
    discoveryCard.style.removeProperty("transform");
    discoveryCard.querySelectorAll(".swipe-stamp").forEach((stamp) => stamp.style.removeProperty("opacity"));
  }, 300);
}

discoveryCard.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button, input, select, textarea")) return;
  swipePointerId = event.pointerId;
  swipeStartX = event.clientX;
  swipeStartY = event.clientY;
  swipeDeltaX = 0;
  discoveryCard.classList.add("is-dragging");
  discoveryCard.setPointerCapture?.(event.pointerId);
});

discoveryCard.addEventListener("pointermove", (event) => {
  if (event.pointerId !== swipePointerId) return;
  swipeDeltaX = event.clientX - swipeStartX;
  const deltaY = event.clientY - swipeStartY;
  if (Math.abs(swipeDeltaX) > 6) event.preventDefault();
  updateSwipeCard(swipeDeltaX, deltaY);
});

discoveryCard.addEventListener("pointerup", finishSwipe);
discoveryCard.addEventListener("pointercancel", finishSwipe);

function switchTab(tab) {
  appShell.classList.remove("profile-editor-open");
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelector(`#${tab}-view`)?.classList.add("active");
  document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  if (tab === "train") void train.refresh();
  if (tab === "connect") void membership.refresh();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function discoveryFilters() { return discoveryFilterCopy[state.language] ?? discoveryFilterCopy.en; }

function updateDiscoverySummary() {
  const selectedSportId = state.selectedSportId;
  document.querySelector('[data-action="filter-sport-all"]')?.classList.toggle("active", !selectedSportId);
  document.querySelectorAll('[data-action="filter-sport"]').forEach((button) => {
    const isSelected = selectedSportId === button.dataset.sportId;
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-pressed", isSelected);
  });
  const hasOtherSport = Boolean(selectedSportId && !POPULAR_SPORT_IDS.includes(selectedSportId));
  document.querySelector('[data-action="open-other-sports"]')?.classList.toggle("active", hasOtherSport);
  document.querySelector('[data-action="open-other-sports"]')?.setAttribute("aria-pressed", hasOtherSport);
}

function openSportFilter() {
  const copy = discoveryFilters();
  const catalogCopy = sportCatalogCopy[state.language] ?? sportCatalogCopy.en;
  openModal(`
    <header><div><p class="eyebrow">${copy.eyebrow}</p><h2 id="modal-title">${copy.sportTitle}</h2></div><button class="close" data-action="close-modal" aria-label="${t("close")}">×</button></header>
    <p>${singleSportText[state.language] ?? singleSportText.en}</p>
    <div class="sport-catalog-tools"><input id="sport-catalog-search" type="search" placeholder="${catalogCopy.search}" aria-label="${catalogCopy.search}"/><span>${catalogCopy.count(SPORTS.length)}</span></div>
    <form id="discovery-sport-form"><div id="discovery-sport-options" class="sport-picker sport-catalog-grid"><button class="sport-option${state.selectedSportId === null ? " is-selected" : ""}" type="button" data-filter-sport-id="" aria-pressed="${state.selectedSportId === null}">${copy.all}</button>${SPORTS.map((item) => `<button class="sport-option${state.selectedSportId === item.id ? " is-selected" : ""}" type="button" data-filter-sport-id="${item.id}" data-search-text="${Object.values(item.labels).join(" ").toLowerCase()}" aria-pressed="${state.selectedSportId === item.id}">${getSportLabel(item.id, state.language)}</button>`).join("")}</div><button class="primary-button sport-filter-save" type="submit">${copy.apply}</button></form>
  `);
  modal.querySelectorAll("[data-filter-sport-id]").forEach((button) => button.addEventListener("click", () => {
    modal.querySelectorAll("[data-filter-sport-id]").forEach((option) => { option.classList.remove("is-selected"); option.setAttribute("aria-pressed", "false"); });
    button.classList.add("is-selected");
    button.setAttribute("aria-pressed", "true");
  }));
  document.querySelector("#sport-catalog-search").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    modal.querySelectorAll("[data-filter-sport-id]").forEach((button) => {
      const matches = button.dataset.filterSportId === "" || !query || button.dataset.searchText?.includes(query) || button.textContent.toLowerCase().includes(query);
      button.classList.toggle("is-filtered-out", !matches);
    });
  });
  document.querySelector("#discovery-sport-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const selectedButton = modal.querySelector("[data-filter-sport-id].is-selected");
    state.selectedSportId = selectedButton?.dataset.filterSportId || null;
    closeModal();
    updateDiscoverySummary();
    setDiscoveryState();
  });
}

function openDiscoveryEditor() {
  const copy = discoveryFilters();
  openModal(`
    <header><div><p class="eyebrow">${copy.eyebrow}</p><h2 id="modal-title">${copy.prefsTitle}</h2></div><button class="close" data-action="close-modal" aria-label="${t("close")}">×</button></header>
    <form id="discovery-editor-form">
      <label class="editor-distance-label"><span>${t("distance")}</span><strong id="editor-distance-value">${state.distance} km</strong><input id="editor-distance-range" name="distance" type="range" min="2" max="50" value="${state.distance}" /></label>
      <div class="form-row"><label>${copy.goal}<select name="goal">${copy.goals.map((item, index) => `<option value="${DISCOVERY_GOAL_IDS[index]}"${state.discoveryPreferences.goal === DISCOVERY_GOAL_IDS[index] ? " selected" : ""}>${item}</option>`).join("")}</select></label><label>${copy.schedule}<select name="schedule">${copy.schedules.map((item, index) => `<option value="${DISCOVERY_SCHEDULE_IDS[index]}"${state.discoveryPreferences.schedule === DISCOVERY_SCHEDULE_IDS[index] ? " selected" : ""}>${item}</option>`).join("")}</select></label></div>
      <button class="primary-button compact-save-button" type="submit">${copy.save}</button>
    </form>
  `);
  const editorRange = document.querySelector("#editor-distance-range");
  editorRange.addEventListener("input", () => { document.querySelector("#editor-distance-value").textContent = `${editorRange.value} km`; });
  document.querySelector("#discovery-editor-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    state.distance = Number(form.get("distance"));
    state.discoveryPreferences = { goal: form.get("goal"), schedule: form.get("schedule") };
    closeModal();
    updateDiscoverySummary();
    setDiscoveryState();
  });
}

function flow() { return flowCopy[state.language] ?? flowCopy.en; }

function verification() { return verificationCopy[state.language] ?? verificationCopy.en; }

function verificationMark(label = verification().label) {
  return `<button class="verification-mark" data-action="open-verification" aria-label="${label}" title="${label}"><span aria-hidden="true">✓</span></button>`;
}

function openVerification(step = 0) {
  const copy = verification();
  const page = copy.pages[step];
  const isCameraStep = step === copy.pages.length - 1;
  openModal(`
    <div class="verification-flow">
      <header><div><p class="eyebrow">${page.eyebrow}</p><h2 id="modal-title">${page.title}</h2></div><button class="close" data-action="close-modal" aria-label="${t("close")}">×</button></header>
      ${isCameraStep ? `<div class="face-frame" aria-hidden="true"><span></span></div>` : `<div class="verification-portrait" aria-hidden="true"><span class="verification-mark"><span>✓</span></span></div>`}
      <p class="verification-copy">${page.text}</p>
      ${page.points.length ? `<div class="verification-points">${page.points.map((point) => `<div><span aria-hidden="true">✓</span><p>${point}</p></div>`).join("")}</div>` : ""}
      <div class="verification-footer"><div class="step-dots" aria-label="${copy.step(step + 1)}">${copy.pages.map((_, index) => `<span class="${index === step ? "active" : ""}"></span>`).join("")}</div><button class="verification-cta" data-action="${isCameraStep ? "finish-verification" : "verification-next"}" data-step="${step + 1}">${page.action}</button></div>
    </div>
  `);
}

document.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "home") switchTab("discover");
  if (action === "close-modal") closeModal();
  if (action === "close-match-success") closeMatchSuccess();
  if (action === "open-match-chat") { closeMatchSuccess({ restoreFocus: false }); state.chatReturnTab = "connect"; chat.openConversation(); }
  if (action === "open-chat") { state.chatReturnTab = "connect"; chat.openChat(); }
  if (action === "open-invite") chat.openInvite();
  if (action === "show-profile-section") {
    showProfileSection(event.target.closest("[data-profile-section]")?.dataset.profileSection);
  }
  if (action === "open-billing") membership.openBilling();
  if (action === "open-privacy") account.openPrivacy();
  if (action === "open-delete") account.openDelete();
  if (action === "open-plus") membership.openPlus();
  if (action === "open-language") account.openLanguage();
  if (action === "logout") {
    const button = event.target.closest("button");
    button.disabled = true;
    try {
      showToast("");
      switchTab("discover");
      showProfileSection("profile");
      await onboarding.logout();
    } catch {
      button.disabled = false;
      showToast(t("requestFailed"));
    }
  }
  if (action === "edit-profile") account.openEditProfile();
  if (action === "open-conversation") { closeModal(); state.chatReturnTab = "connect"; chat.openConversation(); }
  if (action === "back-from-chat") switchTab(state.chatReturnTab || "connect");
  if (action === "show-chat-section") chat.setSection(event.target.closest("[data-chat-section]")?.dataset.chatSection);
  if (action === "open-maya-profile") chat.openMayaProfile();
  if (action === "open-feed-profile") {
    state.chatReturnTab = "moments";
    moments.openProfile(event.target.closest("[data-post-id]")?.dataset.postId);
  }
  if (action === "open-feed-comments") moments.openComments(event.target.closest("[data-post-id]")?.dataset.postId);
  if (action === "open-moment-publisher") moments.openPublisher();
  if (action === "toggle-feed-like") await moments.toggleLike(event.target.closest("[data-post-id]")?.dataset.postId);
  if (action === "open-verification") openVerification(0);
  if (action === "open-discovery-editor") openDiscoveryEditor();
  if (action === "open-other-sports") openSportFilter();
  if (action === "filter-sport-all") {
    state.selectedSportId = null;
    updateDiscoverySummary();
    setDiscoveryState();
  }
  if (action === "filter-sport") {
    const sportId = event.target.closest("[data-sport-id]")?.dataset.sportId;
    state.selectedSportId = state.selectedSportId === sportId ? null : sportId;
    updateDiscoverySummary();
    setDiscoveryState();
  }
  if (action === "previous-discovery-photo") setDiscoveryPhoto(state.discoveryPhotoIndex - 1);
  if (action === "next-discovery-photo") setDiscoveryPhoto(state.discoveryPhotoIndex + 1);
  if (action === "verification-next") openVerification(Number(event.target.closest("[data-step]")?.dataset.step ?? 0));
  if (action === "finish-verification") { closeModal(); showToast(verification().ready); }
  if (action === "like") performDiscoveryDecision("like");
  if (action === "skip") performDiscoveryDecision("skip");
  if (action === "show-intent") await membership.openDirectInvite({ id: "maya", name: "Maya" });
  if (action === "open-incoming-likes") await membership.openIncomingLikes();
  if (action === "open-notifications") {
    state.unreadNotifications = 0;
    renderNotificationBadge();
    showToast(flow().toast.notifications);
  }
  if (action === "delete-account") account.deleteAccount();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Tab" && !modalRoot.classList.contains("hidden")) {
    const controls = [...modal.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
      event.preventDefault(); first?.focus();
    }
  }
  if (event.key === "Escape" && !matchSuccessRoot.classList.contains("hidden")) closeMatchSuccess();
  else if (event.key === "Escape" && !modalRoot.classList.contains("hidden")) closeModal();
  else if (event.key === "Escape" && profileEditor.classList.contains("active")) account.closeEditProfile();
});

document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));
try {
  const savedLanguage = localStorage.getItem("pace-language");
  if (savedLanguage && translations[savedLanguage]) state.language = savedLanguage;
} catch { /* local storage is optional in the prototype */ }
applyLanguage(state.language);
void onboarding.start();
