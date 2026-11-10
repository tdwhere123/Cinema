/** Height-led index expansion, with interruption-safe close and focus semantics. */
export function mountIndexMotion(
  panel,
  backdrop,
  button,
  { reduced = false } = {},
) {
  let revision = 0,
    animation = null;
  function set(open, { immediate = false } = {}) {
    const token = ++revision,
      current = panel.hidden ? 0 : panel.getBoundingClientRect().height;
    animation?.cancel();
    animation = null;
    button.setAttribute('aria-expanded', String(open));
    document.documentElement.dataset.indexOpen = String(open);
    panel.inert = !open;
    backdrop.hidden = !open;
    if (reduced || immediate) {
      panel.hidden = !open;
      panel.style.height = '';
      panel.style.opacity = '';
      if (open) panel.querySelector('.active')?.focus({ preventScroll: true });
      return;
    }
    panel.hidden = false;
    panel.style.height = 'auto';
    const target = open ? panel.getBoundingClientRect().height : 0;
    panel.style.height = `${target}px`;
    animation = panel.animate(
      [
        { height: `${current}px`, opacity: open ? 0 : 1 },
        { height: `${target}px`, opacity: open ? 1 : 0 },
      ],
      {
        duration: open ? 620 : 400,
        easing: 'cubic-bezier(.32,.72,0,1)',
        fill: 'both',
      },
    );
    if (open) panel.querySelector('.active')?.focus({ preventScroll: true });
    animation.finished
      .then(() => {
        if (token !== revision) return;
        animation.cancel();
        animation = null;
        panel.hidden = !open;
        panel.style.height = '';
        panel.style.opacity = '';
      })
      .catch(() => {});
  }
  return {
    set,
    destroy() {
      revision++;
      animation?.cancel();
      animation = null;
      panel.hidden = true;
      panel.inert = true;
      backdrop.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      document.documentElement.dataset.indexOpen = 'false';
    },
  };
}
