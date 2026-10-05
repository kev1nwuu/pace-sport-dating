/** Business rules kept separate from the UI so product redlines remain testable. */
export function subscriptionViewModel({ plan, renewalAt, cancelledAt }) {
  return {
    plan,
    accessUntil: renewalAt,
    distanceFilterIncluded: true,
    distanceFilterVisible: true,
    showCancelButton: Boolean(plan && plan !== "free" && !cancelledAt),
  };
}

export function discoverOrWaitlist(candidates, maxDistanceKm) {
  const local = Array.isArray(candidates)
    ? candidates.filter((candidate) => Number.isFinite(candidate?.distanceKm) && candidate.distanceKm <= maxDistanceKm)
    : [];
  return local.length
    ? { state: "results", candidates: local }
    : { state: "waitlist", candidates: [] };
}

export function createMatchIfMutual(firstUserId, secondUserId, likes) {
  if (!firstUserId || !secondUserId || firstUserId === secondUserId || !Array.isArray(likes)) return null;
  const firstLikesSecond = likes.some((like) => Array.isArray(like) && like[0] === firstUserId && like[1] === secondUserId);
  const secondLikesFirst = likes.some((like) => Array.isArray(like) && like[0] === secondUserId && like[1] === firstUserId);
  return firstLikesSecond && secondLikesFirst
    ? { members: [firstUserId, secondUserId], source: "mutual_like" }
    : null;
}

export function canSendMarketing({ marketingOptIn, cancelledAt, deletedAt }) {
  return Boolean(marketingOptIn) && !cancelledAt && !deletedAt;
}

/** Returns a local calendar date suitable for an `<input type="date">`. */
export function localDateInputValue(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError("date must be valid");
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateAfterToday(days, now = new Date()) {
  if (!Number.isInteger(days)) throw new TypeError("days must be an integer");
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) throw new TypeError("now must be valid");
  date.setDate(date.getDate() + days);
  return localDateInputValue(date);
}

/** Picks the next occurrence after today so an invite never defaults to the past. */
export function nextWeekdayDate(weekday, now = new Date()) {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new RangeError("weekday must be between 0 and 6");
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) throw new TypeError("now must be valid");
  const daysUntil = (weekday - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntil);
  return localDateInputValue(date);
}

export function validateProfile({ bio, sports, photos }) {
  const errors = [];
  if (typeof bio !== "string") errors.push("简介必须是文本");
  if (!Array.isArray(sports) || sports.length === 0) errors.push("请至少选择一项运动");
  if (!Number.isInteger(photos) || photos < 0 || photos > 6) errors.push("照片数量必须在 0 到 6 之间");
  return {
    valid: errors.length === 0,
    errors,
  };
}
