import { canSendMarketing, dateAfterToday, validateProfile } from "../app_logic.mjs?v=pace-release-audit-58";
import { SPORTS, getSportLabel } from "../sport_catalog.mjs?v=pace-release-audit-58";
import { flowCopy, languageNames, profileCopy } from "./app_copy.mjs?v=pace-release-audit-58";
import { escapeHtml } from "./dom.mjs?v=pace-release-audit-58";
import { photoFocusStyle, withDefaultPhotoFocus } from "./photo_presentation.mjs?v=pace-release-audit-58";

export function createAccountFeature({
  repository,
  getLanguage,
  translate,
  changeLanguage,
  modalElement,
  openModal,
  closeModal,
  profileEditorElement,
  settingsPanelElement,
  openProfileEditor,
  closeProfileEditor,
  showToast,
  verificationMark,
}) {
  const accountState = {
    marketingOptIn: true,
    deletedAt: null,
    profile: {
      height: "",
      ethnicity: "",
      showHeight: false,
      showEthnicity: false,
      sports: ["running", "cycling", "tennis"],
      frequency: "4× / week",
      bio: "",
      photos: [],
    },
  };
  let editorAbortController = null;
  let draftPhotos = [];

  function parseHeight(height) {
    const raw = String(height ?? "").trim();
    const metric = raw.match(/^(\d+(?:\.\d+)?)\s*cm$/i);
    const imperial = raw.match(/^(\d)\s*(?:ft|['′])\s*(\d{1,2})?\s*(?:in|[\"″])?$/i);
    const numeric = Number(metric?.[1] ?? (raw.match(/^\d+(?:\.\d+)?$/)?.[0] ?? ""));
    const totalInches = imperial ? (Number(imperial[1]) * 12) + Number(imperial[2] || 0) : (Number.isFinite(numeric) && numeric > 0 ? numeric / 2.54 : 0);
    const centimetres = imperial ? totalInches * 2.54 : numeric;
    const roundedInches = Math.round(totalInches);
    return {
      unit: imperial ? "imperial" : "metric",
      centimetres: Number.isFinite(centimetres) && centimetres > 0 ? String(Math.round(centimetres * 10) / 10) : "",
      totalInches: totalInches ? String(roundedInches) : "",
      feet: totalInches ? String(Math.floor(roundedInches / 12)) : "",
      inches: totalInches ? String(roundedInches % 12) : "",
    };
  }

  function heightFromForm(form) {
    if (form.get("heightUnit") === "imperial") {
      const totalInches = Number(form.get("heightImperial"));
      return totalInches ? `${Math.floor(totalInches / 12)}′${totalInches % 12}″` : "";
    }
    const centimetres = Number(form.get("heightCm"));
    return centimetres ? `${Math.round(centimetres * 10) / 10} cm` : "";
  }

  function pickerOptions({ min, max, selected, emptyLabel = "—" }) {
    const selectedValue = String(Math.round(Number(selected)) || "");
    return [
      `<option value=""${selectedValue ? "" : " selected"}>${emptyLabel}</option>`,
      ...Array.from({ length: max - min + 1 }, (_, offset) => {
        const value = String(min + offset);
        return `<option value="${value}"${value === selectedValue ? " selected" : ""}>${value}</option>`;
      }),
    ].join("");
  }

  function imperialPickerOptions(selected) {
    const selectedValue = String(Math.round(Number(selected)) || "");
    return [
      `<option value=""${selectedValue ? "" : " selected"}>—</option>`,
      ...Array.from({ length: 60 }, (_, offset) => {
        const totalInches = 36 + offset;
        const value = String(totalInches);
        const label = `${Math.floor(totalInches / 12)}′ ${totalInches % 12}″`;
        return `<option value="${value}"${value === selectedValue ? " selected" : ""}>${label}</option>`;
      }),
    ].join("");
  }

  function currentFlow() {
    const language = getLanguage();
    return flowCopy[language] ?? flowCopy.en;
  }

  function publicProfileDetails() {
    const { profile } = accountState;
    return [profile.showHeight && profile.height ? profile.height : null, profile.showEthnicity && profile.ethnicity ? profile.ethnicity : null].filter(Boolean);
  }

  function renderProfileDetails() {
    const target = document.querySelector("#profile-card-details");
    if (!target) return;
    const details = publicProfileDetails();
    target.hidden = details.length === 0;
    target.innerHTML = details.length ? `<div>${details.map((detail) => `<span>${escapeHtml(detail)}</span>`).join("")}</div>` : "";
  }

  async function saveProfile(profile) {
    const nextProfile = { ...accountState.profile, ...profile };
    const savedProfile = await repository.saveProfile(nextProfile);
    Object.assign(accountState.profile, savedProfile);
    renderProfileDetails();
    return { ...accountState.profile };
  }

  function renderSettingsPanel() {
    if (!settingsPanelElement) return;
    settingsPanelElement.innerHTML = `
      <header class="profile-settings-intro"><h2>${translate("accountPreferences")}</h2></header>
      <div class="profile-settings-list">
        <button data-action="open-language"><span>${translate("language")}</span><span>${languageNames[getLanguage()]} ›</span></button>
        <button data-action="open-billing"><span>${translate("billing")}</span><span>›</span></button>
        <button data-action="open-privacy"><span>${translate("privacy")}</span><span>›</span></button>
        <button data-action="logout"><span>${translate("logout")}</span><span>›</span></button>
        <button data-action="open-delete"><span>${translate("deleteAccount")}</span><span>›</span></button>
      </div>
    `;
  }

  function openLanguage() {
    openModal(`
      <header><div><p class="eyebrow">${translate("settings")}</p><h2 id="modal-title">${translate("languageTitle")}</h2></div><button class="close" data-action="close-modal" aria-label="${translate("close")}">×</button></header>
      <p>${translate("languageCaption")}</p>
      <div class="settings-list">${Object.entries(languageNames).map(([code, label]) => `<button data-language="${code}"><span>${label}</span><span>${getLanguage() === code ? "✓" : ""}</span></button>`).join("")}</div>
    `);
    modalElement.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => {
      changeLanguage(button.dataset.language);
      renderSettingsPanel();
      closeModal();
    }));
  }

  function openPrivacy() {
    const copy = currentFlow().privacy;
    openModal(`
      <header><div><p class="eyebrow">${copy.eyebrow}</p><h2 id="modal-title">${copy.title}</h2></div><button class="close" data-action="close-modal" aria-label="${translate("close")}">×</button></header>
      <p>${copy.text}</p>
      <div class="settings-list" role="list">
        <button data-action="open-verification"><span>${copy.selfie}</span><span class="verification-mark" role="img" aria-label="${copy.passed}"><span aria-hidden="true">✓</span></span></button>
        <div class="settings-data-row" role="listitem"><span>Garmin</span><span class="data-badge">${copy.connected}</span></div>
        <div class="settings-data-row" role="listitem"><span>Apple Health</span><span>${copy.notConnected}</span></div>
      </div>
    `);
  }

  function openDelete() {
    const copy = currentFlow().deletion;
    openModal(`
      <header><div><p class="eyebrow">${copy.eyebrow}</p><h2 id="modal-title">${copy.title}</h2></div><button class="close" data-action="close-modal" aria-label="${translate("close")}">×</button></header>
      <p>${copy.text}</p>
      <button class="danger-button" data-action="delete-account">${copy.confirm}</button>
    `);
  }

  function deleteAccount() {
    accountState.deletedAt = dateAfterToday(0);
    closeModal();
    const canMarket = canSendMarketing({
      marketingOptIn: accountState.marketingOptIn,
      cancelledAt: null,
      deletedAt: accountState.deletedAt,
    });
    showToast(canMarket ? "" : currentFlow().deletion.done);
  }

  function editorPhotoGrid(copy) {
    const photos = draftPhotos.map((photo, index) => `
      <figure class="profile-editor-photo">
        <img src="${escapeHtml(photo.url)}" style="${photoFocusStyle(photo)}" alt="${escapeHtml(copy.photoAlt)} ${index + 1}" />
        <button type="button" data-remove-profile-photo data-photo-id="${escapeHtml(photo.id)}" aria-label="${escapeHtml(copy.removePhoto)} ${index + 1}"><span class="material-symbols-rounded" aria-hidden="true">close</span></button>
      </figure>
    `).join("");
    const emptySlots = Array.from({ length: Math.max(0, 6 - draftPhotos.length) }, (_, index) => `
      <button class="profile-editor-photo-add" type="button" data-add-profile-photo aria-label="${escapeHtml(copy.addPhoto)} ${draftPhotos.length + index + 1}">
        <span class="material-symbols-rounded" aria-hidden="true">add_photo_alternate</span>
        <small>${copy.addPhoto}</small>
      </button>
    `).join("");
    return `${photos}${emptySlots}`;
  }

  function renderEditorPhotoGrid(copy) {
    const grid = profileEditorElement.querySelector("[data-profile-photo-grid]");
    if (grid) grid.innerHTML = editorPhotoGrid(copy);
    const count = profileEditorElement.querySelector("[data-profile-photo-count]");
    if (count) count.textContent = `${draftPhotos.length}/6`;
  }

  function selectedEditorSports() {
    return [...profileEditorElement.querySelectorAll("[data-profile-sport-id].is-selected")].map((button) => button.dataset.profileSportId);
  }

  function renderEditorPreview(copy) {
    const formElement = profileEditorElement.querySelector("#profile-form");
    const preview = profileEditorElement.querySelector("[data-profile-preview]");
    if (!formElement || !preview) return;
    const form = new FormData(formElement);
    const customSports = String(form.get("custom-sports") ?? "").split(",").map((sport) => sport.trim()).filter(Boolean);
    const sports = [...selectedEditorSports().map((sportId) => getSportLabel(sportId, getLanguage())), ...customSports];
    const firstPhoto = draftPhotos[0];
    const height = heightFromForm(form);
    const visibleDetails = [
      form.get("showHeight") === "on" && height,
      form.get("showEthnicity") === "on" && String(form.get("ethnicity") ?? "").trim(),
    ].filter(Boolean);
    preview.innerHTML = `
      <article class="profile-editor-preview-card">
        ${firstPhoto ? `<img src="${escapeHtml(firstPhoto.url)}" style="${photoFocusStyle(firstPhoto)}" alt="${escapeHtml(copy.photoAlt)} 1" />` : `<div class="profile-editor-preview-avatar" aria-hidden="true">K</div>`}
        <div class="profile-editor-preview-copy">
          <div><h2>Kevin</h2><span class="material-symbols-rounded" aria-label="${translate("selfieVerified")}">verified</span></div>
          <p>${escapeHtml(String(form.get("bio") ?? "").trim() || copy.bioPlaceholder)}</p>
          <div class="profile-editor-preview-tags">${sports.map((sport) => `<span>${escapeHtml(sport)}</span>`).join("")}</div>
          <small>${escapeHtml(String(form.get("frequency") ?? ""))}</small>
          ${visibleDetails.length ? `<div class="profile-editor-preview-details">${visibleDetails.map((detail) => `<span>${escapeHtml(detail)}</span>`).join("")}</div>` : ""}
        </div>
      </article>
    `;
  }

  function setEditorPanel(panel, copy) {
    profileEditorElement.querySelectorAll("[data-profile-editor-panel]").forEach((button) => {
      const isActive = button.dataset.profileEditorPanel === panel;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });
    profileEditorElement.querySelector("#profile-editor-edit-panel")?.toggleAttribute("hidden", panel !== "edit");
    profileEditorElement.querySelector("#profile-editor-preview-panel")?.toggleAttribute("hidden", panel !== "preview");
    if (panel === "preview") renderEditorPreview(copy);
  }

  function discardEditorDraft() {
    const savedUrls = new Set((accountState.profile.photos ?? []).map((photo) => photo.url));
    draftPhotos.filter((photo) => !savedUrls.has(photo.url) && photo.url.startsWith("blob:")).forEach((photo) => URL.revokeObjectURL(photo.url));
  }

  function closeEditProfile() {
    discardEditorDraft();
    editorAbortController?.abort();
    closeProfileEditor();
  }

  function openEditProfile() {
    const language = getLanguage();
    const copy = profileCopy[language] ?? profileCopy.en;
    const selected = new Set(accountState.profile.sports?.length ? accountState.profile.sports : ["running", "cycling", "tennis"]);
    const height = parseHeight(accountState.profile.height);
    draftPhotos = (accountState.profile.photos ?? []).map(withDefaultPhotoFocus);
    editorAbortController?.abort();
    editorAbortController = new AbortController();
    const { signal } = editorAbortController;

    profileEditorElement.innerHTML = `
      <header class="profile-editor-topbar">
        <button type="button" data-profile-editor-cancel>${copy.cancel}</button>
        <h1 id="profile-editor-title" tabindex="-1">${copy.eyebrow}</h1>
        <button type="submit" form="profile-form">${copy.done}</button>
      </header>
      <nav class="profile-editor-tabs" role="tablist" aria-label="${copy.editorSections}">
        <button class="active" type="button" role="tab" aria-selected="true" aria-controls="profile-editor-edit-panel" data-profile-editor-panel="edit">${copy.edit}</button>
        <button type="button" role="tab" aria-selected="false" aria-controls="profile-editor-preview-panel" data-profile-editor-panel="preview" tabindex="-1">${copy.preview}</button>
      </nav>
      <div id="profile-editor-edit-panel" class="profile-editor-panel" role="tabpanel">
        <form id="profile-form" novalidate>
          <section class="profile-editor-section profile-editor-photos" aria-labelledby="profile-editor-photos-title">
            <header><div><h2 id="profile-editor-photos-title">${copy.photos}</h2></div><span data-profile-photo-count>${draftPhotos.length}/6</span></header>
            <input id="profile-editor-photo-input" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label="${escapeHtml(copy.addPhoto)}" multiple />
            <div class="profile-editor-photo-grid" data-profile-photo-grid>${editorPhotoGrid(copy)}</div>
          </section>
          <section class="profile-editor-section" aria-labelledby="profile-editor-sports-title">
            <header><div><h2 id="profile-editor-sports-title">${copy.sports}</h2><p>${copy.sportsHelp}</p></div></header>
            <div class="sport-picker profile-sport-catalog">${SPORTS.map((item) => `<button class="sport-option${selected.has(item.id) ? " is-selected" : ""}" type="button" data-profile-sport-id="${item.id}" aria-pressed="${selected.has(item.id)}">${getSportLabel(item.id, language)}</button>`).join("")}</div>
            <label class="profile-editor-field"><span>${copy.custom}</span><input name="custom-sports" placeholder="${copy.customPlaceholder}" /></label>
            <label class="profile-editor-field"><span>${copy.frequency}</span><select name="frequency">${["1–2× / week", "3–4× / week", "4× / week", "5+× / week"].map((value) => `<option${accountState.profile.frequency === value ? " selected" : ""}>${value}</option>`).join("")}</select></label>
          </section>
          <section class="profile-editor-section profile-editor-about" aria-labelledby="profile-editor-bio-title">
            <header><div><h2 id="profile-editor-bio-title">${copy.aboutYou}</h2><p>${copy.aboutHelp}</p></div></header>
            <label class="profile-editor-field"><span class="visually-hidden">${copy.bio}</span><textarea name="bio" maxlength="300" placeholder="${copy.bioPlaceholder}">${escapeHtml(accountState.profile.bio ?? "")}</textarea></label>
          </section>
          <section class="profile-editor-section profile-editor-details" aria-labelledby="profile-editor-details-title">
            <header><div><h2 id="profile-editor-details-title">${copy.personalDetails}</h2><p>${copy.detailsHelp}</p></div></header>
            <fieldset class="profile-editor-field profile-height-field">
              <legend>${copy.height}</legend>
              <div class="profile-height-entry">
              <fieldset class="height-unit-control">
                <legend class="visually-hidden">${copy.heightUnit}</legend>
                <div class="height-unit-segments">
                  <label><input name="heightUnit" type="radio" value="metric"${height.unit === "metric" ? " checked" : ""} /><span>cm</span></label>
                  <label><input name="heightUnit" type="radio" value="imperial"${height.unit === "imperial" ? " checked" : ""} /><span>ft</span></label>
                </div>
              </fieldset>
              <div class="height-measurements" data-height-measurements="metric"${height.unit === "metric" ? "" : " hidden"}>
                <label class="height-picker"><span class="visually-hidden">${copy.heightCm}</span><select name="heightCm" aria-label="${escapeHtml(copy.heightCm)}">${pickerOptions({ min: 100, max: 250, selected: height.centimetres })}</select><strong aria-hidden="true">cm</strong></label>
              </div>
              <div class="height-measurements height-measurements-imperial" data-height-measurements="imperial"${height.unit === "imperial" ? "" : " hidden"}>
                <label class="height-picker"><span class="visually-hidden">${copy.feetAndInches}</span><select name="heightImperial" aria-label="${escapeHtml(copy.feetAndInches)}">${imperialPickerOptions(height.totalInches)}</select><strong aria-hidden="true">ft</strong></label>
              </div>
              </div>
              <label class="detail-visibility-toggle"><span><span class="material-symbols-rounded" aria-hidden="true">visibility</span>${copy.showOnProfile}</span><input name="showHeight" type="checkbox" role="switch" aria-label="${escapeHtml(copy.showHeight)}"${accountState.profile.showHeight ? " checked" : ""} /></label>
            </fieldset>
            <div class="profile-editor-field personal-detail-control"><label for="profile-ethnicity">${copy.ethnicity}</label><input id="profile-ethnicity" name="ethnicity" value="${escapeHtml(accountState.profile.ethnicity)}" maxlength="80" placeholder="${copy.ethnicityPlaceholder}" /><label class="detail-visibility-toggle"><span><span class="material-symbols-rounded" aria-hidden="true">visibility</span>${copy.showOnProfile}</span><input name="showEthnicity" type="checkbox" role="switch" aria-label="${escapeHtml(copy.showEthnicity)}"${accountState.profile.showEthnicity ? " checked" : ""} /></label></div>
          </section>
          <footer class="profile-editor-footer"><button class="onboarding-button onboarding-button-primary" type="submit" form="profile-form">${copy.saveChanges}</button></footer>
        </form>
      </div>
      <section id="profile-editor-preview-panel" class="profile-editor-panel" role="tabpanel" data-profile-preview hidden></section>
    `;
    openProfileEditor();

    profileEditorElement.querySelector("[data-profile-editor-cancel]").addEventListener("click", closeEditProfile, { signal });
    const heightUnits = [...profileEditorElement.querySelectorAll('[name="heightUnit"]')];
    let activeHeightUnit = heightUnits.find((input) => input.checked)?.value ?? "metric";
    const syncHeightUnit = ({ convert = false } = {}) => {
        const activeUnit = heightUnits.find((input) => input.checked)?.value ?? "metric";
      if (convert && activeUnit !== activeHeightUnit) {
        const centimetresSelect = profileEditorElement.querySelector('[name="heightCm"]');
        const imperialSelect = profileEditorElement.querySelector('[name="heightImperial"]');
        if (activeUnit === "imperial" && centimetresSelect.value) {
          const totalInches = Math.round(Number(centimetresSelect.value) / 2.54);
          imperialSelect.value = String(totalInches);
        } else if (activeUnit === "metric" && imperialSelect.value) {
          centimetresSelect.value = String(Math.round(Number(imperialSelect.value) * 2.54));
        }
      }
      activeHeightUnit = activeUnit;
      profileEditorElement.querySelectorAll("[data-height-measurements]").forEach((group) => {
        const isActive = group.dataset.heightMeasurements === activeUnit;
        group.toggleAttribute("hidden", !isActive);
        group.querySelectorAll("select").forEach((select) => { select.disabled = !isActive; });
      });
    };
    heightUnits.forEach((input) => input.addEventListener("change", () => syncHeightUnit({ convert: true }), { signal }));
    syncHeightUnit();
    profileEditorElement.querySelectorAll("[data-profile-editor-panel]").forEach((button) => button.addEventListener("click", () => setEditorPanel(button.dataset.profileEditorPanel, copy), { signal }));
    profileEditorElement.querySelectorAll("[data-profile-sport-id]").forEach((button) => button.addEventListener("click", () => {
      button.classList.toggle("is-selected");
      button.setAttribute("aria-pressed", button.classList.contains("is-selected"));
    }, { signal }));
    profileEditorElement.addEventListener("click", (event) => {
      if (event.target.closest("[data-add-profile-photo]")) profileEditorElement.querySelector("#profile-editor-photo-input").click();
      const removeButton = event.target.closest("[data-remove-profile-photo]");
      if (!removeButton) return;
      draftPhotos = draftPhotos.filter((photo) => photo.id !== removeButton.dataset.photoId);
      renderEditorPhotoGrid(copy);
    }, { signal });
    profileEditorElement.querySelector("#profile-editor-photo-input").addEventListener("change", (event) => {
      const files = [...event.target.files].filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type)).slice(0, Math.max(0, 6 - draftPhotos.length));
      draftPhotos.push(...files.map((file) => withDefaultPhotoFocus({ id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file) })));
      event.target.value = "";
      renderEditorPhotoGrid(copy);
    }, { signal });
    profileEditorElement.querySelector("#profile-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!event.target.checkValidity()) return event.target.reportValidity();
      const form = new FormData(event.target);
      const selectedSports = selectedEditorSports();
      const customSports = String(form.get("custom-sports") ?? "").split(",").map((sport) => sport.trim()).filter(Boolean);
      if (selectedSports.length + customSports.length === 0) return showToast(copy.sportsRequired);
      const validation = validateProfile({ bio: String(form.get("bio") ?? ""), sports: [...selectedSports, ...customSports], photos: draftPhotos.length });
      if (!validation.valid) return showToast(validation.errors[0]);
      const removedPhotoUrls = new Set((accountState.profile.photos ?? []).map((photo) => photo.url));
      draftPhotos.forEach((photo) => removedPhotoUrls.delete(photo.url));
      const submits = [...profileEditorElement.querySelectorAll('[type="submit"][form="profile-form"]')];
      if (submits.some((button) => button.disabled)) return;
      submits.forEach((button) => { button.disabled = true; });
      try {
        await saveProfile({
          height: heightFromForm(form),
          ethnicity: String(form.get("ethnicity") ?? "").trim(),
          showHeight: form.get("showHeight") === "on",
          showEthnicity: form.get("showEthnicity") === "on",
          sports: selectedSports,
          customSports,
          frequency: String(form.get("frequency") ?? ""),
          bio: String(form.get("bio") ?? "").trim(),
          photos: draftPhotos.map((photo) => ({ ...photo })),
        });
        removedPhotoUrls.forEach((url) => { if (url.startsWith("blob:")) URL.revokeObjectURL(url); });
        editorAbortController?.abort();
        closeProfileEditor();
        showToast(copy.saved);
      } catch {
        showToast(translate("requestFailed"));
      } finally {
        submits.forEach((button) => { button.disabled = false; });
      }
    }, { signal });
  }

  return Object.freeze({
    closeEditProfile,
    deleteAccount,
    openDelete,
    openEditProfile,
    openLanguage,
    openPrivacy,
    renderSettingsPanel,
    renderProfileDetails,
    saveProfile,
  });
}
