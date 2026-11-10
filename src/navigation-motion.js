/** Clipped navigation labels, independently implemented with cancellable WAAPI. */
export function mountNavigationMotion(nav, { reduced = false } = {}) {
  const links = []; // Actions belong to the disclosure, not loader layout.
  const logo = nav.querySelector('.logo');
  const status = document.createElement('span');
  status.className = 'nav-status';
  status.hidden = true;
  status.setAttribute('role', 'status');
  const label = document.createElement('span');
  label.className = 'nav-status-label';
  const spinner = document.createElement('span');
  spinner.className = 'nav-spinner';
  spinner.setAttribute('aria-hidden', 'true');
  status.append(label, spinner);
  nav.append(status);
  const words = [
    'Projecting',
    'Developing',
    'Splicing',
    'Rewinding',
    'Spooling',
    'Threading',
    'Screening',
    'Printing',
  ];
  let word = 0,
    revision = 0,
    started = 0,
    timer = 0,
    animations = [],
    loading = false;
  function cancel() {
    clearTimeout(timer);
    animations.forEach((a) => a.cancel());
    animations = [];
  }
  async function move(elements, from, to, duration, stagger = 0) {
    if (reduced) return;
    await Promise.all(
      elements.map((el, i) => {
        const a = el.animate(
          [
            { transform: `translateY(${from}%)` },
            { transform: `translateY(${to}%)` },
          ],
          {
            duration,
            delay: i * stagger,
            easing: 'cubic-bezier(.32,.72,0,1)',
            fill: 'both',
          },
        );
        animations.push(a);
        return a.finished.catch(() => {});
      }),
    );
  }
  function swapLayout(change) {
    const before = nav.getBoundingClientRect(),
      logoBefore = logo.getBoundingClientRect();
    change();
    if (reduced) return;
    const after = nav.getBoundingClientRect();
    const mobile = matchMedia('(max-width:767px)').matches;
    const a = mobile
      ? nav.animate(
          [{ width: `${before.width}px` }, { width: `${after.width}px` }],
          { duration: 450, easing: 'cubic-bezier(.32,.72,0,1)' },
        )
      : logo.animate(
          [
            {
              transform: `translateX(${logoBefore.left - logo.getBoundingClientRect().left}px)`,
            },
            { transform: 'translateX(0)' },
          ],
          { duration: 450, easing: 'cubic-bezier(.32,.72,0,1)' },
        );
    animations.push(a);
  }
  function show({ initial = false } = {}) {
    const token = ++revision;
    cancel();
    started = performance.now();
    loading = true;
    nav.dataset.motion = 'loading';
    label.textContent = words[word++ % words.length];
    if (initial) {
      nav.inert = true;
      links.forEach((e) => e.classList.add('nav-suppressed'));
      status.hidden = false;
      nav.classList.add('nav-held');
      return;
    }
    nav.inert = false;
    nav.classList.remove('nav-held');
    const visible = links.filter(
      (e) => !e.hidden && !e.classList.contains('nav-suppressed'),
    );
    void (async () => {
      await move(visible, 0, -110, 400, 50);
      if (token !== revision) return;
      swapLayout(() => {
        visible.forEach((e) => e.classList.add('nav-suppressed'));
        status.hidden = false;
      });
      await move([status], 110, 0, 700);
      if (token !== revision) return;
      animations.forEach((a) => a.cancel());
      animations = [];
    })();
  }
  function revealLogo() {
    nav.inert = false;
    nav.classList.remove('nav-held');
    void move([logo, status], 110, 0, 700, 50);
  }
  function hide({ immediate = false } = {}) {
    if (!loading) return;
    const token = revision;
    clearTimeout(timer);
    timer = setTimeout(
      async () => {
        if (token !== revision) return;
        cancel();
        await move([status], 0, -110, 400);
        if (token !== revision) return;
        swapLayout(() => {
          status.hidden = true;
          links.forEach((e) => e.classList.remove('nav-suppressed'));
        });
        nav.inert = false;
        nav.classList.remove('nav-held');
        nav.dataset.motion = 'revealing';
        await move(
          links.filter((e) => !e.hidden),
          110,
          0,
          700,
          50,
        );
        if (token !== revision) return;
        cancel();
        loading = false;
        nav.dataset.motion = 'idle';
      },
      reduced || immediate
        ? 0
        : Math.max(600, 1600 - (performance.now() - started)),
    );
  }
  return {
    show,
    hide,
    revealLogo,
    destroy() {
      revision++;
      cancel();
      nav.inert = false;
      status.remove();
      links.forEach((e) => e.classList.remove('nav-suppressed'));
      nav.classList.remove('nav-held');
    },
  };
}
