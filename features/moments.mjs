import { SPORTS, getSportLabel } from "../sport_catalog.mjs?v=pace-release-audit-58";
import { addConnectionPostComment, prependConnectionPost, visibleConnectedPosts } from "../connection_feed.mjs?v=pace-release-audit-58";
import { momentsCopy } from "./app_copy.mjs?v=pace-release-audit-58";
import { escapeHtml } from "./dom.mjs?v=pace-release-audit-58";

export function createMomentsFeature({
  repository,
  getLanguage,
  translate,
  openModal,
  closeModal,
  showToast,
  switchTab,
  openConversation,
}) {
  let feedPosts = [];

  function dateForLocale(isoDate) {
    return new Intl.DateTimeFormat(getLanguage(), { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${isoDate}T12:00:00`));
  }

  function formatMomentTime(value) {
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return "";
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
    const relative = new Intl.RelativeTimeFormat(getLanguage(), { numeric: "auto" });
    if (elapsedMinutes < 60) return relative.format(-elapsedMinutes, "minute");
    if (elapsedMinutes < 1440) return relative.format(-Math.round(elapsedMinutes / 60), "hour");
    if (elapsedMinutes < 10080) return relative.format(-Math.round(elapsedMinutes / 1440), "day");
    return dateForLocale(value.slice(0, 10));
  }

  function workoutMetrics(post, copy) {
    const workout = post.workout ?? {};
    const customMetrics = Array.isArray(workout.metrics)
      ? workout.metrics
        .filter((metric) => metric?.label?.trim() && metric?.value?.trim())
        .map((metric) => ({ value: metric.value.trim(), label: metric.label.trim() }))
      : [];
    if (customMetrics.length) return customMetrics.slice(0, 3);
    return [
      workout.distance_km ? { value: workout.distance_km, label: "km" } : null,
      workout.duration ? { value: workout.duration, label: "time" } : null,
      workout.pace ? { value: workout.pace, label: "pace" } : null,
      workout.grade ? { value: workout.grade, label: "grade" } : null,
      workout.elevation_m ? { value: `↗ ${workout.elevation_m} m`, label: "elevation" } : null,
      workout.sessions_this_week ? { value: workout.sessions_this_week, label: copy.sessions } : null,
    ].filter(Boolean).slice(0, 3);
  }

  function momentSportLabel(post) {
    return post.sport_name?.trim() || getSportLabel(post.sport_id, getLanguage()) || "";
  }

  function momentMediaItems(post) {
    if (Array.isArray(post.media)) return post.media.filter((item) => item?.url);
    return post.media?.url ? [post.media] : [];
  }

  function render() {
    const container = document.querySelector("#moments-feed");
    if (!container) return;
    const copy = momentsCopy[getLanguage()] ?? momentsCopy.en;
    const posts = visibleConnectedPosts(feedPosts);
    container.innerHTML = posts.map((post) => {
      const metrics = workoutMetrics(post, copy);
      const mediaItems = momentMediaItems(post);
      return `<article class="moment-card" data-post-id="${post.id}">
        <header class="moment-author-row"><div class="moment-author"><button class="moment-avatar" data-action="open-feed-profile" data-post-id="${post.id}" aria-label="${escapeHtml(post.author.name)}">${escapeHtml(post.author.name.slice(0, 1))}</button><span><span class="moment-author-name"><button class="moment-author-profile" data-action="open-feed-profile" data-post-id="${post.id}"><strong>${escapeHtml(post.author.name)}</strong></button>${post.author.verified ? `<button class="verification-mark" data-action="open-verification" aria-label="${translate("selfieVerified")}"><span aria-hidden="true">✓</span></button>` : ""}</span><small>${formatMomentTime(post.created_at)} · ${escapeHtml(momentSportLabel(post))}</small></span></div></header>
        <p class="moment-caption">${escapeHtml(post.caption)}</p>
        ${mediaItems.length ? `<div class="moment-media-gallery" aria-label="${mediaItems.length} photos">${mediaItems.map((item) => `<img class="moment-media" src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt ?? copy.photoAlt)}" loading="lazy" decoding="async" />`).join("")}</div>` : ""}
        <div class="moment-workout"><span class="moment-sport">${escapeHtml(momentSportLabel(post))}</span>${metrics.map((metric) => `<span><strong>${escapeHtml(metric.value)}</strong><small>${escapeHtml(metric.label)}</small></span>`).join("")}</div>
        <footer class="moment-actions"><button class="moment-like${post.liked_by_me ? " active" : ""}" data-action="toggle-feed-like" data-post-id="${post.id}" aria-label="${post.liked_by_me ? copy.unlike : copy.like}" aria-pressed="${post.liked_by_me}"><span aria-hidden="true">♥</span><b>${post.reaction_count}</b></button><button data-action="open-feed-comments" data-post-id="${post.id}"><span aria-hidden="true">◯</span><b>${post.comments.length}</b><small>${copy.comments}</small></button></footer>
      </article>`;
    }).join("");
  }

  function openConnectionFeedProfile(postId) {
    const post = feedPosts.find((item) => item.id === postId);
    if (!post) return;
    if (post.is_my_post || post.author.connection_status === "self") return switchTab("me");
    openConversation({ ...post.author, id: post.author_id, sport: momentSportLabel(post) }, { section: "profile" });
  }

  function openMomentComments(postId, { focusComposer = false } = {}) {
    const post = feedPosts.find((item) => item.id === postId);
    if (!post) return;
    const copy = momentsCopy[getLanguage()] ?? momentsCopy.en;
    openModal(`
      <div class="moment-comments-sheet" aria-describedby="comments-dismiss-hint">
        <button class="comments-sheet-grabber" type="button" data-action="close-modal" aria-label="${copy.dismissComments}"><span aria-hidden="true"></span></button>
        <p id="comments-dismiss-hint" class="visually-hidden">${copy.dismissHint}</p>
        <header class="comments-sheet-header">
          <div><h2 id="modal-title">${copy.commentTitle}</h2><p>${escapeHtml(post.author.name)} · ${escapeHtml(momentSportLabel(post))}</p></div>
          <span class="comments-sheet-count" aria-label="${copy.comments} ${post.comments.length}">${String(post.comments.length).padStart(2, "0")}</span>
        </header>
        <div class="moment-comment-list">${post.comments.length ? post.comments.map((comment) => `<article class="moment-comment"><span class="moment-comment-avatar" aria-hidden="true">${escapeHtml(comment.author_name.slice(0, 1).toUpperCase())}</span><div class="moment-comment-copy"><strong>${escapeHtml(comment.author_name)}</strong><p>${escapeHtml(comment.text)}</p></div></article>`).join("") : `<p class="empty-comments">${copy.noComments}</p>`}</div>
        <form id="moment-comment-form" class="moment-comment-form" data-post-id="${post.id}"><span class="moment-comment-avatar moment-comment-avatar-self" aria-hidden="true">K</span><textarea name="comment" rows="1" maxlength="280" aria-label="${copy.placeholder}" placeholder="${copy.placeholder}"></textarea><button type="submit" aria-label="${copy.send}" disabled><span class="material-symbols-rounded" aria-hidden="true">arrow_upward</span></button></form>
      </div>
    `);
    const sheet = document.querySelector(".moment-comments-sheet");
    const modalSurface = sheet.closest(".modal");
    modalSurface.setAttribute("aria-describedby", "comments-dismiss-hint");
    const dragHandle = sheet.querySelector(".comments-sheet-grabber");
    let startY = 0;
    let startTime = 0;
    let dragDistance = 0;
    let dragging = false;
    let suppressClick = false;

    const resetSheetPosition = () => {
      modalSurface.classList.remove("is-dragging-comments");
      modalSurface.classList.add("is-settling-comments");
      modalSurface.style.removeProperty("transform");
      window.setTimeout(() => modalSurface.classList.remove("is-settling-comments"), 240);
    };

    const startDrag = (clientY) => {
      dragging = true;
      startY = clientY;
      startTime = performance.now();
      dragDistance = 0;
      suppressClick = false;
      modalSurface.classList.add("is-dragging-comments");
    };
    const moveDrag = (clientY) => {
      if (!dragging) return;
      dragDistance = Math.max(0, clientY - startY);
      suppressClick ||= dragDistance > 5;
      modalSurface.style.transform = `translateY(${dragDistance}px)`;
    };
    const finishDrag = () => {
      if (!dragging) return;
      const elapsed = Math.max(1, performance.now() - startTime);
      const velocity = dragDistance / elapsed;
      dragging = false;
      if (dragDistance >= 88 || (dragDistance >= 42 && velocity > 0.55)) {
        closeModal();
        return;
      }
      resetSheetPosition();
    };
    const cancelDrag = () => {
      dragging = false;
      resetSheetPosition();
    };
    const handleMouseMove = (event) => moveDrag(event.clientY);
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      finishDrag();
    };

    dragHandle.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      startDrag(event.clientY);
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp, { once: true });
    });
    dragHandle.addEventListener("touchstart", (event) => {
      event.preventDefault();
      startDrag(event.touches[0].clientY);
    }, { passive: false });
    dragHandle.addEventListener("touchmove", (event) => {
      event.preventDefault();
      moveDrag(event.touches[0].clientY);
    }, { passive: false });
    dragHandle.addEventListener("touchend", finishDrag);
    dragHandle.addEventListener("touchcancel", cancelDrag);
    dragHandle.addEventListener("click", (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    });
    const commentList = document.querySelector(".moment-comment-list");
    requestAnimationFrame(() => {
      commentList.scrollTop = commentList.scrollHeight;
      if (focusComposer) document.querySelector("#moment-comment-form textarea")?.focus();
    });
    const commentForm = document.querySelector("#moment-comment-form");
    const commentInput = commentForm.querySelector('textarea[name="comment"]');
    const commentSubmit = commentForm.querySelector('[type="submit"]');
    const syncCommentButton = () => { commentSubmit.disabled = !commentInput.value.trim(); };
    commentInput.addEventListener("input", syncCommentButton);
    commentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = new FormData(event.target).get("comment");
      if (!text.trim()) return;
      commentSubmit.disabled = true;
      try {
        const comment = await repository.addComment(post.id, text);
        feedPosts = addConnectionPostComment(feedPosts, post.id, comment);
        render();
        openMomentComments(post.id, { focusComposer: true });
      } catch {
        showToast(translate("requestFailed"));
        syncCommentButton();
      }
    });
  }

  function openMomentPublisher() {
    const copy = momentsCopy[getLanguage()] ?? momentsCopy.en;
    const mediaItems = [];
    openModal(`
      <div class="moment-publisher">
        <header><div><p class="eyebrow">${copy.composeEyebrow}</p><h2 id="modal-title">${copy.composeTitle}</h2></div><button class="close" data-action="close-modal" aria-label="${translate("close")}">×</button></header>
        <form id="moment-publisher-form">
          <textarea class="publisher-caption" name="caption" maxlength="500" required aria-label="${copy.caption}" placeholder="${copy.caption}" data-autofocus></textarea>
          <label class="publisher-sport-field"><span>${copy.sport}</span><input name="sport" type="text" maxlength="60" required autocomplete="off" placeholder="${copy.sportPlaceholder}"/></label>
          <label class="publisher-photo-picker"><input id="publisher-photo-input" type="file" accept="image/jpeg,image/png,image/webp" multiple/><span class="publisher-photo-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h4l1.5-2h5L16 7h4v12H4z"/><circle cx="12" cy="13" r="3"/></svg></span><span><strong>${copy.addPhoto}</strong><small>${copy.photoHint}</small></span></label>
          <div id="publisher-photo-previews" class="publisher-photo-previews hidden"></div>
          <details class="publisher-details"><summary>${copy.details}<span>＋</span></summary><div class="publisher-metrics"><div id="publisher-metric-list"><div class="publisher-metric-row"><label>${copy.metric}<input name="metric_label" type="text" maxlength="30" placeholder="${copy.metricPlaceholder}"/></label><label>${copy.result}<input name="metric_value" type="text" maxlength="30" placeholder="${copy.resultPlaceholder}"/></label></div></div><button id="add-publisher-metric" class="publisher-add-metric" type="button">＋ ${copy.addMetric}</button></div></details>
          <div class="publisher-footer"><button type="submit" disabled>${copy.publish}</button></div>
        </form>
      </div>
    `);
    const publisherForm = document.querySelector("#moment-publisher-form");
    const publisherSubmit = publisherForm.querySelector('[type="submit"]');
    const syncPublisherButton = () => {
      const form = new FormData(publisherForm);
      publisherSubmit.disabled = !String(form.get("caption") ?? "").trim() || !String(form.get("sport") ?? "").trim();
    };
    publisherForm.addEventListener("input", syncPublisherButton);
    const renderPublisherPhotos = () => {
      const previews = document.querySelector("#publisher-photo-previews");
      previews.classList.toggle("hidden", mediaItems.length === 0);
      previews.innerHTML = mediaItems.map((item) => `<figure><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.file.name)}"/><button type="button" data-remove-photo="${item.id}" aria-label="${copy.removePhoto}">×</button></figure>`).join("");
    };
    document.querySelector("#add-publisher-metric").addEventListener("click", () => {
      const list = document.querySelector("#publisher-metric-list");
      if (list.children.length >= 3) return;
      list.insertAdjacentHTML("beforeend", `<div class="publisher-metric-row"><label>${copy.metric}<input name="metric_label" type="text" maxlength="30" placeholder="${copy.metricPlaceholder}"/></label><label>${copy.result}<input name="metric_value" type="text" maxlength="30" placeholder="${copy.resultPlaceholder}"/></label></div>`);
      list.lastElementChild.querySelector("input").focus();
      if (list.children.length === 3) {
        const addMetric = document.querySelector("#add-publisher-metric");
        addMetric.disabled = true;
        addMetric.textContent = copy.metricLimit;
      }
    });
    document.querySelector("#publisher-photo-input").addEventListener("change", (event) => {
      const files = [...(event.target.files ?? [])];
      if (!files.length) return;
      const validFiles = files.filter((file) => file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024);
      if (validFiles.length !== files.length) showToast(copy.photoHint);
      validFiles.forEach((file) => mediaItems.push({ id: `photo_${Date.now()}_${crypto.randomUUID()}`, file, url: URL.createObjectURL(file) }));
      event.target.value = "";
      renderPublisherPhotos();
    });
    document.querySelector("#publisher-photo-previews").addEventListener("click", (event) => {
      const remove = event.target.closest("[data-remove-photo]");
      if (!remove) return;
      const index = mediaItems.findIndex((item) => item.id === remove.dataset.removePhoto);
      if (index < 0) return;
      URL.revokeObjectURL(mediaItems[index].url);
      mediaItems.splice(index, 1);
      renderPublisherPhotos();
    });
    publisherForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!event.target.checkValidity()) return event.target.reportValidity();
      const form = new FormData(event.target);
      const sportName = form.get("sport").trim();
      const normalizedSport = sportName.toLocaleLowerCase(getLanguage());
      const matchedSport = SPORTS.find((sport) => sport.id === normalizedSport || Object.values(sport.labels).some((label) => label.toLocaleLowerCase(getLanguage()) === normalizedSport));
      const metricLabels = form.getAll("metric_label");
      const metricValues = form.getAll("metric_value");
      const metrics = metricLabels.map((label, index) => ({ label: label.trim(), value: metricValues[index]?.trim() ?? "" })).filter((metric) => metric.label && metric.value);
      const workout = metrics.length ? { metrics } : {};
      const id = `post_kevin_${Date.now()}`;
      publisherSubmit.disabled = true;
      try {
        const publishedPost = await repository.publish({
          id,
          author_id: "user_kevin",
          author: { name: "Kevin", verified: true, connection_status: "self" },
          created_at: new Date().toISOString(),
          visibility: "connections",
          sport_id: matchedSport?.id ?? null,
          sport_name: sportName,
          caption: form.get("caption").trim(),
          media: mediaItems.length ? mediaItems.map((item) => ({ type: "image", url: item.url, alt: item.file.name })) : null,
          workout,
        });
        feedPosts = prependConnectionPost(feedPosts, publishedPost);
        closeModal();
        render();
        switchTab("moments");
        showToast(copy.published);
      } catch {
        showToast(translate("requestFailed"));
        syncPublisherButton();
      }
    });
  }

  async function toggleLike(postId) {
    const post = feedPosts.find((item) => item.id === postId);
    if (!post) return;
    try {
      const updatedPost = await repository.setPostLike(postId, !post.liked_by_me);
      feedPosts = feedPosts.map((item) => item.id === postId ? updatedPost : item);
      render();
    } catch {
      showToast(translate("requestFailed"));
    }
  }

  return Object.freeze({
    async start() {
      try {
        feedPosts = await repository.listFeed();
      } catch {
        feedPosts = [];
        showToast(translate("requestFailed"));
      }
      render();
    },
    openComments: openMomentComments,
    openProfile: openConnectionFeedProfile,
    openPublisher: openMomentPublisher,
    render,
    toggleLike,
  });
}
