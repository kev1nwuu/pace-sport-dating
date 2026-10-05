export const SPORT_CATALOG_VERSION = "2026-08-15";

const sport = (id, category, popularity, zh, en, fr, es, de) => ({
  id,
  category,
  popularity,
  labels: { "zh-CN": zh, en, fr, es, de },
});

// Stable IDs are the persistence/API values. Labels are presentation only.
export const SPORTS = Object.freeze([
  sport("running", "endurance", 100, "跑步", "Running", "Course", "Running", "Laufen"),
  sport("cycling", "endurance", 99, "骑行", "Cycling", "Vélo", "Ciclismo", "Radfahren"),
  sport("strength-training", "fitness", 98, "力量训练", "Strength training", "Musculation", "Entrenamiento de fuerza", "Krafttraining"),
  sport("tennis", "racquet", 97, "网球", "Tennis", "Tennis", "Tenis", "Tennis"),
  sport("swimming", "water", 96, "游泳", "Swimming", "Natation", "Natación", "Schwimmen"),
  sport("hiking", "outdoor", 95, "徒步", "Hiking", "Randonnée", "Senderismo", "Wandern"),
  sport("yoga", "fitness", 94, "瑜伽", "Yoga", "Yoga", "Yoga", "Yoga"),
  sport("football", "team", 93, "足球", "Football", "Football", "Fútbol", "Fußball"),
  sport("basketball", "team", 92, "篮球", "Basketball", "Basket-ball", "Baloncesto", "Basketball"),
  sport("climbing", "outdoor", 91, "攀岩", "Climbing", "Escalade", "Escalada", "Klettern"),
  sport("skiing", "winter", 90, "滑雪", "Skiing", "Ski", "Esquí", "Skifahren"),
  sport("golf", "precision", 89, "高尔夫", "Golf", "Golf", "Golf", "Golf"),
  sport("surfing", "water", 88, "冲浪", "Surfing", "Surf", "Surf", "Surfen"),
  sport("volleyball", "team", 87, "排球", "Volleyball", "Volley-ball", "Voleibol", "Volleyball"),
  sport("badminton", "racquet", 86, "羽毛球", "Badminton", "Badminton", "Bádminton", "Badminton"),
  sport("pickleball", "racquet", 85, "匹克球", "Pickleball", "Pickleball", "Pickleball", "Pickleball"),
  sport("padel", "racquet", 84, "板式网球", "Padel", "Padel", "Pádel", "Padel"),
  sport("boxing", "combat", 83, "拳击", "Boxing", "Boxe", "Boxeo", "Boxen"),
  sport("martial-arts", "combat", 82, "武术", "Martial arts", "Arts martiaux", "Artes marciales", "Kampfsport"),
  sport("pilates", "fitness", 81, "普拉提", "Pilates", "Pilates", "Pilates", "Pilates"),
  sport("rowing", "water", 80, "赛艇", "Rowing", "Aviron", "Remo", "Rudern"),
  sport("kayaking", "water", 79, "皮划艇", "Kayaking", "Kayak", "Kayak", "Kajak"),
  sport("triathlon", "endurance", 78, "铁人三项", "Triathlon", "Triathlon", "Triatlón", "Triathlon"),
  sport("trail-running", "endurance", 77, "越野跑", "Trail running", "Trail", "Trail running", "Trailrunning"),
  sport("snowboarding", "winter", 76, "单板滑雪", "Snowboarding", "Snowboard", "Snowboard", "Snowboarden"),
  sport("ice-skating", "winter", 75, "滑冰", "Ice skating", "Patinage", "Patinaje sobre hielo", "Eislaufen"),
  sport("ice-hockey", "team", 74, "冰球", "Ice hockey", "Hockey sur glace", "Hockey sobre hielo", "Eishockey"),
  sport("baseball", "team", 73, "棒球", "Baseball", "Baseball", "Béisbol", "Baseball"),
  sport("rugby", "team", 72, "橄榄球", "Rugby", "Rugby", "Rugby", "Rugby"),
  sport("cricket", "team", 71, "板球", "Cricket", "Cricket", "Críquet", "Cricket"),
  sport("table-tennis", "racquet", 70, "乒乓球", "Table tennis", "Tennis de table", "Tenis de mesa", "Tischtennis"),
  sport("squash", "racquet", 69, "壁球", "Squash", "Squash", "Squash", "Squash"),
  sport("crossfit", "fitness", 68, "综合体能", "CrossFit", "CrossFit", "CrossFit", "CrossFit"),
  sport("hyrox", "fitness", 67.5, "HYROX 健身赛", "HYROX", "HYROX", "HYROX", "HYROX"),
  sport("dance", "fitness", 67, "舞蹈", "Dance", "Danse", "Baile", "Tanz"),
  sport("gymnastics", "fitness", 66, "体操", "Gymnastics", "Gymnastique", "Gimnasia", "Turnen"),
  sport("sailing", "water", 65, "帆船", "Sailing", "Voile", "Vela", "Segeln"),
  sport("diving", "water", 64, "潜水", "Diving", "Plongée", "Buceo", "Tauchen"),
  sport("equestrian", "outdoor", 63, "马术", "Equestrian", "Équitation", "Hípica", "Reitsport"),
  sport("skateboarding", "urban", 62, "滑板", "Skateboarding", "Skateboard", "Skateboarding", "Skateboarding"),
  sport("american-football", "team", 61, "美式橄榄球", "American football", "Football américain", "Fútbol americano", "American Football"),
  sport("lacrosse", "team", 60, "长曲棍球", "Lacrosse", "Crosse", "Lacrosse", "Lacrosse"),
  sport("field-hockey", "team", 59, "曲棍球", "Field hockey", "Hockey sur gazon", "Hockey hierba", "Feldhockey"),
]);

export const POPULAR_SPORT_IDS = Object.freeze(["running", "cycling"]);
const VALID_SPORT_IDS = new Set(SPORTS.map((item) => item.id));

export function getSportById(id) {
  return SPORTS.find((item) => item.id === id) ?? null;
}

export function getSportLabel(id, language = "en") {
  const item = getSportById(id);
  return item?.labels[language] ?? item?.labels.en ?? id ?? "";
}

export function searchSports(query, language = "en") {
  const normalized = String(query ?? "").trim().toLocaleLowerCase(language);
  if (!normalized) return SPORTS;
  return SPORTS.filter((item) => Object.values(item.labels).some((label) => label.toLocaleLowerCase(language).includes(normalized)) || item.id.includes(normalized));
}

export function normalizeSportIds(ids = []) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids)].filter((id) => VALID_SPORT_IDS.has(id));
}
