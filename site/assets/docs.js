(() => {
  'use strict';
  const copy = document.getElementById('docs-copy');
  if (!copy) return;
  const messages = JSON.parse(copy.textContent);
  for (const button of document.querySelectorAll('[data-docs-copy]')) {
    const target = document.getElementById(button.dataset.docsCopy);
    const status = button.closest('.docs-example')?.querySelector('.docs-copy-status');
    if (!target || !status) continue;
    button.hidden = false;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { await navigator.clipboard.writeText(target.value); status.textContent = messages.copied; }
      catch { target.focus({ preventScroll: true }); target.select(); status.textContent = messages.manual; }
      finally { button.disabled = false; }
    });
  }
  document.querySelector('.language-switch')?.addEventListener('click', event => {
    const sections = [...document.querySelectorAll('.docs-section')];
    const active = sections.filter(section => section.getBoundingClientRect().top < innerHeight * .5).at(-1);
    const anchored = sections.find(section => '#' + section.id === location.hash);
    const url = new URL(event.currentTarget.href);
    url.hash = active?.id || anchored?.id || '';
    event.currentTarget.href = url.pathname + url.hash;
  });
})();
