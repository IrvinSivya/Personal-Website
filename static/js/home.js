/* Irvin Sivya — home page: opens the four popups and keeps the URL hash in step.
   Progressive enhancement: without this every door is a #link to its popup's id. */
(() => {
  const d = document;
  const pops = [...d.querySelectorAll('dialog.dlg')];
  if (!pops.length || !('showModal' in HTMLDialogElement.prototype)) return;

  // Old section links (the previous design and its redirects) land on the nearest popup.
  const ALIAS = {
    robots: 'robotics', projects: 'hackathons', academics: 'awards', accomplishments: 'awards',
    experience: 'libecode', about: 'top', skills: 'top', beyond: 'top',
  };
  const byId = (id) => pops.find((p) => p.id === id);
  let opener = null;

  const closeAll = () => pops.forEach((p) => p.open && p.close());
  const open = (id, pushHash = true) => {
    const pop = byId(id);
    if (!pop) return false;
    pops.forEach((p) => p !== pop && p.open && p.close());
    if (!pop.open) pop.showModal();
    pop.scrollTop = 0;
    if (pushHash && location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    return true;
  };

  d.addEventListener('click', (e) => {
    const link = e.target.closest('[data-open]');
    if (link) {
      e.preventDefault();
      // Only a keyboard open hands focus back afterwards; a mouse click should leave no focus ring.
      if (!link.closest('dialog')) opener = e.detail === 0 ? link : null;
      open(link.dataset.open);
      return;
    }
    if (e.target.closest('[data-close]')) { closeAll(); return; }
    // A click on the dimmed area around a popup closes it.
    if (e.target instanceof HTMLDialogElement && e.target.open) {
      const r = e.target.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) e.target.close();
    }
  });

  pops.forEach((p) => p.addEventListener('close', () => {
    if (pops.some((q) => q.open)) return;              // switching tabs, not leaving
    if (pops.some((q) => '#' + q.id === location.hash)) history.replaceState(null, '', location.pathname + location.search);
    if (opener) { opener.focus({ preventScroll: true }); opener = null; }
    else if (d.activeElement && d.activeElement !== d.body) d.activeElement.blur();
  }));

  const fromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = ALIAS[id] || id;
    if (!byId(target)) { closeAll(); return; }
    open(target, false);
  };
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
