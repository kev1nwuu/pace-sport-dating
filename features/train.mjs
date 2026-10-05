import { SPORTS, getSportLabel, searchSports } from "../sport_catalog.mjs?v=pace-release-audit-58";
import { escapeHtml } from "./dom.mjs?v=pace-release-audit-58";

const COPY = {
  en: {
    eyebrow: "MEET UP", title: "MOVE TOGETHER", intro: "Meet through a shared activity. See if there’s a spark.", upcoming: "Upcoming", going: "Going", all: "All sports", filter: "Filter activities by sport", next: "NEXT UP", more: "Find a reason to meet", plan: "Your upcoming plans", host: "Host a session", hostTitle: "Make room for someone new.", hostHint: "Create a public activity with Plus and meet people through a shared interest.", hostMemberHint: "Plan something you enjoy. Give new people a way to join you.", loading: "Finding your next session…", failed: "We couldn’t load the sessions.", retry: "Try again", empty: "Your next hello could start here.", emptyHint: "No upcoming activities here yet. Try another sport, or host a plan people can join.", emptyGoing: "Your calendar is open.", emptyGoingHint: "Join an activity to meet people with something in common. Your plans will appear here.", browse: "Explore sessions", reset: "Show all sports", details: "Session details", close: "Close", verified: "Verified host", hostedBy: "Hosted by", youHost: "You’re hosting", joined: "You’re going", join: "Join session", leave: "Leave session", full: "Session full", ended: "Session started", people: "people", remaining: (n) => `${n} ${n === 1 ? "spot" : "spots"} left`, free: "Free to join", when: "When", where: "Meet here", pace: "Pace / level", about: "The plan", noDescription: "The host hasn’t added any extra details yet.", planHint: "Meet at the public meeting point. You can leave the session if your plans change.", joinDone: "You’re in. Your session is saved in Going.", leaveDone: "You’ve left the session.", saving: "Saving…", creating: "Publishing…", detailFailed: "We couldn’t load this session. Please try again.", actionFailed: "We couldn’t save that change. Please try again.", fullError: "This session just filled up. Choose another session.", unavailable: "This session is no longer available.", hostCannotLeave: "You’re the host of this session.", createTitle: "START SOMETHING", createIntro: "Start with a sport you enjoy and a plan that gives people time to get to know each other.", titleLabel: "Session name", titlePlaceholder: "e.g. Easy run, new faces", sport: "Sport", date: "Date & time", location: "Public meeting point", locationPlaceholder: "e.g. High Park, main entrance", capacity: "Group size (including you)", description: "The plan", descriptionPlaceholder: "Route, what to bring, and where you’ll meet…", pacePlaceholder: "e.g. Easy, conversational pace", optional: "optional", publish: "Publish session", createNotice: "Your session will be public. Choose a public meeting point and include the details people need.", createDone: "Your session is live. Find it in Going.", futureError: "Choose a date and time in the future.", capacityError: "Choose a group size from 2 to 100 people.", requiredError: "Add a session name and a public meeting point.", plus: "PLUS", format: "Time shown in your local time zone.", permissionError: "Please sign in again to continue.", hostVerification: "Complete selfie verification before hosting.", searchSports: "Search sports", noSports: "No sports found. Try another search.", sportResults: (n) => `${n} ${n === 1 ? "sport" : "sports"}`,
  },
  "zh-CN": {
    eyebrow: "相约", title: "一起出发", intro: "先找个共同喜欢的活动，看看相处是否合拍。", upcoming: "发现活动", going: "我的日程", all: "全部运动", filter: "按运动筛选活动", next: "即将出发", more: "找个见面的理由", plan: "你的运动日程", host: "发起活动", hostTitle: "给认识彼此一个机会。", hostHint: "用 Plus 发起公开活动，从共同喜欢的运动开始认识新的人。", hostMemberHint: "选一项你喜欢的运动，约一个时间，留一点认识彼此的空间。", loading: "正在寻找下一场活动…", failed: "暂时无法加载活动。", retry: "重试", empty: "下一次认识，也许就从这里开始。", emptyHint: "这里暂时没有即将开始的活动。试试其他运动，或发起一个大家能加入的计划。", emptyGoing: "日程还空着。", emptyGoingHint: "参加一场共同感兴趣的活动，认识新的人。你的安排会显示在这里。", browse: "发现活动", reset: "查看全部运动", details: "活动详情", close: "关闭", verified: "已认证发起人", hostedBy: "发起人", youHost: "你发起的活动", joined: "已参加", join: "参加活动", leave: "退出活动", full: "名额已满", ended: "活动已开始", people: "人", remaining: (n) => `还剩 ${n} 个名额`, free: "免费参加", when: "活动时间", where: "集合地点", pace: "配速 / 难度", about: "活动安排", noDescription: "发起人尚未补充活动说明。", planHint: "请在公开集合地点见面。如果计划有变，你可以退出活动。", joinDone: "报名成功，已加入「我的日程」。", leaveDone: "你已退出活动。", saving: "保存中…", creating: "发布中…", detailFailed: "暂时无法加载此活动，请重试。", actionFailed: "暂时无法保存更改，请重试。", fullError: "这场活动刚刚满员，请选择其他活动。", unavailable: "此活动已不可用。", hostCannotLeave: "你是这场活动的发起人。", createTitle: "发起一场运动", createIntro: "从喜欢的运动开始，把计划写清楚，也留一点认识彼此的时间。", titleLabel: "活动名称", titlePlaceholder: "例如：晨跑、咖啡，认识一下", sport: "运动项目", date: "日期和时间", location: "公开集合地点", locationPlaceholder: "例如：High Park 公园正门", capacity: "人数上限（含你自己）", description: "活动安排", descriptionPlaceholder: "介绍路线、需要携带的物品、集合细节…", pacePlaceholder: "例如：轻松配速，可以边跑边聊", optional: "选填", publish: "发布活动", createNotice: "活动将公开显示。请选择公开集合地点，写明参加者需要了解的信息。", createDone: "活动已发布，可在「我的日程」查看。", futureError: "请选择未来的日期和时间。", capacityError: "请选择 2 到 100 人的活动人数。", requiredError: "请填写活动名称和公开集合地点。", plus: "PLUS", format: "时间按你的本地时区显示。", permissionError: "请重新登录后继续。", hostVerification: "发起活动前，请先完成自拍认证。", searchSports: "搜索运动项目", noSports: "未找到相关运动，请换个关键词。", sportResults: (n) => `${n} 个运动项目`,
  },
  fr: {
    eyebrow: "SE RETROUVER", title: "BOUGEONS ENSEMBLE", intro: "Un sport en commun, une rencontre. À vous de voir si le courant passe.", upcoming: "À venir", going: "Mon agenda", all: "Tous les sports", filter: "Filtrer les activités par sport", next: "À NE PAS MANQUER", more: "Une occasion de se rencontrer", plan: "Vos prochaines séances", host: "Créer une séance", hostTitle: "Une place pour de nouvelles rencontres.", hostHint: "Créez une activité publique avec Plus et rencontrez des personnes autour d’un intérêt commun.", hostMemberHint: "Proposez une activité que vous aimez et laissez de nouvelles personnes vous rejoindre.", loading: "Recherche des prochaines séances…", failed: "Impossible de charger les séances.", retry: "Réessayer", empty: "Votre prochaine rencontre pourrait commencer ici.", emptyHint: "Aucune activité à venir ici pour le moment. Essayez un autre sport ou proposez votre propre programme.", emptyGoing: "Votre agenda est libre.", emptyGoingHint: "Participez à une activité pour rencontrer des personnes avec un intérêt commun. Vos programmes apparaîtront ici.", browse: "Explorer les séances", reset: "Tous les sports", details: "Détails de la séance", close: "Fermer", verified: "Hôte vérifié", hostedBy: "Organisée par", youHost: "Vous organisez", joined: "Inscription confirmée", join: "Participer", leave: "Quitter la séance", full: "Complet", ended: "Séance commencée", people: "personnes", remaining: (n) => `${n} ${n === 1 ? "place disponible" : "places disponibles"}`, free: "Participation gratuite", when: "Quand", where: "Point de rencontre", pace: "Allure / niveau", about: "Au programme", noDescription: "L’hôte n’a pas encore ajouté de précisions.", planHint: "Retrouvez-vous au point de rencontre public. Vous pouvez quitter la séance si vos projets changent.", joinDone: "C’est confirmé. Retrouvez la séance dans Mon agenda.", leaveDone: "Vous avez quitté la séance.", saving: "Enregistrement…", creating: "Publication…", detailFailed: "Impossible de charger cette séance. Réessayez.", actionFailed: "Impossible d’enregistrer. Réessayez.", fullError: "La séance vient d’être complète. Choisissez-en une autre.", unavailable: "Cette séance n’est plus disponible.", hostCannotLeave: "Vous organisez cette séance.", createTitle: "LANCEZ-VOUS", createIntro: "Partez d’un sport que vous aimez et prévoyez du temps pour faire connaissance.", titleLabel: "Nom de la séance", titlePlaceholder: "Ex. Course tranquille et nouvelles rencontres", sport: "Sport", date: "Date et heure", location: "Point de rencontre public", locationPlaceholder: "Ex. High Park, entrée principale", capacity: "Taille du groupe (vous compris)", description: "Au programme", descriptionPlaceholder: "Parcours, matériel à prévoir, lieu de rencontre…", pacePlaceholder: "Ex. Allure tranquille, pour discuter", optional: "facultatif", publish: "Publier la séance", createNotice: "Votre séance sera publique. Choisissez un lieu de rencontre public et précisez les informations utiles.", createDone: "Séance publiée. Retrouvez-la dans Mon agenda.", futureError: "Choisissez une date et une heure futures.", capacityError: "Choisissez un groupe de 2 à 100 personnes.", requiredError: "Ajoutez un nom et un point de rencontre public.", plus: "PLUS", format: "Les heures sont dans votre fuseau horaire local.", permissionError: "Reconnectez-vous pour continuer.", hostVerification: "Effectuez la vérification par selfie avant d’organiser une séance.", searchSports: "Rechercher un sport", noSports: "Aucun sport trouvé. Essayez une autre recherche.", sportResults: (n) => `${n} ${n === 1 ? "sport" : "sports"}`,
  },
  es: {
    eyebrow: "QUEDAMOS", title: "MUÉVETE EN COMPAÑÍA", intro: "Una actividad en común, alguien por conocer. A ver si hay química.", upcoming: "Próximas", going: "Mi agenda", all: "Todos los deportes", filter: "Filtrar actividades por deporte", next: "LO PRÓXIMO", more: "Encuentra una razón para quedar", plan: "Tus próximos planes", host: "Crear una sesión", hostTitle: "Haz sitio para alguien nuevo.", hostHint: "Crea una actividad pública con Plus y conoce gente con un interés en común.", hostMemberHint: "Propón algo que disfrutes y deja que gente nueva se una a ti.", loading: "Buscando tu próxima sesión…", failed: "No pudimos cargar las sesiones.", retry: "Reintentar", empty: "Tu próximo hola podría empezar aquí.", emptyHint: "Aún no hay actividades próximas aquí. Prueba otro deporte o crea un plan al que puedan unirse.", emptyGoing: "Tu agenda está libre.", emptyGoingHint: "Únete a una actividad y conoce gente con algo en común. Tus planes aparecerán aquí.", browse: "Explorar sesiones", reset: "Ver todos los deportes", details: "Detalles de la sesión", close: "Cerrar", verified: "Anfitrión verificado", hostedBy: "Organiza", youHost: "Tú organizas", joined: "Vas a participar", join: "Unirme a la sesión", leave: "Salir de la sesión", full: "Sesión completa", ended: "Sesión iniciada", people: "personas", remaining: (n) => `${n} ${n === 1 ? "plaza disponible" : "plazas disponibles"}`, free: "Participación gratuita", when: "Cuándo", where: "Punto de encuentro", pace: "Ritmo / nivel", about: "El plan", noDescription: "El anfitrión aún no ha añadido más detalles.", planHint: "Reuníos en el punto de encuentro público. Puedes salir de la sesión si cambian tus planes.", joinDone: "Ya estás dentro. La sesión está en Mi agenda.", leaveDone: "Has salido de la sesión.", saving: "Guardando…", creating: "Publicando…", detailFailed: "No pudimos cargar esta sesión. Inténtalo de nuevo.", actionFailed: "No pudimos guardar el cambio. Inténtalo de nuevo.", fullError: "La sesión acaba de llenarse. Elige otra.", unavailable: "Esta sesión ya no está disponible.", hostCannotLeave: "Tú organizas esta sesión.", createTitle: "EMPIEZA ALGO", createIntro: "Empieza con un deporte que disfrutes y deja tiempo para conoceros.", titleLabel: "Nombre de la sesión", titlePlaceholder: "Ej. Carrera suave para conocernos", sport: "Deporte", date: "Fecha y hora", location: "Punto de encuentro público", locationPlaceholder: "Ej. High Park, entrada principal", capacity: "Tamaño del grupo (incluyéndote)", description: "El plan", descriptionPlaceholder: "Ruta, qué llevar y dónde reunirse…", pacePlaceholder: "Ej. Ritmo suave para conversar", optional: "opcional", publish: "Publicar sesión", createNotice: "Tu sesión será pública. Elige un lugar de encuentro público e incluye la información necesaria.", createDone: "Sesión publicada. La encontrarás en Mi agenda.", futureError: "Elige una fecha y hora futuras.", capacityError: "Elige un grupo de 2 a 100 personas.", requiredError: "Añade un nombre y un punto de encuentro público.", plus: "PLUS", format: "Las horas se muestran en tu zona horaria local.", permissionError: "Vuelve a iniciar sesión para continuar.", hostVerification: "Completa la verificación con selfie antes de organizar una sesión.", searchSports: "Buscar deportes", noSports: "No se encontraron deportes. Prueba otra búsqueda.", sportResults: (n) => `${n} ${n === 1 ? "deporte" : "deportes"}`,
  },
  de: {
    eyebrow: "TREFFEN", title: "GEMEINSAM LOS", intro: "Lernt euch bei einer gemeinsamen Aktivität kennen. Vielleicht funkt es.", upcoming: "Entdecken", going: "Mein Plan", all: "Alle Sportarten", filter: "Aktivitäten nach Sport filtern", next: "ALS NÄCHSTES", more: "Finde einen Anlass zum Kennenlernen", plan: "Deine nächsten Pläne", host: "Einheit erstellen", hostTitle: "Platz für neue Begegnungen.", hostHint: "Erstelle mit Plus eine öffentliche Aktivität und lerne Menschen mit gemeinsamen Interessen kennen.", hostMemberHint: "Plane etwas, das dir Spaß macht, und lade neue Menschen ein, mitzumachen.", loading: "Die nächsten Einheiten werden geladen…", failed: "Die Einheiten konnten nicht geladen werden.", retry: "Erneut versuchen", empty: "Dein nächstes Hallo könnte hier beginnen.", emptyHint: "Hier gibt es noch keine kommenden Aktivitäten. Wähle eine andere Sportart oder plane selbst etwas.", emptyGoing: "Dein Kalender ist noch frei.", emptyGoingHint: "Mach bei einer Aktivität mit und lerne Menschen mit gemeinsamen Interessen kennen. Deine Pläne erscheinen hier.", browse: "Einheiten entdecken", reset: "Alle Sportarten anzeigen", details: "Details zur Einheit", close: "Schließen", verified: "Verifizierter Gastgeber", hostedBy: "Organisiert von", youHost: "Du organisierst", joined: "Du bist dabei", join: "Teilnehmen", leave: "Teilnahme absagen", full: "Ausgebucht", ended: "Bereits gestartet", people: "Personen", remaining: (n) => `${n} ${n === 1 ? "Platz frei" : "Plätze frei"}`, free: "Kostenlos teilnehmen", when: "Wann", where: "Treffpunkt", pace: "Tempo / Niveau", about: "Der Plan", noDescription: "Es wurden noch keine weiteren Details hinzugefügt.", planHint: "Trefft euch am öffentlichen Treffpunkt. Wenn sich deine Pläne ändern, kannst du absagen.", joinDone: "Du bist dabei. Die Einheit steht unter Mein Plan.", leaveDone: "Du hast deine Teilnahme abgesagt.", saving: "Wird gespeichert…", creating: "Wird veröffentlicht…", detailFailed: "Diese Einheit konnte nicht geladen werden. Versuche es erneut.", actionFailed: "Die Änderung konnte nicht gespeichert werden. Versuche es erneut.", fullError: "Die Einheit ist inzwischen voll. Wähle eine andere.", unavailable: "Diese Einheit ist nicht mehr verfügbar.", hostCannotLeave: "Du organisierst diese Einheit.", createTitle: "BRING ETWAS INS ROLLEN", createIntro: "Beginne mit einer Sportart, die dir Spaß macht, und lass Zeit zum Kennenlernen.", titleLabel: "Name der Einheit", titlePlaceholder: "Z. B. Locker laufen und kennenlernen", sport: "Sportart", date: "Datum und Uhrzeit", location: "Öffentlicher Treffpunkt", locationPlaceholder: "Z. B. High Park, Haupteingang", capacity: "Gruppengröße (inklusive dir)", description: "Der Plan", descriptionPlaceholder: "Strecke, benötigte Ausrüstung und Treffpunkt…", pacePlaceholder: "Z. B. Lockeres Gesprächstempo", optional: "optional", publish: "Einheit veröffentlichen", createNotice: "Deine Einheit wird öffentlich angezeigt. Wähle einen öffentlichen Treffpunkt und ergänze die nötigen Informationen.", createDone: "Veröffentlicht. Du findest die Einheit unter Mein Plan.", futureError: "Wähle ein Datum und eine Uhrzeit in der Zukunft.", capacityError: "Wähle eine Gruppengröße von 2 bis 100 Personen.", requiredError: "Ergänze einen Namen und öffentlichen Treffpunkt.", plus: "PLUS", format: "Zeiten werden in deiner lokalen Zeitzone angezeigt.", permissionError: "Melde dich erneut an, um fortzufahren.", hostVerification: "Schließe die Selfie-Verifizierung ab, bevor du eine Einheit organisierst.", searchSports: "Sportarten suchen", noSports: "Keine Sportarten gefunden. Versuche eine andere Suche.", sportResults: (n) => `${n} ${n === 1 ? "Sportart" : "Sportarten"}`,
  },
};

