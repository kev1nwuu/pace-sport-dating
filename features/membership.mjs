import { escapeHtml as esc } from './dom.mjs?v=pace-release-audit-58';
import { SPORTS, getSportLabel } from '../sport_catalog.mjs?v=pace-release-audit-58';
import { membershipCopy } from './membership_copy.mjs?v=pace-release-audit-58';

const icon = (name) => `<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
const lineBreaks = (value) => esc(value).replace(/\n/g, '<br>');
const httpsUrl = (value) => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };

export function createMembershipFeature({ repository, bridge, getLanguage, modalElement, openModal, closeModal, showToast, likesRoot }) {
  const c = () => membershipCopy(getLanguage());
  let refreshId = 0;
  let checkoutBusy = false;
  let lastReason = null;
  let billingVisible = false;

  function header(title, eyebrow = 'PACE PLUS') {
    return `<header><div><p class="eyebrow">${esc(eyebrow)}</p><h2 id="modal-title">${lineBreaks(title)}</h2></div><button type="button" class="close" data-action="close-modal" aria-label="${c().close}">×</button></header>`;
  }
  function showShell(content) {
    billingVisible = false;
    openModal(`<div class="membership-sheet">${content}</div>`);
    return modalElement.querySelector('.membership-sheet');
  }
  function status(root, message, isError = false) {
    const node = root.querySelector('[data-membership-status]');
    if (node) { node.textContent = message; node.classList.toggle('is-error', isError); }
  }
  function statusNode() { return '<p class="membership-status" data-membership-status role="status" aria-live="polite"></p>'; }
  function benefits() {
    return `<ul class="plus-benefits">${[['visibility','likes'],['north_east','direct'],['groups','host']].map(([symbol,key]) => `<li>${icon(symbol)}<div><strong>${c()[key]}</strong><p>${c()[`${key}Desc`]}</p></div></li>`).join('')}</ul>`;
  }
  async function refresh() {
    const request = ++refreshId;
    if (!likesRoot) return;
    let membership;
    try { membership = await repository.getMembership(); } catch { /* Entry stays accessible for retry. */ }
    if (request !== refreshId) return;
    likesRoot.innerHTML = `<div class="plus-banner-top"><span class="plus-wordmark">PACE <b>PLUS</b></span>${icon('north_east')}</div>
      <p class="eyebrow">${c().interest}</p><h2>${lineBreaks(c().interestTitle)}</h2><p>${c().interestDesc}</p>
      <button type="button" class="plus-banner-cta" data-action="${membership?.entitlements?.seeLikes ? 'open-incoming-likes' : 'open-plus'}">${membership?.entitlements?.seeLikes ? c().see : c().view}${icon('arrow_forward')}</button>`;
  }
  function date(value) {
    return new Intl.DateTimeFormat(getLanguage(), { year:'numeric',month:'short',day:'numeric' }).format(new Date(value));
  }
  async function openPlus(reason = null) {
    lastReason = reason;
    const root = showShell(`${header(c().title)}${reason ? `<p class="plus-context">${reason === 'hostActivities' ? c().hostReason : c().inviteReason}</p>` : `<p class="plus-intro">${c().intro}</p>`}${benefits()}<p class="plus-free-note">${c().freeNote}</p><div data-checkout><p role="status">${c().loading}</p></div>${statusNode()}`);
    try {
      const membership = await repository.getMembership();
      if (!root.isConnected) return;
      if (membership.tier === 'plus') { await openBilling(); return; }
      const context = await repository.getBillingContext();
      const ids = (context.products ?? []).map(product => typeof product === 'string' ? product : product.id).filter(Boolean);
      const terms = httpsUrl(context.termsUrl);
      const privacy = httpsUrl(context.privacyUrl);
      const available = bridge.isAvailable();
      const products = available && ids.length ? await bridge.products(ids) : [];
      if (!root.isConnected) return;
      // A real subscription offer requires store-localized metadata, account binding and legal destinations.
      const canPurchase = available && products.length > 0 && context.appAccountToken && terms && privacy;
      root.querySelector('[data-checkout]').innerHTML = `${canPurchase ? `<fieldset class="plus-plans"><legend class="visually-hidden">PACE Plus</legend>${products.map((product,index) => `<label class="plus-plan"><input type="radio" name="plus-plan" value="${esc(product.id)}" ${index === 0 ? 'checked' : ''}><span><strong>${esc(product.displayName)}</strong><small>${esc(product.displayPrice)} / ${product.subscriptionPeriod.value} ${c().period[product.subscriptionPeriod.unit]}</small></span>${icon('check_circle')}</label>`).join('')}</fieldset>` : ''}
        <button type="button" class="membership-primary" data-purchase ${canPurchase ? '' : 'disabled'}>${canPurchase ? c().subscribe : c().unavailable}${icon('arrow_forward')}</button>
        <p class="plus-purchase-note">${canPurchase ? c().renewing : c().iosNote}</p>
        <div class="plus-links"><button type="button" data-restore ${available ? '' : 'disabled'}>${c().restore}</button>${terms ? `<a href="${esc(terms)}" target="_blank" rel="noopener">${c().terms}</a>` : ''}${privacy ? `<a href="${esc(privacy)}" target="_blank" rel="noopener">${c().privacy}</a>` : ''}</div>`;
      root.querySelector('[data-purchase]').addEventListener('click', () => purchase(root, context));
      root.querySelector('[data-restore]').addEventListener('click', () => restore(root, context));
    } catch {
      if (!root.isConnected) return;
      root.querySelector('[data-checkout]').innerHTML = `<button type="button" class="membership-secondary" data-retry>${c().retry}</button>`;
      status(root, c().error, true);
      root.querySelector('[data-retry]').addEventListener('click', () => openPlus(reason));
    }
  }
  async function transaction(root, action) {
    if (checkoutBusy) return;
    checkoutBusy = true;
    const buttons = [...root.querySelectorAll('button, input')].filter(node => !node.disabled && !node.matches('.close'));
    buttons.forEach(node => { node.disabled = true; });
    status(root, c().working);
    try { await action(); }
    catch { status(root, c().verifyFailed, true); }
    finally { checkoutBusy = false; buttons.forEach(node => { node.disabled = false; }); }
  }
  async function purchase(root, context) {
    const productId = root.querySelector('input[name="plus-plan"]:checked')?.value;
    if (!productId) return;
    await transaction(root, async () => {
      if ((await repository.getMembership()).tier === 'plus') {
        if (root.isConnected) await openBilling();
        return;
      }
      const result = await bridge.purchase(productId, { appAccountToken: context.appAccountToken });
      if (result.status !== 'success') { status(root, c()[result.status === 'pending' ? 'pending' : 'cancelled']); return; }
      await repository.syncAppleTransaction({signedTransaction:result.signedTransaction,appAccountToken:context.appAccountToken});
      const membership = await repository.getMembership();
      await refresh();
      if (membership.tier !== 'plus') { status(root, c().verifyFailed, true); return; }
      showToast(c().verified);
      if (root.isConnected) await openBilling();
    });
  }
  async function restore(root, context) {
    await transaction(root, async () => {
      const result = await bridge.restore();
      for (const signedTransaction of result.transactions) {
        await repository.syncAppleTransaction({signedTransaction,appAccountToken:context.appAccountToken});
      }
      const membership = await repository.getMembership();
      await refresh();
      status(root, membership.tier === 'plus' ? c().restored : c().noPurchases);
      if (membership.tier === 'plus' && root.isConnected) { showToast(c().restored); await openBilling(); }
    });
  }
  async function openBilling() {
    const root = showShell(`${header(c().billing)}<div data-billing><p role="status">${c().loading}</p></div>${statusNode()}`);
    billingVisible = true;
    try {
      const [membership,context] = await Promise.all([repository.getMembership(),repository.getBillingContext()]);
      if (!root.isConnected) return;
      const paid = membership.tier === 'plus';
      const label = paid ? c().active : membership.status === 'expired' ? c().expired : membership.status === 'revoked' ? c().revoked : c().free;
      root.querySelector('[data-billing]').innerHTML = `<section class="member-pass"><span class="plus-wordmark">PACE <b>${paid ? 'PLUS' : 'FREE'}</b></span>${icon(paid ? 'verified' : 'bolt')}<h3>${label}</h3>${membership.expiresAt ? `<p>${membership.autoRenews ? c().next : c().until}<strong>${date(membership.expiresAt)}</strong></p>` : ''}</section>
        ${membership.status === 'grace_period' ? `<p>${c().grace}</p>` : ''}
        ${paid ? benefits() : `<p>${c().freeNote}</p><button type="button" class="membership-primary" data-upgrade>${c().view}${icon('arrow_forward')}</button>`}
        <div class="member-controls"><button type="button" class="membership-secondary" data-manage ${bridge.isAvailable() ? '' : 'disabled'}>${c().manage}${icon('open_in_new')}</button><button type="button" class="membership-secondary" data-restore ${bridge.isAvailable() ? '' : 'disabled'}>${c().restore}</button><button type="button" class="member-text-button" data-refresh>${c().refresh}</button></div>`;
      root.querySelector('[data-upgrade]')?.addEventListener('click', () => openPlus(lastReason));
      root.querySelector('[data-manage]').addEventListener('click', async () => {
        try { await bridge.manageSubscriptions(); if (root.isConnected) await openBilling(); await refresh(); }
        catch { status(root, c().error, true); }
      });
      root.querySelector('[data-restore]').addEventListener('click', () => restore(root, context));
      root.querySelector('[data-refresh]').addEventListener('click', () => { void refresh(); void openBilling(); });
    } catch {
      if (!root.isConnected) return;
      status(root, c().error, true);
      root.querySelector('[data-billing]').innerHTML = `<button type="button" class="membership-secondary" data-retry>${c().retry}</button>`;
      root.querySelector('[data-retry]').addEventListener('click', openBilling);
    }
  }
  async function openDirectInvite(person) {
    const root = showShell(`${header(c().inviteTitle)}<p role="status">${c().loading}</p>`);
    try {
      const access = await repository.getDirectInviteAccess(person.id);
      if (!root.isConnected) return;
      if (!access.allowed) { await openPlus('directInvites'); return; }
      renderInvite(person);
    } catch { if (root.isConnected) { root.innerHTML = `${header(c().inviteTitle)}<p role="status">${c().error}</p><button type="button" class="membership-secondary" data-retry>${c().retry}</button>`; root.querySelector('[data-retry]').onclick = () => openDirectInvite(person); } }
  }
  function renderInvite(person) {
    const root = showShell(`${header(c().inviteTitle, 'PACE / TOGETHER')}<p>${c().inviteIntro} <strong>${esc(person.name)}</strong>.</p><p class="plus-free-note">${c().recipientNote}</p>
      <form id="direct-invite-form"><label>${c().sport}<select name="sportId" required>${SPORTS.map(sport => `<option value="${esc(sport.id)}">${esc(getSportLabel(sport.id,getLanguage()))}</option>`).join('')}</select></label>
      <label>${c().when}<input type="datetime-local" name="startsAt" required></label><label>${c().location}<input name="location" maxlength="160" required placeholder="${c().locationHint}"></label>
      <label>${c().note}<textarea name="note" maxlength="300" placeholder="${c().noteHint}"></textarea></label>${statusNode()}<button class="membership-primary" type="submit">${c().send}${icon('north_east')}</button></form>`);
    let busy = false;
    let submissionKey = crypto.randomUUID();
    let lastPayload = null;
    root.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      const data = new FormData(event.currentTarget);
      const starts = new Date(String(data.get('startsAt')));
      if (!Number.isFinite(starts.getTime()) || starts.getTime() <= Date.now()) { status(root,c().invalidTime,true); return; }
      const input = {recipientId:person.id,sportId:data.get('sportId'),startsAt:starts.toISOString(),location:data.get('location'),note:data.get('note')};
      if (lastPayload && lastPayload !== JSON.stringify(input)) submissionKey = crypto.randomUUID();
      lastPayload = JSON.stringify(input);
      busy = true;
      const button = root.querySelector('button[type="submit"]');
      button.disabled = true;
      status(root,c().working);
      try {
        await repository.sendDirectInvite(input,{idempotencyKey:submissionKey});
        if (root.isConnected) showShell(`${header(c().sent, 'PACE / TOGETHER')}<div class="invite-confirmation">${icon('north_east')}<p>${c().sentNote}</p></div><button type="button" class="membership-primary" data-action="close-modal">${c().done}${icon('check')}</button>`);
      } catch (error) {
        if (!root.isConnected) return;
        if (error.code === 'PLUS_REQUIRED') { await openPlus('directInvites'); return; }
        status(root,error.code === 'ALREADY_INVITED' ? c().duplicate : ['RECIPIENT_UNAVAILABLE','BLOCKED'].includes(error.code) ? c().blocked : c().error,true);
      } finally { busy=false; button.disabled=false; }
    });
  }
  async function openIncomingLikes() {
    const root = showShell(`${header(c().likes)}<div data-incoming-likes><p role="status">${c().loading}</p></div>${statusNode()}`);
    try {
      const likes = await repository.listIncomingLikes();
      if (!root.isConnected) return;
      root.querySelector('[data-incoming-likes]').innerHTML = likes.length ? `<ul class="incoming-likes">${likes.map(person => `<li><article class="incoming-profile">${httpsUrl(person.photoUrl) || person.photoUrl?.startsWith('/assets/') || person.photoUrl?.startsWith('assets/') ? `<img src="${esc(person.photoUrl)}" alt="${esc(person.name)}" loading="lazy">` : ''}<h3>${esc(person.name)}${person.age ? ` <span class="incoming-age">${esc(person.age)}</span>` : ''}</h3>${person.verified ? icon('verified') : ''}<p>${esc(person.bio ?? '')}</p><div>${(person.sportIds ?? []).map(id => `<span>${esc(getSportLabel(id,getLanguage()))}</span>`).join('')}</div>${person.distanceKm != null ? `<p>${esc(person.distanceKm)} km</p>` : ''}<button type="button" class="membership-secondary" data-invite-person="${esc(person.id)}">${c().inviteTitle}${icon('north_east')}</button></article></li>`).join('')}</ul>` : `<div class="likes-empty">${icon('favorite')}<h3>${c().noLikes}</h3><p>${c().noLikesDesc}</p></div>`;
      root.querySelectorAll('[data-invite-person]').forEach(button => button.addEventListener('click', () => {
        const person = likes.find(item => item.id === button.dataset.invitePerson);
        if (person) void openDirectInvite(person);
      }));
    } catch(error) {
      if (!root.isConnected) return;
      if (error.code === 'PLUS_REQUIRED') { await openPlus(); return; }
      root.querySelector('[data-incoming-likes]').innerHTML = `<button type="button" class="membership-secondary" data-retry>${c().retry}</button>`;
      status(root,c().error,true);
      root.querySelector('[data-retry]').onclick = openIncomingLikes;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    void refresh();
    if (billingVisible && modalElement.querySelector('[data-billing]') && !checkoutBusy) void openBilling();
  });
  return Object.freeze({refresh,openPlus,openBilling,openDirectInvite,openIncomingLikes});
}
