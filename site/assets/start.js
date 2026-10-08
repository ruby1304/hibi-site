(() => {
  'use strict';
  const copyElement = document.querySelector('#start-copy');
  if (!copyElement) return;
  const messages = JSON.parse(copyElement.textContent);
  for (const button of document.querySelectorAll('[data-copy-target]')) {
    const target = document.getElementById(button.dataset.copyTarget);
    const status = button.closest('.copy-card').querySelector('.copy-status');
    if (!target) continue;
    button.hidden = false;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await navigator.clipboard.writeText(target.value);
        status.textContent = messages.copied;
      } catch {
        target.focus({ preventScroll: true });
        target.select();
        status.textContent = messages.manual;
      } finally {
        button.disabled = false;
      }
    });
  }
  document.querySelector('.language-switch')?.addEventListener('click', event => {
    const sections = [...document.querySelectorAll('.start-step, .start-recovery')];
    const active = sections.filter(section => section.getBoundingClientRect().top < innerHeight * .5).at(-1);
    const anchored = sections.find(section => '#' + section.id === location.hash);
    const link = event.currentTarget;
    const url = new URL(link.href);
    url.hash = active?.id || anchored?.id || '';
    link.href = url.pathname + url.hash;
  });
})();
