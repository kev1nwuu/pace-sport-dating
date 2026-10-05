import { SPORTS, getSportLabel } from "../sport_catalog.mjs?v=pace-release-audit-58";
import { escapeHtml } from "./dom.mjs?v=pace-release-audit-58";
import { photoFocusStyle, withDefaultPhotoFocus } from "./photo_presentation.mjs?v=pace-release-audit-58";

export function createOnboarding({
  onboardingRoot,
  appShell,
  onProfileChange = async () => {},
  authenticate = async ({ email }) => ({ email }),
  signOut = async () => {},
  restoreSession = async () => null,
  completeOnboarding = async () => {},
  onAuthenticated = async () => {},
  prepareVisuals = async () => {},
  getLanguage = () => "en",
}) {
  const onboardingStage = onboardingRoot.querySelector("#onboarding-stage");
  const onboardingBack = onboardingRoot.querySelector("#onboarding-back");
  const onboardingProgress = onboardingRoot.querySelector("#onboarding-progress");
  const launchTimers = new Set();
  let startupAttempt = 0;
  let launchStartedAt = 0;

  function startupCopy() {
    const copies = {
      en: { opening: "Opening PACE", title: "LET’S TRY THAT AGAIN.", message: "We couldn’t reconnect just now. Check your connection and try again.", retry: "Retry" },
      "zh-CN": { opening: "正在打开 PACE", title: "再试一次。", message: "暂时无法连接，请检查网络后重试。", retry: "重试" },
      fr: { opening: "Ouverture de PACE", title: "RÉESSAYONS.", message: "La connexion a échoué. Vérifiez votre connexion et réessayez.", retry: "Réessayer" },
      es: { opening: "Abriendo PACE", title: "VOLVAMOS A INTENTARLO.", message: "No hemos podido conectar. Comprueba tu conexión e inténtalo de nuevo.", retry: "Reintentar" },
      de: { opening: "PACE wird geöffnet", title: "VERSUCHEN WIR ES NOCH MAL.", message: "Die Verbindung ist fehlgeschlagen. Prüfe deine Verbindung und versuche es erneut.", retry: "Erneut versuchen" },
    };
    return copies[getLanguage()] ?? copies.en;
  }

  const onboardingState = {
    step: 0,
    email: "",
    firstName: "",
    birthday: "",
    city: "Toronto",
    height: "",
    ethnicity: "",
    showHeight: false,
    showEthnicity: false,
    sports: ["running"],
    intent: "",
    identity: "",
    frequency: "",
    schedule: "",
    goal: "",
    distance: 12,
    photos: [],
    bio: "",
    firstMove: "",
    mode: "onboarding",
  };

  const onboardingIntents = [
    { id: "partner", label: "An activity partner", note: "Someone to share the activities you love." },
    { id: "dating", label: "Dating & a relationship", note: "Find romance with someone who shares your active life." },
    { id: "both", label: "Open to both", note: "Meet through a shared activity. See if there’s chemistry." },
    { id: "thinking", label: "Still figuring it out", note: "No pressure—you can update this whenever it feels clearer." },
  ];
  const onboardingDetails = {
    frequency: ["1–2× / week", "3–4× / week", "5+× / week"],
    schedule: ["Weekday AM", "Weekday PM", "Weekends", "Flexible"],
    goal: ["Stay consistent", "Meet people", "Train for an event", "Get stronger", "Still figuring it out"],
  };

  function onboardingInput(name, label, type, value, extra = "") {
    return `<label class="onboarding-field"><span>${label}</span><input name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra} /></label>`;
  }

  function onboardingBirthdayInput() {
    const latestBirthday = new Date();
    latestBirthday.setFullYear(latestBirthday.getFullYear() - 18);
    const max = latestBirthday.toISOString().slice(0, 10);
    return `<label class="onboarding-field"><span>Birthday</span><div class="onboarding-date-control"><input id="onboarding-birthday" name="birthday" type="date" value="${escapeHtml(onboardingState.birthday)}" min="1900-01-01" max="${max}" autocomplete="bday" required /><button type="button" data-action="open-birthday-picker" aria-label="Choose birthday from calendar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg></button></div></label>`;
  }

  function onboardingChoiceGroup(group, label, values) {
    return `<fieldset class="onboarding-detail-group"><legend>${label}</legend><div class="onboarding-detail-options">${values.map((value) => `<button class="onboarding-detail-choice${onboardingState[group] === value ? " selected" : ""}" type="button" data-action="choose-onboarding-detail" data-detail-group="${group}" data-detail-value="${value}" aria-pressed="${onboardingState[group] === value}">${value}</button>`).join("")}</div></fieldset>`;
  }

  function onboardingPhotoMarkup() {
    const previews = onboardingState.photos.map((photo, index) => `<figure class="onboarding-photo-card${index === 0 ? " is-avatar-photo" : ""}"><img src="${photo.url}" style="${photoFocusStyle(photo)}" alt="Profile photo ${index + 1}: ${escapeHtml(photo.name)}" /><button type="button" data-action="remove-onboarding-photo" data-photo-id="${photo.id}" aria-label="Remove ${escapeHtml(photo.name)}">Remove</button><figcaption>${index === 0 ? "AVATAR" : `0${index + 1}`}</figcaption></figure>`).join("");
    return `<div class="onboarding-photo-grid${onboardingState.photos.length ? "" : " is-empty"}">${previews}<label class="onboarding-photo-add"><input id="onboarding-photo-input" type="file" accept="image/jpeg,image/png,image/webp" multiple /><strong>Add photos</strong><small>JPG, PNG or WebP · up to 6</small></label></div>`;
  }

  function renderOnboarding(step = onboardingState.step, direction = "forward") {
    onboardingState.mode = "onboarding";
    onboardingState.step = Math.max(0, Math.min(7, step));
    onboardingRoot.dataset.step = String(onboardingState.step);
    onboardingRoot.dataset.direction = direction;
    onboardingBack.classList.toggle("hidden", onboardingState.step === 0);
    onboardingProgress.textContent = onboardingState.step === 0 ? "" : `0${onboardingState.step} / 07`;

    if (onboardingState.step === 0) {
      onboardingStage.innerHTML = `
        <div class="onboarding-card onboarding-welcome">
          <div class="onboarding-copy">
            <p class="onboarding-kicker">SHARED PACE · REAL CHEMISTRY</p>
            <h1>MEET SOMEONE<br>WHO MOVES LIKE YOU.</h1>
            <p>Meet active people for a shared adventure, a date, or both.</p>
          </div>
          <div class="onboarding-actions onboarding-auth-actions">
            <button class="onboarding-button onboarding-button-primary" type="button" data-action="onboarding-email">Create account with email</button>
            <div class="onboarding-social-row"><button class="onboarding-button onboarding-button-secondary" type="button" data-action="onboarding-google"><img src="assets/onboarding-google-symbol.png" alt="" />Continue with Google</button><button class="onboarding-button onboarding-button-secondary" type="button" data-action="onboarding-apple"><img src="assets/onboarding-apple-symbol.svg" alt="" />Continue with Apple</button></div>
            <button class="onboarding-login" type="button" data-action="onboarding-login">Already moving with us? <strong>Log in</strong></button>
          </div>
        </div>`;
      return;
    }

    if (onboardingState.step === 1) {
      onboardingStage.innerHTML = `
        <form class="onboarding-card onboarding-form" data-onboarding-form="account" novalidate>
          <div class="onboarding-copy"><p class="onboarding-kicker">01 · YOUR ACCOUNT</p><h1>LET’S MAKE IT OFFICIAL.</h1><p>Your profile, your matches, and the start of something new.</p></div>
          <div class="onboarding-fields">
            ${onboardingInput("email", "Email", "email", onboardingState.email, 'autocomplete="email" placeholder="you@example.com" required')}
            ${onboardingInput("password", "Password", "password", "", 'autocomplete="new-password" placeholder="8+ characters" minlength="8" required')}
            ${onboardingInput("confirmPassword", "Confirm password", "password", "", 'autocomplete="new-password" placeholder="Type it again" minlength="8" required')}
            <p class="onboarding-error" role="alert"></p>
          </div>
          <button class="onboarding-button onboarding-button-primary" type="submit">Continue</button>
        </form>`;
    }

    if (onboardingState.step === 2) {
      onboardingStage.innerHTML = `
        <form class="onboarding-card onboarding-form" data-onboarding-form="profile" novalidate>
          <div class="onboarding-copy"><p class="onboarding-kicker">02 · THE BASICS</p><h1>LET THEM MEET YOU.</h1><p>Add the details that help shape your profile. Optional personal details stay private unless you share them later.</p></div>
          <div class="onboarding-fields">
            ${onboardingInput("firstName", "First name", "text", onboardingState.firstName, 'autocomplete="given-name" placeholder="Kevin" required')}
            ${onboardingBirthdayInput()}
            ${onboardingInput("city", "City", "text", onboardingState.city, 'autocomplete="address-level2" required')}
            <label class="onboarding-field"><span>I identify as (optional)</span><select name="identity"><option value="">Prefer not to say</option><option${onboardingState.identity === "Man" ? " selected" : ""}>Man</option><option${onboardingState.identity === "Woman" ? " selected" : ""}>Woman</option><option${onboardingState.identity === "Non-binary" ? " selected" : ""}>Non-binary</option><option${onboardingState.identity === "Self-describe" ? " selected" : ""}>Self-describe</option></select></label>
            ${onboardingInput("height", "Height (optional)", "text", onboardingState.height, 'autocomplete="off" placeholder="e.g. 178 cm or 5′10″" maxlength="24"')}
            ${onboardingInput("ethnicity", "Ethnicity (optional)", "text", onboardingState.ethnicity, 'autocomplete="off" placeholder="Add if you want to" maxlength="80"')}
            <p class="onboarding-error" role="alert"></p>
          </div>
          <button class="onboarding-button onboarding-button-primary" type="submit">Continue</button>
        </form>`;
    }

    if (onboardingState.step === 3) {
      onboardingStage.innerHTML = `
        <form class="onboarding-card onboarding-form" data-onboarding-form="intent" novalidate>
          <div class="onboarding-copy"><p class="onboarding-kicker">03 · YOUR INTENTION</p><h1>WHAT KIND OF CONNECTION?</h1><p>An activity partner, a relationship, or room to explore. Choose what feels right for you now.</p></div>
          <div class="onboarding-intent-list" role="radiogroup" aria-label="Choose your intention">
            ${onboardingIntents.map((item) => `<button class="onboarding-intent${onboardingState.intent === item.id ? " selected" : ""}" type="button" role="radio" data-action="choose-onboarding-intent" data-intent="${item.id}" aria-checked="${onboardingState.intent === item.id}"><span><strong>${item.label}</strong><small>${item.note}</small></span><b aria-hidden="true"></b></button>`).join("")}
          </div>
          <p class="onboarding-error" role="alert"></p>
          <button class="onboarding-button onboarding-button-primary" type="submit">Continue</button>
        </form>`;
    }

    if (onboardingState.step === 4) {
      onboardingStage.innerHTML = `
        <form class="onboarding-card onboarding-form" data-onboarding-form="sports" novalidate>
          <div class="onboarding-copy"><p class="onboarding-kicker">04 · YOUR SPORTS</p><h1>WHAT GETS YOU MOVING?</h1><p>Choose up to five activities you would love to share with someone.</p></div>
          <label class="onboarding-sport-search"><span>Find a sport</span><input id="onboarding-sport-search" type="search" autocomplete="off" placeholder="Search running, padel, boxing…" /></label>
          <div class="onboarding-sport-toolbar"><span>Popular sports</span><strong id="onboarding-sport-count">${onboardingState.sports.length} / 5 selected</strong></div>
          <div class="onboarding-choice-grid onboarding-sport-catalog" role="group" aria-label="Choose sports">
            ${SPORTS.map((sport) => `<button class="onboarding-choice${onboardingState.sports.includes(sport.id) ? " selected" : ""}" type="button" data-action="toggle-onboarding-sport" data-sport="${sport.id}" data-sport-label="${escapeHtml(Object.values(sport.labels).join(" ").toLocaleLowerCase())}" data-sport-category="${sport.category}" aria-pressed="${onboardingState.sports.includes(sport.id)}">${getSportLabel(sport.id, "en")}</button>`).join("")}
          </div>
          <p class="onboarding-error" role="alert"></p>
          <button class="onboarding-button onboarding-button-primary" type="submit">Continue</button>
        </form>`;
    }

    if (onboardingState.step === 5) {
      onboardingStage.innerHTML = `
        <form class="onboarding-card onboarding-form onboarding-form-dense" data-onboarding-form="routine" novalidate>
          <div class="onboarding-copy"><p class="onboarding-kicker">05 · YOUR RHYTHM</p><h1>FIND PEOPLE WHO FIT REAL LIFE.</h1><p>Give a potential match a feel for your week, and when you could make time for each other.</p></div>
          <div class="onboarding-detail-stack">
            ${onboardingChoiceGroup("frequency", "Activities per week", onboardingDetails.frequency)}
            ${onboardingChoiceGroup("schedule", "Best time to meet", onboardingDetails.schedule)}
            ${onboardingChoiceGroup("goal", "What you want right now", onboardingDetails.goal)}
            <label class="onboarding-range-field"><span>Discovery distance <strong id="onboarding-distance-value">${onboardingState.distance} km</strong></span><input id="onboarding-distance" name="distance" type="range" min="2" max="50" value="${onboardingState.distance}" /></label>
          </div>
          <p class="onboarding-error" role="alert"></p>
          <button class="onboarding-button onboarding-button-primary" type="submit">Continue</button>
        </form>`;
    }

    if (onboardingState.step === 6) {
      onboardingStage.innerHTML = `
        <form class="onboarding-card onboarding-form" data-onboarding-form="photos" novalidate>
          <div class="onboarding-copy"><p class="onboarding-kicker">06 · YOUR PHOTOS</p><h1>SHOW UP AS YOURSELF.</h1><p>Add at least one recent photo. A clear face first, then the movement and moments that feel like you.</p></div>
          ${onboardingPhotoMarkup()}
          <p class="onboarding-photo-privacy">Visible to people you discover · never posted publicly</p>
          <p class="onboarding-error" role="alert"></p>
          <button class="onboarding-button onboarding-button-primary" type="submit">Continue</button>
        </form>`;
    }

    if (onboardingState.step === 7) {
      onboardingStage.innerHTML = `
        <form class="onboarding-card onboarding-form" data-onboarding-form="prompts" novalidate>
          <div class="onboarding-copy"><p class="onboarding-kicker">07 · YOUR FIRST MOVE</p><h1>GIVE THEM SOMETHING TO START WITH.</h1><p>A favorite trail, a playful challenge, a coffee after. Give a potential match an easy way to say hello.</p></div>
          <div class="onboarding-fields">
            <label class="onboarding-field"><span>Short bio</span><textarea name="bio" maxlength="180" placeholder="A trail, a good conversation, and a coffee that lasts longer than the run." required>${escapeHtml(onboardingState.bio)}</textarea></label>
            ${onboardingInput("firstMove", "An idea for meeting up", "text", onboardingState.firstMove, 'placeholder="Easy 5K + coffee" required maxlength="60"')}
            <p class="onboarding-error" role="alert"></p>
          </div>
          <button class="onboarding-button onboarding-button-primary" type="submit">Create my account</button>
        </form>`;
    }

    const form = onboardingStage.querySelector("[data-onboarding-form]");
    form?.addEventListener("submit", handleOnboardingSubmit);
    form?.querySelector("#onboarding-photo-input")?.addEventListener("change", handleOnboardingPhotos);
    form?.querySelector('[data-action="open-birthday-picker"]')?.addEventListener("click", () => {
      const birthday = form.querySelector("#onboarding-birthday");
      if (typeof birthday?.showPicker === "function") birthday.showPicker();
      else birthday?.focus();
    });
    form?.querySelector("#onboarding-distance")?.addEventListener("input", (event) => {
      onboardingState.distance = Number(event.target.value);
      const output = onboardingStage.querySelector("#onboarding-distance-value");
      if (output) output.textContent = `${onboardingState.distance} km`;
    });
    form?.querySelector("#onboarding-sport-search")?.addEventListener("input", (event) => {
      const query = event.target.value.trim().toLocaleLowerCase();
      onboardingStage.querySelectorAll("[data-sport-label]").forEach((button) => {
        const matches = !query || button.dataset.sportLabel.includes(query) || button.dataset.sportCategory.includes(query);
        button.classList.toggle("hidden", !matches);
      });
    });
  }

  function renderLogin() {
    onboardingState.mode = "login";
    onboardingRoot.dataset.step = "login";
    onboardingRoot.dataset.direction = "forward";
    onboardingBack.classList.remove("hidden");
    onboardingProgress.textContent = "";
    onboardingStage.innerHTML = `
      <form class="onboarding-card onboarding-form onboarding-login-form" data-onboarding-form="login" novalidate>
        <div class="onboarding-copy">
          <p class="onboarding-kicker">WELCOME BACK</p>
          <h1>BACK TO<br />YOUR MATCHES.</h1>
          <p>Log in to pick up your matches, conversations, and plans.</p>
        </div>
        <div class="onboarding-fields">
          ${onboardingInput("email", "Email", "email", onboardingState.email, 'autocomplete="email" inputmode="email" placeholder="you@example.com" required')}
          ${onboardingInput("password", "Password", "password", "", 'autocomplete="current-password" placeholder="Your password" minlength="8" required')}
          <p class="onboarding-error" role="alert"></p>
        </div>
        <div class="onboarding-login-actions">
          <button class="onboarding-button onboarding-button-primary" type="submit">Log in</button>
          <button class="onboarding-login" type="button" data-action="onboarding-email">New to PACE? <strong>Create account</strong></button>
        </div>
      </form>`;
    onboardingStage.querySelector("[data-onboarding-form]")?.addEventListener("submit", handleOnboardingSubmit);
  }

  function handleOnboardingPhotos(event) {
    const files = [...(event.target.files ?? [])];
    const available = Math.max(0, 6 - onboardingState.photos.length);
    const valid = files.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 10 * 1024 * 1024).slice(0, available);
    valid.forEach((file) => onboardingState.photos.push(withDefaultPhotoFocus({ id: `${Date.now()}-${Math.random()}`, name: file.name, url: URL.createObjectURL(file) })));
    if (!valid.length && files.length) return onboardingError("Use JPG, PNG or WebP files under 10 MB.");
    renderOnboarding(6);
  }

  function onboardingError(message) {
    const error = onboardingStage.querySelector(".onboarding-error");
    if (error) error.textContent = message;
  }

  function advanceOnboarding(step) {
    renderOnboarding(step, step < onboardingState.step ? "back" : "forward");
  }

  async function handleOnboardingSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const mode = form.dataset.onboardingForm;
    const data = new FormData(form);

    if (mode === "login") {
      const email = String(data.get("email") ?? "").trim();
      const password = String(data.get("password") ?? "");
      if (!/^\S+@\S+\.\S+$/.test(email)) return onboardingError("Enter a valid email address.");
      if (password.length < 8) return onboardingError("Enter your password (8+ characters).");
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.textContent = "Logging in…";
      try {
        await authenticate({ email, password });
        onboardingState.email = email;
        await launchIntoApp({ returning: true });
      } catch {
        submit.disabled = false;
        submit.textContent = "Log in";
        onboardingError("We couldn't log you in. Check your details and try again.");
      }
      return;
    }

    if (mode === "account") {
      const email = String(data.get("email") ?? "").trim();
      const password = String(data.get("password") ?? "");
      const confirmPassword = String(data.get("confirmPassword") ?? "");
      if (!/^\S+@\S+\.\S+$/.test(email)) return onboardingError("Enter a valid email address.");
      if (password.length < 8) return onboardingError("Use at least 8 characters.");
      if (password !== confirmPassword) return onboardingError("Passwords do not match.");
      onboardingState.email = email;
      return advanceOnboarding(2);
    }

    if (mode === "profile") {
      const firstName = String(data.get("firstName") ?? "").trim();
      const birthday = String(data.get("birthday") ?? "");
      const city = String(data.get("city") ?? "").trim();
      if (!firstName) return onboardingError("Add your first name.");
      if (!birthday) return onboardingError("Add your birthday.");
      const latestBirthday = new Date();
      latestBirthday.setFullYear(latestBirthday.getFullYear() - 18);
      if (new Date(`${birthday}T12:00:00`) > latestBirthday) return onboardingError("You must be at least 18 years old.");
      if (!city) return onboardingError("Add your city.");
      const identity = String(data.get("identity") ?? "");
      const height = String(data.get("height") ?? "").trim();
      const ethnicity = String(data.get("ethnicity") ?? "").trim();
      const showHeight = false;
      const showEthnicity = false;
      Object.assign(onboardingState, { firstName, birthday, city, identity, height, ethnicity, showHeight, showEthnicity });
      try {
        await onProfileChange({ height, ethnicity, showHeight, showEthnicity });
      } catch {
        return onboardingError("Could not save your profile. Try again.");
      }
      return advanceOnboarding(3);
    }

    if (mode === "intent") {
      if (!onboardingState.intent) return onboardingError("Choose what you are open to.");
      return advanceOnboarding(4);
    }

    if (mode === "sports") {
      if (!onboardingState.sports.length) return onboardingError("Choose at least one sport.");
      try {
        await onProfileChange({ sports: [...onboardingState.sports] });
      } catch {
        return onboardingError("Could not save your sports. Try again.");
      }
      return advanceOnboarding(5);
    }

    if (mode === "routine") {
      const missing = ["frequency", "schedule", "goal"].find((key) => !onboardingState[key]);
      if (missing) return onboardingError(`Choose your ${missing}.`);
      onboardingState.distance = Number(data.get("distance") ?? onboardingState.distance);
      try {
        await onProfileChange({ frequency: onboardingState.frequency, schedule: onboardingState.schedule, goal: onboardingState.goal, distance: onboardingState.distance });
      } catch {
        return onboardingError("Could not save your routine. Try again.");
      }
      return advanceOnboarding(6);
    }

    if (mode === "photos") {
      if (!onboardingState.photos.length) return onboardingError("Add at least one profile photo.");
      try {
        await onProfileChange({ photos: onboardingState.photos.map((photo) => withDefaultPhotoFocus({ id: photo.id, name: photo.name, url: photo.url, focus: photo.focus })) });
      } catch {
        return onboardingError("Could not save your photos. Try again.");
      }
      return advanceOnboarding(7);
    }

    if (mode === "prompts") {
      const bio = String(data.get("bio") ?? "").trim();
      const firstMove = String(data.get("firstMove") ?? "").trim();
      if (bio.length < 12) return onboardingError("Tell people a little more about you.");
      if (!firstMove) return onboardingError("Add an idea for meeting up.");
      Object.assign(onboardingState, { bio, firstMove });
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        await onProfileChange({ bio, firstMove });
        await completeOnboarding();
      } catch {
        submit.disabled = false;
        return onboardingError("Could not finish creating your account. Try again.");
      }
      return launchIntoApp();
    }
  }

  function setLaunchTimer(callback, delay) {
    const timer = window.setTimeout(() => {
      launchTimers.delete(timer);
      callback();
    }, delay);
    launchTimers.add(timer);
  }

  function clearLaunchTimers() {
    launchTimers.forEach((timer) => window.clearTimeout(timer));
    launchTimers.clear();
  }

  function activateApp() {
    clearLaunchTimers();
    onboardingState.mode = "app";
    onboardingRoot.removeAttribute("aria-busy");
    onboardingRoot.classList.add("hidden");
    onboardingRoot.classList.remove("is-complete", "is-launching", "is-revealing");
    onboardingRoot.setAttribute("aria-hidden", "true");
    appShell.classList.remove("launch-preview", "launch-ready");
    appShell.removeAttribute("inert");
    appShell.setAttribute("aria-hidden", "false");
    document.body.classList.remove("onboarding-open");
    document.querySelector('[data-tab="discover"]')?.focus({ preventScroll: true });
  }

  function showLaunchScreen() {
    clearLaunchTimers();
    launchStartedAt = Date.now();
    onboardingState.mode = "launch";
    const copy = startupCopy();
    document.body.classList.add("onboarding-open");
    onboardingRoot.classList.remove("hidden", "is-complete", "is-revealing", "is-welcome-revealing", "is-welcome-entering");
    onboardingRoot.setAttribute("aria-hidden", "false");
    onboardingRoot.setAttribute("aria-busy", "true");
    onboardingRoot.dataset.step = "launch";
    onboardingRoot.dataset.direction = "forward";
    onboardingBack.classList.add("hidden");
    onboardingProgress.textContent = "";
    onboardingStage.scrollTop = 0;
    const existingLaunch = onboardingStage.querySelector(".pace-launch");
    if (existingLaunch) {
      existingLaunch.setAttribute("aria-label", copy.opening);
      const statusText = existingLaunch.querySelector(".visually-hidden");
      if (statusText) statusText.textContent = copy.opening;
    } else onboardingStage.innerHTML = `
      <div class="pace-launch" role="status" aria-label="${copy.opening}">
        <div class="pace-launch-surface" aria-hidden="true"></div>
        <div class="pace-launch-brand" aria-hidden="true"><span>P</span><strong>PACE</strong></div>
        <span class="visually-hidden">${copy.opening}</span>
      </div>`;
    onboardingRoot.classList.add("is-launching");
    appShell.setAttribute("inert", "");
    appShell.setAttribute("aria-hidden", "true");
    appShell.classList.remove("launch-ready");
    appShell.classList.add("launch-preview");
  }

  async function launchIntoApp({ returning = false, attempt = ++startupAttempt } = {}) {
    if (onboardingState.mode !== "launch") showLaunchScreen();
    try {
      await Promise.all([onAuthenticated(), prepareVisuals()]);
    } catch {
      if (attempt === startupAttempt) renderStartupError();
      return;
    }
    if (attempt !== startupAttempt) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const brandHold = Math.max(0, (reducedMotion ? 80 : returning ? 900 : 2000) - (Date.now() - launchStartedAt));
    const revealDuration = reducedMotion ? 80 : 760;
    setLaunchTimer(() => {
      onboardingRoot.classList.add("is-revealing");
      appShell.classList.add("launch-ready");
    }, brandHold);
    setLaunchTimer(activateApp, brandHold + revealDuration + 80);
  }

  function clearLaunchPresentation() {
    clearLaunchTimers();
    onboardingRoot.classList.remove("is-complete", "is-launching", "is-revealing", "is-welcome-revealing", "is-welcome-entering");
    onboardingRoot.removeAttribute("aria-busy");
    appShell.classList.remove("launch-preview", "launch-ready");
  }

  function renderStartupError() {
    clearLaunchPresentation();
    onboardingState.mode = "startup-error";
    onboardingRoot.dataset.step = "startup-error";
    onboardingBack.classList.add("hidden");
    const copy = startupCopy();
    onboardingStage.innerHTML = `<div class="onboarding-card onboarding-reconnect">
      <div class="onboarding-copy"><h1>${copy.title}</h1><p role="alert">${copy.message}</p></div>
      <button class="onboarding-button onboarding-button-primary" type="button" data-action="retry-session">${copy.retry}</button>
    </div>`;
    onboardingStage.querySelector('[data-action="retry-session"]')?.focus();
  }

  async function start() {
    const attempt = ++startupAttempt;
    showLaunchScreen();
    try {
      const session = await restoreSession();
      if (attempt !== startupAttempt) return;
      if (session?.authenticated === true) {
        await launchIntoApp({ returning: true, attempt });
      } else {
        await prepareVisuals();
        if (attempt !== startupAttempt) return;
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        setLaunchTimer(() => {
          onboardingRoot.classList.add("is-welcome-revealing");
          setLaunchTimer(() => {
            clearLaunchPresentation();
            onboardingRoot.classList.add("is-welcome-entering");
            renderOnboarding(0);
            setLaunchTimer(() => onboardingRoot.classList.remove("is-welcome-entering"), reducedMotion ? 0 : 800);
          }, reducedMotion ? 0 : 320);
        }, reducedMotion ? 0 : Math.max(0, 650 - (Date.now() - launchStartedAt)));
      }
    } catch {
      if (attempt === startupAttempt) renderStartupError();
    }
  }

  async function logout() {
    await signOut();
    startupAttempt += 1;
    clearLaunchTimers();
    onboardingRoot.removeAttribute("aria-busy");
    onboardingRoot.classList.remove("hidden", "is-complete", "is-launching", "is-revealing", "is-welcome-revealing", "is-welcome-entering");
    onboardingRoot.setAttribute("aria-hidden", "false");
    appShell.classList.remove("launch-preview", "launch-ready", "profile-editor-open");
    appShell.setAttribute("inert", "");
    appShell.setAttribute("aria-hidden", "true");
    document.body.classList.add("onboarding-open");
    renderLogin();
    window.requestAnimationFrame(() => onboardingStage.querySelector('[name="email"]')?.focus());
  }

  function handleClick(event) {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "retry-session") void start();
    if (action === "onboarding-email") advanceOnboarding(1);
    if (action === "onboarding-login") renderLogin();
    if (action === "onboarding-google") {
      onboardingState.email = "kevin@gmail.com";
      advanceOnboarding(2);
    }
    if (action === "onboarding-apple") {
      onboardingState.email = "kevin@icloud.com";
      advanceOnboarding(2);
    }
    if (action === "onboarding-back") {
      if (onboardingState.mode === "login") renderOnboarding(0, "back");
      else advanceOnboarding(onboardingState.step - 1);
    }
    if (action === "toggle-onboarding-sport") {
      const button = event.target.closest("[data-sport]");
      const sport = button?.dataset.sport;
      if (!sport) return;
      if (onboardingState.sports.includes(sport)) onboardingState.sports = onboardingState.sports.filter((item) => item !== sport);
      else if (onboardingState.sports.length < 5) onboardingState.sports = [...onboardingState.sports, sport];
      button.classList.toggle("selected", onboardingState.sports.includes(sport));
      button.setAttribute("aria-pressed", String(onboardingState.sports.includes(sport)));
      const sportCount = onboardingStage.querySelector("#onboarding-sport-count");
      if (sportCount) sportCount.textContent = `${onboardingState.sports.length} / 5 selected`;
      onboardingError(onboardingState.sports.length === 5 ? "Five sports selected." : "");
    }
    if (action === "choose-onboarding-intent") {
      onboardingState.intent = event.target.closest("[data-intent]")?.dataset.intent ?? "";
      onboardingStage.querySelectorAll("[data-intent]").forEach((button) => {
        const selected = button.dataset.intent === onboardingState.intent;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-checked", String(selected));
      });
      onboardingError("");
    }
    if (action === "choose-onboarding-detail") {
      const button = event.target.closest("[data-detail-group]");
      const group = button?.dataset.detailGroup;
      const value = button?.dataset.detailValue;
      if (!group || !value || !(group in onboardingDetails)) return;
      onboardingState[group] = value;
      onboardingStage.querySelectorAll(`[data-detail-group="${group}"]`).forEach((choice) => {
        const selected = choice.dataset.detailValue === value;
        choice.classList.toggle("selected", selected);
        choice.setAttribute("aria-pressed", String(selected));
      });
      onboardingError("");
    }
    if (action === "remove-onboarding-photo") {
      const id = event.target.closest("[data-photo-id]")?.dataset.photoId;
      const photo = onboardingState.photos.find((item) => item.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      onboardingState.photos = onboardingState.photos.filter((item) => item.id !== id);
      renderOnboarding(6);
    }
  }

  onboardingRoot.addEventListener("click", handleClick);

  return Object.freeze({
    start,
    logout,
  });
}
