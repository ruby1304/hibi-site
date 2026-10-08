(() => {
  'use strict';
  const copyElement = document.querySelector('#demo-copy');
  if (!copyElement) return;
  const copy = JSON.parse(copyElement.textContent);
  const tabs = [...document.querySelectorAll('[data-step]')];
  const panels = [...document.querySelectorAll('.demo-panel')];
  const live = document.querySelector('#demo-live');
  let memory = 0;
  let version = 1;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const say = message => { live.textContent = message; };
  panels.forEach((panel, index) => {
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabs[index].id);
  });

  function setStep(step, moveFocus = false) {
    tabs.forEach((tab, index) => {
      tab.setAttribute('aria-selected', String(index === step));
      tab.tabIndex = index === step ? 0 : -1;
    });
    panels.forEach((panel, index) => { panel.hidden = index !== step; });
    if (moveFocus) {
      panels[step].querySelector('h3').focus({ preventScroll: true });
      document.querySelector('.demo-shell').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    }
    say(copy.status.step + copy.steps[step]);
  }

  function renderResult() {
    document.querySelector('[data-memory-summary]').textContent = copy.memory[memory];
    document.querySelector('[data-result-conclusion]').textContent = memory === 0 ? copy.result.conclusion : copy.result.exploration;
    document.querySelector('[data-result-question]').textContent = copy.result[version === 1 ? 'questionV1' : 'questionV2'];
    document.querySelector('[data-result-action]').textContent = copy.result[version === 1 ? 'actionV1' : 'actionV2'];
    document.querySelector('[data-result-version]').textContent = `v${version}`;
    document.querySelector('[data-result-status]').textContent = version === 1 ? copy.result.oldStatus : copy.result.newStatus;
    document.querySelectorAll('[data-version]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.version) === version)));
    document.querySelector('[data-revise]').hidden = version === 2;
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setStep(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      setStep(next);
      tabs[next].focus();
    });
  });
  document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => setStep(Number(button.dataset.next), true)));
  document.querySelectorAll('[name="demo-memory"]').forEach(input => input.addEventListener('change', () => {
    memory = Number(input.value);
    renderResult();
    say(copy.status.selected + copy.memory[memory]);
  }));
  function selectVersion(next) {
    version = next;
    renderResult();
    say(copy.status[version === 1 ? 'v1' : 'v2']);
  }
  document.querySelectorAll('[data-version]').forEach(button => button.addEventListener('click', () => selectVersion(Number(button.dataset.version))));
  document.querySelector('[data-revise]').addEventListener('click', () => {
    selectVersion(2);
    document.querySelector('[data-version="2"]').focus({ preventScroll: true });
  });
  document.querySelector('[data-reset]').addEventListener('click', () => {
    memory = 0;
    version = 1;
    document.querySelector('[name="demo-memory"][value="0"]').checked = true;
    renderResult();
    setStep(0, true);
    say(copy.status.reset);
  });

  // Preserve the visible section when moving between the independently rendered pages.
  document.querySelectorAll('.language-switch').forEach(link => link.addEventListener('click', () => {
    const anchors = [...document.querySelectorAll('main > section[id]')];
    const active = anchors.filter(section => section.getBoundingClientRect().top < window.innerHeight * 0.5).at(-1);
    const url = new URL(link.href);
    if (active) url.hash = active.id;
    else url.hash = '';
    link.href = url.pathname + url.hash;
  }));
  document.documentElement.classList.add('js');
  setStep(0);
  live.textContent = '';
})();
