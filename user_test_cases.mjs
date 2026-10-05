/** PACE MVP user acceptance tests — written before the UI implementation. */
import assert from "node:assert/strict";
import {
  canSendMarketing,
  createMatchIfMutual,
  dateAfterToday,
  discoverOrWaitlist,
  localDateInputValue,
  nextWeekdayDate,
  subscriptionViewModel,
  validateProfile,
} from "./app_logic.mjs";
import { addConnectionPostComment, createConnectionFeed, prependConnectionPost, toggleConnectionPostLike, visibleConnectedPosts } from "./connection_feed.mjs";

const tests = [
  ["UT-01 距离筛选永远可见", () => {
    const view = subscriptionViewModel({ plan: "free", renewalAt: null, cancelledAt: null });
    assert.equal(view.distanceFilterIncluded, true);
    assert.equal(view.distanceFilterVisible, true);
  }],
  ["UT-02 取消订阅不会降级基础功能或既得权益", () => {
    const view = subscriptionViewModel({ plan: "plus", renewalAt: "2026-09-09", cancelledAt: "2026-08-09" });
    assert.equal(view.distanceFilterIncluded, true);
    assert.equal(view.distanceFilterVisible, true);
    assert.equal(view.accessUntil, "2026-09-09");
    assert.equal(view.showCancelButton, false);
  }],
  ["UT-03 稀薄城市诚实地进入等待名单", () => {
    const discovery = discoverOrWaitlist([{ id: "far", distanceKm: 512 }], 20);
    assert.deepEqual(discovery, { state: "waitlist", candidates: [] });
    assert.deepEqual(discoverOrWaitlist(null, 20), { state: "waitlist", candidates: [] });
    assert.deepEqual(discoverOrWaitlist([{ id: "invalid", distanceKm: Number.NaN }], 20), { state: "waitlist", candidates: [] });
  }],
  ["UT-05 只允许真实双向 Like 生成匹配", () => {
    assert.equal(createMatchIfMutual("a", "b", [["a", "b"]]), null);
    assert.deepEqual(createMatchIfMutual("a", "b", [["a", "b"], ["b", "a"]]), {
      members: ["a", "b"], source: "mutual_like",
    });
    assert.equal(createMatchIfMutual("a", "a", [["a", "a"]]), null);
    assert.equal(createMatchIfMutual("a", "b", null), null);
  }],
  ["UT-08 取消或注销后停止营销", () => {
    assert.equal(canSendMarketing({ marketingOptIn: true, cancelledAt: "2026-08-09", deletedAt: null }), false);
    assert.equal(canSendMarketing({ marketingOptIn: true, cancelledAt: null, deletedAt: "2026-08-09" }), false);
    assert.equal(canSendMarketing({ marketingOptIn: false, cancelledAt: null, deletedAt: null }), false);
    assert.equal(canSendMarketing({ marketingOptIn: true, cancelledAt: null, deletedAt: null }), true);
  }],
  ["UT-09 简介没有最短字数", () => {
    assert.equal(validateProfile({ bio: "", sports: ["跑步"], photos: 0 }).valid, true);
    assert.equal(validateProfile({ bio: "Go", sports: ["跑步", "攀岩"], photos: 6 }).valid, true);
    assert.equal(validateProfile({ bio: "Go", sports: ["跑步"], photos: 7 }).valid, false);
    assert.equal(validateProfile({ bio: null, sports: [], photos: -1 }).errors.length, 3);
  }],
  ["UT-10 动态页只展示已连接用户且拒绝公开内容", () => {
    const feed = createConnectionFeed();
    feed.push({ id: "public", visibility: "public", author: { connection_status: "connected" } });
    feed.push({ id: "not-connected", visibility: "connections", author: { connection_status: "pending" } });
    const visible = visibleConnectedPosts(feed);
    assert.ok(visible.length >= 3);
    assert.ok(visible.every((post) => post.visibility === "connections" && post.author.connection_status === "connected"));
    assert.doesNotMatch(visible.map((post) => post.id).join(","), /public|not-connected/);
  }],
  ["UT-11 动态点赞计数可逆且不会变成负数", () => {
    const feed = createConnectionFeed();
    const post = feed[0];
    const liked = toggleConnectionPostLike(feed, post.id);
    assert.equal(liked[0].liked_by_me, true);
    assert.equal(liked[0].reaction_count, post.reaction_count + 1);
    const unliked = toggleConnectionPostLike(liked, post.id);
    assert.equal(unliked[0].liked_by_me, false);
    assert.equal(unliked[0].reaction_count, post.reaction_count);
    const malformed = toggleConnectionPostLike([{ id: "broken", liked_by_me: false }], "broken");
    assert.equal(malformed[0].reaction_count, 1);
  }],
  ["UT-12 动态评论拒绝空内容并保留稳定 post ID", () => {
    const feed = createConnectionFeed();
    const postId = feed[0].id;
    assert.equal(addConnectionPostComment(feed, postId, { id: "empty", author_name: "Kevin", text: "   " }), feed);
    const updated = addConnectionPostComment(feed, postId, { id: "comment_new", author_name: "Kevin", text: "  Great session  " });
    assert.equal(updated[0].id, postId);
    assert.deepEqual(updated[0].comments.at(-1), { id: "comment_new", author_name: "Kevin", text: "Great session" });
    const withoutComments = addConnectionPostComment([{ id: "post" }], "post", { id: "comment", author_name: "Kevin", text: "Ready" });
    assert.equal(withoutComments[0].comments.length, 1);
  }],
  ["UT-13 新发布的动态进入顶部且只能对 Connected 可见", () => {
    const feed = createConnectionFeed();
    const published = prependConnectionPost(feed, { id: "post_new", author_id: "user_kevin", author: { name: "Kevin", connection_status: "self" }, visibility: "connections", sport_id: "running", caption: "Easy 5K", workout: {} });
    assert.equal(published[0].id, "post_new");
    assert.equal(published[0].is_my_post, true);
    assert.equal(published[0].reaction_count, 0);
    assert.equal(visibleConnectedPosts(published)[0].id, "post_new");
    const customSport = prependConnectionPost(feed, { id: "post_custom", author_id: "user_kevin", visibility: "connections", sport_id: null, sport_name: "Ultimate Frisbee" });
    assert.equal(customSport[0].sport_name, "Ultimate Frisbee");
    const universalMetrics = prependConnectionPost(feed, { id: "post_metrics", author_id: "user_kevin", visibility: "connections", sport_name: "Tennis", workout: { metrics: [{ label: "Score", value: "6–4, 6–3" }, { label: "Duration", value: "72 min" }] } });
    assert.deepEqual(universalMetrics[0].workout.metrics, [{ label: "Score", value: "6–4, 6–3" }, { label: "Duration", value: "72 min" }]);
    const multiPhoto = prependConnectionPost(feed, { id: "post_photos", author_id: "user_kevin", visibility: "connections", sport_name: "Skiing", media: [{ type: "image", url: "blob:one", alt: "One" }, { type: "image", url: "blob:two", alt: "Two" }] });
    assert.equal(multiPhoto[0].media.length, 2);
    assert.equal(prependConnectionPost(feed, { id: "bad", author_id: "user_kevin", visibility: "public", sport_id: "running" }), feed);
  }],
  ["UT-14 日期默认值使用本地日历且不会落在过去", () => {
    const thursday = new Date(2026, 8, 3, 23, 45);
    assert.equal(localDateInputValue(thursday), "2026-09-03");
    assert.equal(dateAfterToday(30, thursday), "2026-10-03");
    assert.equal(nextWeekdayDate(6, thursday), "2026-09-05");
    assert.equal(nextWeekdayDate(6, new Date(2026, 8, 5, 12)), "2026-09-12");
    assert.throws(() => nextWeekdayDate(7, thursday), RangeError);
  }],
];

let failures = 0;
for (const [name, run] of tests) {
  try {
    run();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}\n  ${error.message}`);
  }
}
if (failures) process.exitCode = 1;
console.log(`\n${tests.length - failures}/${tests.length} user tests passed`);