const icon = (name) => `<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
const keyFor = () => globalThis.crypto?.randomUUID?.() ?? `train-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const PHOTO_BY_SPORT = {
  running: "./assets/moments/runners-training.jpg",
  cycling: "./assets/moments/cycling-landscape.jpg",
  climbing: "./assets/moments/climbing-outdoors.jpg",
};

export function createTrainFeature({ root, repository, getLanguage, openModal, closeModal, showToast, onUpgrade }) {
  let scope = "discover";
  let sportId = null;
  let sportFilterOpen = false;
  let sportSearch = "";
  let activities = [];
  let membership = null;
  let status = "loading";
  let requestId = 0;
  let hostingBusy = false;
  const copy = () => COPY[getLanguage()] ?? COPY.en;
  const language = () => COPY[getLanguage()] ? getLanguage() : "en";
  const label = (id) => escapeHtml(getSportLabel(id, language()));
  const formatDate = (value, options) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(language(), options).format(date) : "—";
  };

  function dateTile(activity, compact = false) {
    const date = new Date(activity.startsAt);
    const day = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(language(), { day: "numeric" }).formatToParts(date).find(part => part.type === "day")?.value : "—";
    return `<span class="train-date${compact ? " train-date-small" : ""}" aria-hidden="true"><b>${escapeHtml(day)}</b><span>${escapeHtml(formatDate(activity.startsAt, { month: "short" }))}</span></span>`;
  }

  function counts(activity) {
    const total = Number(activity.capacity) || 0;
    const attending = Number(activity.attendeeCount) || 0;
    return { total, attending, remaining: Math.max(0, total - attending) };
  }

  function activityStatus(activity) {
    const c = copy();
    if (activity.isHost) return c.youHost;
    if (activity.joined) return c.joined;
    return counts(activity).remaining ? c.remaining(counts(activity).remaining) : c.full;
  }

  function activityMeta(activity) {
    return [formatDate(activity.startsAt, { weekday: "short", hour: "numeric", minute: "2-digit" }), activity.pace || (activity.distanceKm ? `${activity.distanceKm} km` : "")].filter(Boolean).map(escapeHtml).join(" · ");
  }

  function featured(activity) {
    const c = copy();
    const photo = PHOTO_BY_SPORT[activity.sportId];
    return `<button type="button" class="train-featured${photo ? " train-featured-photo" : ""}" data-train-action="details" data-activity-id="${escapeHtml(activity.id)}">
      ${photo ? `<img class="train-featured-image" src="${photo}" alt="" loading="lazy" decoding="async">` : ""}
      <span class="train-featured-top">${dateTile(activity)}<span class="train-kicker">${c.next}</span></span>
      <span class="train-featured-body"><span class="train-featured-sport">${label(activity.sportId)}${activity.host?.verified ? `<span class="train-verified" title="${c.verified}">${icon("verified")}<span class="visually-hidden">${c.verified}</span></span>` : ""}</span><strong>${escapeHtml(activity.title)}</strong><span class="train-featured-meta">${activityMeta(activity)}</span><span class="train-featured-location">${icon("location_on")}${escapeHtml(activity.location)}</span></span>
      <span class="train-featured-footer"><span class="${activity.joined || activity.isHost ? "train-status-going" : ""}">${activity.joined || activity.isHost ? icon("check_circle") : icon("group")}${escapeHtml(activityStatus(activity))}</span><span class="train-featured-arrow">${icon("arrow_outward")}</span></span>
    </button>`;
  }

  function activityRow(activity) {
    const c = copy();
    return `<button type="button" class="train-activity-row" data-train-action="details" data-activity-id="${escapeHtml(activity.id)}">${dateTile(activity, true)}<span class="train-row-content"><span class="train-row-sport">${label(activity.sportId)}</span><strong>${escapeHtml(activity.title)}</strong><span class="train-row-meta">${activityMeta(activity)}</span><span class="train-row-location">${escapeHtml(activity.location)}</span><span class="train-row-status${activity.joined || activity.isHost ? " train-status-going" : ""}">${escapeHtml(activityStatus(activity))}</span></span>${icon("arrow_outward")}</button>`;
  }

  function sportOptions() {
    const c = copy();
    const matches = searchSports(sportSearch, language());
    const option = (id, text) => `<label class="train-sport-option"><input type="radio" name="train-sport-filter" value="${id}" ${sportId === (id || null) ? "checked" : ""}><span>${text}</span>${icon("check")}</label>`;
    return `${option("", c.all)}${matches.map((sport) => option(sport.id, label(sport.id))).join("")}${matches.length ? "" : `<p class="train-sport-empty">${c.noSports}</p>`}`;
  }

  function sportFilter() {
    const c = copy();
    return `<details class="train-sports" ${sportFilterOpen ? "open" : ""}><summary class="train-sport-summary" data-train-focus="sport-filter"><span>${c.sport}</span><strong>${sportId ? label(sportId) : c.all}</strong>${icon("expand_more")}</summary><div class="train-sport-panel"><label class="train-sport-search">${icon("search")}<input type="search" value="${escapeHtml(sportSearch)}" placeholder="${c.searchSports}" aria-label="${c.searchSports}" data-train-sport-search autocomplete="off" spellcheck="false"></label><p class="train-sport-count" data-train-sport-count role="status">${c.sportResults(searchSports(sportSearch, language()).length)}</p><div class="train-sport-options" data-train-sport-options role="radiogroup" aria-label="${c.filter}">${sportOptions()}</div></div></details>`;
  }

  function closeSportFilter() {
    sportFilterOpen = false;
    sportSearch = "";
    const filter = root.querySelector(".train-sports");
    if (filter) filter.open = false;
    const search = root.querySelector("[data-train-sport-search]");
    if (search) search.value = "";
    const options = root.querySelector("[data-train-sport-options]");
    if (options) options.innerHTML = sportOptions();
    const count = root.querySelector("[data-train-sport-count]");
    if (count) count.textContent = copy().sportResults(SPORTS.length);
    root.querySelector(".train-sport-summary")?.focus({ preventScroll: true });
  }

  function render() {
    const c = copy();
    const currentFocus = root.contains(document.activeElement) ? document.activeElement.dataset.trainFocus : null;
    root.innerHTML = `<div class="train-page"><header class="train-heading"><div><p class="eyebrow">${c.eyebrow}</p><h1 id="train-title">${c.title}</h1><p class="train-intro">${c.intro}</p></div><button type="button" class="train-create-icon" data-train-action="create" data-train-focus="create" aria-label="${c.host}" title="${c.host}" ${hostingBusy ? "disabled" : ""}>${icon("add")}</button></header>
      <div class="train-scope" role="group" aria-label="${c.details}"><button type="button" data-train-action="scope" data-scope="discover" data-train-focus="discover" aria-pressed="${scope === "discover"}">${c.upcoming}</button><button type="button" data-train-action="scope" data-scope="going" data-train-focus="going" aria-pressed="${scope === "going"}">${c.going}</button></div>
      ${sportFilter()}
      <div class="train-results" aria-busy="${status === "loading"}">${status === "loading" ? `<div class="train-state" role="status">${icon("event")}<p>${c.loading}</p></div>` : status === "error" ? `<div class="train-state" role="alert">${icon("cloud_off")}<h2>${c.failed}</h2><button type="button" class="train-secondary" data-train-action="retry">${c.retry}</button></div>` : activities.length ? `${featured(activities[0])}${activities.length > 1 ? `<div class="train-list-heading"><h2>${scope === "going" ? c.plan : c.more}</h2><span>${activities.length - 1}</span></div><div class="train-activity-list">${activities.slice(1).map(activityRow).join("")}</div>` : ""}` : `<div class="train-state">${icon("event_available")}<h2>${scope === "going" ? c.emptyGoing : c.empty}</h2><p>${scope === "going" ? c.emptyGoingHint : c.emptyHint}</p>${scope === "going" || sportId ? `<button type="button" class="train-secondary" data-train-action="browse">${scope === "going" ? c.browse : c.reset}</button>` : ""}</div>`}</div>
      <footer class="train-host"><div><span class="train-plus-label">PACE ${c.plus}</span><h2>${c.hostTitle}</h2><p>${membership?.entitlements?.hostActivities ? c.hostMemberHint : c.hostHint}</p></div><button type="button" class="train-primary" data-train-action="create" ${hostingBusy ? "disabled" : ""}>${c.host}${icon("add")}</button></footer></div>`;
    if (currentFocus) root.querySelector(`[data-train-focus="${currentFocus}"]`)?.focus({ preventScroll: true });
  }

  async function refresh() {
    const currentRequest = ++requestId;
    status = "loading";
    render();
    const [activityResult, membershipResult] = await Promise.allSettled([
      repository.listActivities({ sportId, scope: scope === "going" ? "joined" : "discover" }), repository.getMembership(),
    ]);
    if (currentRequest !== requestId) return;
    membership = membershipResult.status === "fulfilled" ? membershipResult.value : null;
    if (activityResult.status === "fulfilled" && Array.isArray(activityResult.value)) {
      activities = activityResult.value.filter((activity) => new Date(activity.startsAt).getTime() > Date.now()).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
      status = "ready";
    } else {
      activities = [];
      status = "error";
    }
    render();
  }

  function errorMessage(error) {
    const c = copy();
    if (error?.code === "ACTIVITY_FULL") return c.fullError;
    if (["ACTIVITY_NOT_FOUND", "ACTIVITY_STARTED", "ACTIVITY_CANCELLED", "ACTIVITY_CLOSED", "NOT_FOUND"].includes(error?.code)) return c.unavailable;
    if (["UNAUTHENTICATED", "UNAUTHORIZED", "AUTH_REQUIRED", "SESSION_EXPIRED"].includes(error?.code)) return c.permissionError;
    if (error?.code === "HOST_CANNOT_LEAVE") return c.hostCannotLeave;
    if (error?.code === "HOST_VERIFICATION_REQUIRED") return c.hostVerification;
    return c.actionFailed;
  }

  function modalHeader(title, eyebrow = copy().details) {
    return `<header class="train-modal-heading"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2 id="modal-title">${escapeHtml(title)}</h2></div><button type="button" class="close" data-train-close aria-label="${copy().close}">×</button></header>`;
  }

  function mountModal(content) {
    openModal(`<section class="train-dialog" data-train-dialog>${content}</section>`);
    const mount = document.querySelector("#modal [data-train-dialog]");
    mount?.addEventListener("click", (event) => {
      if (event.target.closest("[data-train-close]")) closeModal();
    });
    return mount;
  }

  function detailContent(activity) {
    const c = copy();
    const { total, attending, remaining } = counts(activity);
    const started = new Date(activity.startsAt).getTime() <= Date.now();
    const cancelled = activity.status === "cancelled";
    const cannotJoin = cancelled || started || activity.isHost || (!activity.joined && remaining === 0);
    const actionText = cancelled ? c.unavailable : activity.isHost ? c.youHost : started ? c.ended : activity.joined ? c.leave : remaining ? c.join : c.full;
    return `${modalHeader(activity.title, getSportLabel(activity.sportId, language()))}
      <div class="train-detail-host"><span class="train-host-avatar" aria-hidden="true">${escapeHtml((activity.host?.name ?? "P").slice(0, 1))}</span><span><small>${c.hostedBy}</small><strong>${escapeHtml(activity.host?.name ?? "PACE")}</strong></span>${activity.host?.verified ? `<span class="train-detail-verified">${icon("verified")}<span>${c.verified}</span></span>` : ""}</div>
      <dl class="train-detail-facts"><div>${icon("calendar_today")}<dt>${c.when}</dt><dd>${escapeHtml(formatDate(activity.startsAt, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}</dd></div><div>${icon("location_on")}<dt>${c.where}</dt><dd>${escapeHtml(activity.location)}</dd></div>${activity.pace ? `<div>${icon("speed")}<dt>${c.pace}</dt><dd>${escapeHtml(activity.pace)}</dd></div>` : ""}<div>${icon("group")}<dt>${c.people}</dt><dd>${attending} / ${total} · ${escapeHtml(activityStatus(activity))}</dd></div></dl>
      <section class="train-detail-plan"><h3>${c.about}</h3><p>${escapeHtml(activity.description || c.noDescription)}</p></section><p class="train-detail-note">${c.planHint}</p><p class="train-form-error" data-train-error role="alert" hidden></p>
      <button type="button" class="${activity.joined && !activity.isHost ? "train-secondary" : "train-primary"} train-detail-cta" data-train-membership ${cannotJoin ? "disabled" : ""}>${actionText}${cannotJoin ? "" : icon(activity.joined ? "close" : "arrow_forward")}</button><p class="train-detail-free">${c.free} · ${c.format}</p>`;
  }

  async function openDetails(activityId) {
    const c = copy();
    const mount = mountModal(`${modalHeader(c.details)}<div class="train-state" role="status"><p>${c.loading}</p></div>`);
    if (!mount) return;
    let activity;
    let busy = false;
    let pendingKey = null;
    const load = async () => {
      try {
        activity = await repository.getActivity(activityId);
        if (!mount.isConnected) return;
        if (!activity) throw new Error("Activity missing");
        mount.innerHTML = detailContent(activity);
        mount.querySelector(".close")?.focus({ preventScroll: true });
      } catch {
        if (mount.isConnected) mount.innerHTML = `${modalHeader(copy().details)}<div class="train-state" role="alert"><p>${copy().detailFailed}</p><button type="button" class="train-secondary" data-train-detail-retry>${copy().retry}</button></div>`;
      }
    };
    mount.addEventListener("click", async (event) => {
      if (event.target.closest("[data-train-detail-retry]")) { await load(); return; }
      const button = event.target.closest("[data-train-membership]");
      if (!button || button.disabled || busy || !activity) return;
      busy = true;
      button.disabled = true;
      button.textContent = copy().saving;
      const errorNode = mount.querySelector("[data-train-error]");
      errorNode.hidden = true;
      const leaving = Boolean(activity.joined);
      pendingKey ??= keyFor();
      try {
        const result = await (leaving ? repository.leaveActivity(activityId, { idempotencyKey: pendingKey }) : repository.joinActivity(activityId, { idempotencyKey: pendingKey }));
        pendingKey = null;
        activity = result?.id ? result : await repository.getActivity(activityId);
        if (mount.isConnected) {
          mount.innerHTML = detailContent(activity);
          mount.querySelector("[data-train-membership]")?.focus({ preventScroll: true });
        }
        showToast(leaving ? copy().leaveDone : copy().joinDone);
        await refresh();
      } catch (error) {
        if (mount.isConnected) {
          errorNode.textContent = errorMessage(error);
          errorNode.hidden = false;
          button.disabled = false;
          button.textContent = leaving ? copy().leave : copy().join;
        }
      } finally { busy = false; }
    });
    await load();
  }

  function localDateValue(date = new Date(Date.now() + 60 * 60 * 1000)) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  async function openCreate() {
    if (hostingBusy) return;
    hostingBusy = true;
    root.querySelectorAll('[data-train-action="create"]').forEach((button) => { button.disabled = true; });
    try {
      membership = await repository.getMembership();
      if (!membership?.entitlements?.hostActivities) {
        await onUpgrade("hostActivities");
        return;
      }
      const c = copy();
      const mount = mountModal(`${modalHeader(c.createTitle, "PACE PLUS")}<p class="train-create-intro">${c.createIntro}</p>
        <form class="train-create-form" data-train-create-form>
          <label>${c.titleLabel}<input name="title" required maxlength="80" placeholder="${c.titlePlaceholder}" autocomplete="off"></label>
          <label>${c.sport}<select name="sportId" required>${SPORTS.map((sport) => `<option value="${sport.id}" ${sport.id === (sportId || "running") ? "selected" : ""}>${label(sport.id)}</option>`).join("")}</select></label>
          <label>${c.date}<input type="datetime-local" name="startsAt" required min="${localDateValue(new Date())}" value="${localDateValue()}"><small>${c.format}</small></label>
          <label>${c.location}<input name="location" required maxlength="160" placeholder="${c.locationPlaceholder}" autocomplete="off"></label>
          <label>${c.capacity}<input type="number" inputmode="numeric" name="capacity" required min="2" max="100" step="1" value="12"></label>
          <label>${c.pace} <span class="train-optional">${c.optional}</span><input name="pace" maxlength="80" placeholder="${c.pacePlaceholder}"></label>
          <label>${c.description} <span class="train-optional">${c.optional}</span><textarea name="description" maxlength="1200" rows="3" placeholder="${c.descriptionPlaceholder}"></textarea></label>
          <p class="train-create-notice">${c.createNotice}</p><p class="train-form-error" data-train-error role="alert" hidden></p><button class="train-primary" type="submit">${c.publish}${icon("arrow_forward")}</button>
        </form>`);
      if (!mount) return;
      const form = mount.querySelector("form");
      let submitting = false;
      let draftKey = null;
      let lastInput = "";
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (submitting || !form.reportValidity()) return;
        const data = new FormData(form);
        const startsAt = new Date(data.get("startsAt"));
        const input = { title: String(data.get("title")).trim(), sportId: String(data.get("sportId")), startsAt: "", location: String(data.get("location")).trim(), capacity: Number(data.get("capacity")), pace: String(data.get("pace")).trim(), description: String(data.get("description")).trim() };
        const errorNode = mount.querySelector("[data-train-error]");
        let validationError = "";
        if (!input.title || !input.location) validationError = copy().requiredError;
        else if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now()) validationError = copy().futureError;
        else if (!Number.isInteger(input.capacity) || input.capacity < 2 || input.capacity > 100) validationError = copy().capacityError;
        if (validationError) { errorNode.textContent = validationError; errorNode.hidden = false; return; }
        input.startsAt = startsAt.toISOString();
        const serializedInput = JSON.stringify(input);
        if (!draftKey || lastInput !== serializedInput) { draftKey = keyFor(); lastInput = serializedInput; }
        errorNode.hidden = true;
        submitting = true;
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        submit.textContent = copy().creating;
        Array.from(form.elements).forEach((control) => { control.disabled = true; });
        try {
          await repository.createActivity(input, { idempotencyKey: draftKey });
          if (mount.isConnected) closeModal();
          scope = "going";
          sportId = null;
          showToast(copy().createDone);
          await refresh();
        } catch (error) {
          if (error?.code === "PLUS_REQUIRED") {
            if (mount.isConnected) { closeModal(); await onUpgrade("hostActivities"); }
          } else if (mount.isConnected) {
            errorNode.textContent = errorMessage(error);
            errorNode.hidden = false;
          }
        } finally {
          submitting = false;
          if (mount.isConnected) {
            Array.from(form.elements).forEach((control) => { control.disabled = false; });
            submit.textContent = copy().publish;
          }
        }
      });
    } catch (error) { showToast(errorMessage(error)); }
    finally {
      hostingBusy = false;
      root.querySelectorAll('[data-train-action="create"]').forEach((button) => { button.disabled = false; });
    }
  }

  async function handleClick(event) {
    const button = event.target.closest("[data-train-action]");
    if (!button || !root.contains(button) || button.disabled) return;
    const action = button.dataset.trainAction;
    if (action === "details") await openDetails(button.dataset.activityId);
    if (action === "create") await openCreate();
    if (action === "retry") await refresh();
    if (action === "scope") { scope = button.dataset.scope; await refresh(); }
    if (action === "browse") { scope = "discover"; sportId = null; await refresh(); }
  }

  root.addEventListener("click", handleClick);
  root.addEventListener("toggle", (event) => {
    if (event.target.matches(".train-sports") && root.contains(event.target)) sportFilterOpen = event.target.open;
  }, true);
  root.addEventListener("input", (event) => {
    if (!event.target.matches("[data-train-sport-search]")) return;
    sportSearch = event.target.value;
    root.querySelector("[data-train-sport-options]").innerHTML = sportOptions();
    root.querySelector("[data-train-sport-count]").textContent = copy().sportResults(searchSports(sportSearch, language()).length);
  });
  root.addEventListener("change", (event) => {
    if (!event.target.matches('[name="train-sport-filter"]')) return;
    sportId = event.target.value || null;
    closeSportFilter();
    void refresh();
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && event.target.closest(".train-sports[open]")) {
      event.preventDefault();
      event.stopPropagation();
      closeSportFilter();
    }
  });
  return { refresh };
}
