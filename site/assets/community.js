(() => {
  'use strict';
  const copyElement = document.querySelector('#community-copy');
  const form = document.querySelector('#feedback-form');
  if (!copyElement || !form) return;
  // GitHub's direct preview is read-only; private feedback stays on our domain.
  if (location.hostname === 'ruby1304.github.io') {
    const english = document.documentElement.lang === 'en';
    const home = `https://rizi.d-ruby.com/${english ? 'en/' : ''}`;
    const link = document.createElement('a');
    link.className = 'button primary';
    link.href = `${home}#feedback-form`;
    link.textContent = english ? 'Send feedback on the official website' : '去官网留下反馈或申请试用';
    form.replaceWith(link);
    document.querySelectorAll('[data-request-trial]').forEach(item => { item.href = `${home}#feedback-form`; });
    const state = document.querySelector('[data-wish-state]');
    state.querySelector('[data-wish-state-title]').textContent = english ? 'The wish pool lives on our website' : '在官网查看功能心愿池';
    const wishes = document.createElement('a');
    wishes.href = `${home}#wishes`;
    wishes.textContent = english ? 'Open the wish pool →' : '打开功能心愿池 →';
    state.querySelector('[data-wish-state-body]').replaceChildren(wishes);
    return;
  }
  const copy = JSON.parse(copyElement.textContent);
  const fields = form.querySelector('[data-feedback-fields]');
  const submit = form.querySelector('[data-feedback-submit]');
  const status = form.querySelector('[data-feedback-status]');
  const receipt = document.querySelector('[data-feedback-receipt]');
  const names = ['kind', 'title', 'body', 'nickname', 'contact', 'visibility', 'version', 'platform', 'website'];
  const storageKey = 'rizi.site.feedback.v1';
  let pending = null;
  let sending = false;
  let lastReceipt = null;
  let timer;
  let storageAvailable = true;
  const input = name => form.elements.namedItem(name);
  const readFields = () => Object.fromEntries(names.map(name => [name, String(input(name).value).trim()]));

  function setMessage(message, error = false) {
    status.textContent = message;
    status.classList.toggle('is-error', error);
  }
  function persist() {
    try {
      // Once received, keep only the receipt, never the submitted body or email.
      if (lastReceipt) sessionStorage.removeItem(storageKey);
      sessionStorage.setItem(storageKey, JSON.stringify(lastReceipt ? { receipt: lastReceipt } : { draft: readFields(), pending }));
    } catch {
      storageAvailable = false;
      document.querySelector('#draft-note').textContent = copy.noStorage;
    }
  }
  function restoreFields(values) {
    if (!values || typeof values !== 'object') return;
    for (const name of names) {
      if (typeof values[name] === 'string') input(name).value = values[name];
    }
    if (!Object.hasOwn(copy.kinds, input('kind').value)) input('kind').value = 'wish';
    if (!['private', 'public'].includes(input('visibility').value)) input('visibility').value = 'private';
  }
  function updateKind() {
    const trial = input('kind').value === 'trial';
    input('contact').required = trial;
    form.querySelector('[data-contact-optional]').hidden = trial;
    form.querySelector('[data-trial-note]').hidden = !trial;
    form.querySelector('#contact-help').textContent = trial ? copy.contactTrial : copy.contactHelp;
    const publicOption = form.querySelector('[name="visibility"][value="public"]');
    publicOption.disabled = trial;
    publicOption.closest('label').classList.toggle('is-disabled', trial);
    if (trial) input('visibility').value = 'private';
    input('body').placeholder = trial ? copy.trialBodyPlaceholder : copy.bodyPlaceholder;
    form.querySelector('#body-count').textContent = `${input('body').value.length} / 3000 ${copy.bodyCount}`;
  }
  function updateButton() {
    const seconds = pending?.retryAt ? Math.max(0, Math.ceil((pending.retryAt - Date.now()) / 1000)) : 0;
    submit.disabled = sending || seconds > 0;
    submit.textContent = sending ? copy.submitting : seconds > 0 ? copy.retryIn.replace('{seconds}', String(seconds)) : pending ? copy.retry : input('kind').value === 'trial' ? copy.trialSubmit : copy.submit;
    fields.disabled = sending || Boolean(pending);
    form.setAttribute('aria-busy', String(sending));
    clearTimeout(timer);
    if (seconds > 0) timer = setTimeout(updateButton, 1000);
  }
  function showReceipt(value, focus = false) {
    lastReceipt = value;
    form.hidden = true;
    receipt.hidden = false;
    receipt.querySelector('[data-receipt-title]').textContent = value.kind === 'trial' ? copy.trialReceivedTitle : copy.receivedTitle;
    receipt.querySelector('[data-receipt-message]').textContent = value.kind === 'trial' ? copy.trialReceived : value.visibility === 'public' ? copy.publicReceived : copy.privateReceived;
    receipt.querySelector('[data-receipt-id]').textContent = value.id;
    if (focus) receipt.focus();
  }
  function freshDraft(focus = true) {
    lastReceipt = null;
    pending = null;
    receipt.hidden = true;
    form.hidden = false;
    form.reset();
    setMessage('');
    updateKind();
    updateButton();
    persist();
    if (focus) input('kind').focus();
  }
  function onEdit() {
    if (pending || sending) return;
    for (const name of names) {
      const element = input(name);
      if (typeof element.setCustomValidity === 'function') element.setCustomValidity('');
    }
    setMessage('');
    updateKind();
    updateButton();
    persist();
  }
  form.addEventListener('input', onEdit);
  form.addEventListener('change', onEdit);
  document.querySelector('[data-feedback-new]').addEventListener('click', () => freshDraft());

  async function send(event) {
    event.preventDefault();
    if (sending || (pending?.retryAt && pending.retryAt > Date.now())) return;
    if (!pending) {
      updateKind();
      if (!form.reportValidity()) return;
      const draft = readFields();
      if (draft.title.length < 1 || draft.body.length < 10) {
        const field = draft.title.length < 1 ? input('title') : input('body');
        field.setCustomValidity(copy.invalid);
        field.reportValidity();
        return;
      }
      pending = { payload: { submissionId: crypto.randomUUID(), ...draft, locale: document.documentElement.lang === 'en' ? 'en' : 'zh-CN' }, retryAt: 0 };
      persist();
    }
    sending = true;
    updateButton();
    setMessage(copy.submitting);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/site/v1/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', cache: 'no-store', body: JSON.stringify(pending.payload), signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if ((response.status === 200 || response.status === 201) && result?.status === 'received' && typeof result.id === 'string' && result.id.length > 0 && result.id.length <= 100 && result.visibility === pending.payload.visibility) {
        const confirmed = { id: result.id, kind: pending.payload.kind, visibility: result.visibility, createdAt: result.createdAt };
        pending = null;
        form.reset();
        showReceipt(confirmed, true);
        persist();
      } else if (response.status === 400 || response.status === 413 || response.status === 422) {
        // An explicit validation rejection allows correction. Unknown outcomes stay locked to the original payload.
        if (result?.error === 'validation_error') {
          pending = null;
          fields.disabled = false;
          const labels = { kind: copy.kind, title: copy.titleLabel, body: copy.bodyLabel, nickname: copy.nickname, contact: copy.contact, visibility: copy.visibility, version: copy.version, platform: copy.platform };
          setMessage(response.status === 413 ? copy.tooLong : labels[result.field] ? copy.invalidField.replace('{field}', labels[result.field]) : copy.invalid, true);
          const rejected = input(result.field);
          if (rejected && typeof rejected.focus === 'function') rejected.focus();
          persist();
        } else setMessage(copy.networkError, true);
      } else if (response.status === 429 || result?.error === 'rate_limited') {
        const seconds = Math.min(3600, Math.max(1, Number(result?.retryAfter) || 30));
        pending.retryAt = Date.now() + seconds * 1000;
        setMessage(copy.rateError, true);
        persist();
      } else if (response.status === 409 || result?.error === 'conflict') {
        setMessage(copy.conflict, true);
      } else if (result?.error === 'unavailable' || response.status >= 500) {
        setMessage(copy.unavailable, true);
      } else setMessage(copy.networkError, true);
    } catch {
      setMessage(copy.networkError, true);
    } finally {
      clearTimeout(timeout);
      sending = false;
      updateButton();
      persist();
    }
  }
  form.addEventListener('submit', send);

  document.querySelectorAll('[data-request-trial]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    if (pending || sending) {
      setMessage(copy.pendingTrial, true);
    } else {
      if (lastReceipt) freshDraft(false);
      input('kind').value = 'trial';
      if (!input('title').value.trim()) input('title').value = copy.trialTitle;
      updateKind();
      updateButton();
      persist();
    }
    form.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    if (!pending && !sending) input('body').focus({ preventScroll: true });
    else submit.focus({ preventScroll: true });
  }));

  const list = document.querySelector('[data-wish-list]');
  const listState = document.querySelector('[data-wish-state]');
  const reload = document.querySelector('[data-wish-reload]');
  let loading = false;
  function addText(parent, tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    parent.append(element);
    return element;
  }
  function renderWish(item) {
    const article = document.createElement('article');
    article.className = 'wish-entry';
    const meta = document.createElement('div'); meta.className = 'wish-entry-meta'; article.append(meta);
    addText(meta, 'span', 'wish-kind', copy.kinds[item.kind]);
    addText(meta, 'span', 'wish-progress', Object.hasOwn(copy.statuses, item.status) ? copy.statuses[item.status] : copy.published);
    addText(article, 'h4', 'wish-title', item.title);
    addText(article, 'p', 'wish-body', item.body);
    const foot = document.createElement('div'); foot.className = 'wish-entry-footer'; article.append(foot);
    addText(foot, 'span', 'wish-author', typeof item.nickname === 'string' && item.nickname.trim() ? item.nickname : copy.anonymous);
    const date = new Date(item.createdAt);
    if (!Number.isNaN(date.getTime())) {
      const time = addText(foot, 'time', 'wish-date', new Intl.DateTimeFormat(document.documentElement.lang, { dateStyle: 'medium' }).format(date));
      time.dateTime = date.toISOString();
    }
    return article;
  }
  async function loadWishes() {
    if (loading) return;
    loading = true;
    reload.disabled = true;
    reload.hidden = true;
    listState.hidden = false;
    listState.querySelector('[data-wish-state-title]').textContent = copy.loading;
    listState.querySelector('[data-wish-state-body]').textContent = '';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/api/site/v1/wishes', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.items)) throw new Error('Unavailable');
      const items = data.items.filter(item => item && ['wish', 'experience', 'bug'].includes(item.kind) && typeof item.title === 'string' && typeof item.body === 'string' && typeof item.id === 'string').slice(0, 50);
      list.replaceChildren(...items.map(renderWish));
      document.querySelector('[data-wish-count]').textContent = `${items.length} ${copy.count}`;
      listState.hidden = items.length > 0;
      if (!items.length) {
        listState.querySelector('[data-wish-state-title]').textContent = copy.emptyTitle;
        listState.querySelector('[data-wish-state-body]').textContent = copy.emptyBody;
      }
    } catch {
      listState.querySelector('[data-wish-state-title]').textContent = copy.listError;
      reload.hidden = false;
    } finally {
      clearTimeout(timeout);
      loading = false;
      reload.disabled = false;
    }
  }
  reload.addEventListener('click', loadWishes);

  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (stored?.receipt && typeof stored.receipt.id === 'string' && ['private', 'public'].includes(stored.receipt.visibility)) {
      showReceipt(stored.receipt);
    } else {
      restoreFields(stored?.draft);
      if (stored?.pending?.payload && typeof stored.pending.payload.submissionId === 'string' && Object.hasOwn(copy.kinds, stored.pending.payload.kind)) {
        pending = stored.pending;
        restoreFields(pending.payload);
        setMessage(copy.pendingDraft);
      } else if (stored?.draft?.body || stored?.draft?.title) setMessage(copy.savedDraft);
    }
  } catch {
    storageAvailable = false;
  }
  updateKind();
  updateButton();
  document.documentElement.classList.add('community-ready');
  if (!storageAvailable) document.querySelector('#draft-note').textContent = copy.noStorage;
  loadWishes();
})();
