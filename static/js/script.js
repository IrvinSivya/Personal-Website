/* Irvin Sivya — portfolio interactions: the graph's wires, its popups, and the resume form.
   Everything here is progressive enhancement: without it every node is a #link to its popup. */
(() => {
  const d = document;
  const graph = d.getElementById('graph');
  const svg = d.getElementById('wires');
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------- Wires ----------
     Each edge goes from one node to another. `chain` groups the edges that light up together
     when you hover a node: hovering "robots" lights root → 2,000+ → robots. */
  const EDGES = [
    { from: 'root', to: 'experience', out: 'l', in: 'r', chain: 'experience' },
    { from: 'root', to: 'libecode', out: 'l', in: 'r', chain: 'libecode' },
    { from: 'root', to: 'skills', out: 'r', in: 'l', chain: 'skills' },
    { from: 'root', to: 'beyond', out: 'r', in: 'l', chain: 'beyond' },
    { from: 'root', to: 's-robots', out: 'b', in: 't', chain: 'robots' },
    { from: 'root', to: 's-projects', out: 'b', in: 't', chain: 'projects' },
    { from: 'root', to: 's-academics', out: 'b', in: 't', chain: 'academics' },
    { from: 'root', to: 's-awards', out: 'b', in: 't', chain: 'awards' },
    { from: 's-robots', to: 'robots', out: 'b', in: 'r', chain: 'robots' },
    { from: 's-projects', to: 'projects', out: 'b', in: 't', chain: 'projects' },
    { from: 's-academics', to: 'academics', out: 'r', in: 'l', chain: 'academics' },
    { from: 's-awards', to: 'awards', out: 'b', in: 't', chain: 'awards' },
  ];

  const nodeEl = (id) => graph && graph.querySelector(`[data-id="${id}"]`);
  let scale = 1;                                   // set by fit(); boxes are measured unscaled
  const box = (el) => {
    const r = el.getBoundingClientRect(), g = graph.getBoundingClientRect();
    const b = { l: (r.left - g.left) / scale, t: (r.top - g.top) / scale, r: (r.right - g.left) / scale, b: (r.bottom - g.top) / scale };
    b.cx = (b.l + b.r) / 2;
    return b;
  };
  const el = (name, attrs, parent) => {
    const n = d.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (parent) parent.appendChild(n);
    return n;
  };
  /* Arrows: a dotted curve ending in a ">". It leaves its source square to that card's edge and
     enters the centre of the target's edge head-on, so every arrow lines up with what it joins. */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // A card's real geometry on the board: its centre, unrotated size and tilt. Arrow ends are
  // computed on the tilted card itself, so they land exactly on an edge, not on its bounding box.
  const geom = (n) => {
    const m = /matrix\(([^,]+),\s*([^,]+)/.exec(getComputedStyle(n).transform || '');
    return { cx: n.offsetLeft + n.offsetWidth / 2, cy: n.offsetTop + n.offsetHeight / 2,
      w: n.offsetWidth, h: n.offsetHeight, ang: m ? Math.atan2(+m[2], +m[1]) : 0 };
  };
  const turn = (gm, x, y) => [gm.cx + x * Math.cos(gm.ang) - y * Math.sin(gm.ang), gm.cy + x * Math.sin(gm.ang) + y * Math.cos(gm.ang)];
  // A point just outside `side` of a card, `along` px from that edge's centre, plus the
  // outward direction there.
  const GAP = 5;
  const port = (gm, side, along) => {
    const local = { t: [along, -gm.h / 2 - GAP, 0, -1], b: [along, gm.h / 2 + GAP, 0, 1],
      l: [-gm.w / 2 - GAP, along, -1, 0], r: [gm.w / 2 + GAP, along, 1, 0] }[side];
    const p = turn(gm, local[0], local[1]), o = turn(gm, local[0] + local[2], local[1] + local[3]);
    return [p, [o[0] - p[0], o[1] - p[1]]];
  };
  const BITS = '0110100101110010011101100110100101101110';
  let uid = 0;
  let hotChain = null;                              // the hovered card's chain survives a redraw

  const draw = () => {
    if (!graph || !svg) return;
    svg.replaceChildren();
    if (getComputedStyle(svg).display === 'none') return;
    EDGES.forEach((e, i) => {
      const fromEl = nodeEl(e.from), toEl = nodeEl(e.to);
      if (!fromEl || !toEl) return;
      const A = geom(fromEl), B = geom(toEl);
      // The arrow arrives at the centre of the target's edge, and leaves the source from the point
      // of its edge facing the target, so short arrows run straight and square to both cards.
      const vertical = e.out === 't' || e.out === 'b';
      const half = (vertical ? A.w : A.h) / 2 - 24;
      const along = clamp(vertical ? B.cx - A.cx : B.cy - A.cy, -half, half);
      const [p1, n1] = port(A, e.out, along), [p2, n2] = port(B, e.in, 0);
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1, k = Math.min(70, len * 0.42);
      const c1 = [p1[0] + n1[0] * k, p1[1] + n1[1] * k], c2 = [p2[0] + n2[0] * k, p2[1] + n2[1] * k];
      const d0 = `M${p1[0]} ${p1[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
      const g = el('g', { class: `wire${e.chain === hotChain ? ' is-hot' : ''}`, 'data-chain': e.chain }, svg);
      const id = `w${uid++}`;
      el('path', { id, class: 'wire__dots', d: d0 }, g);
      // ">" at the end, turned to the curve's direction
      const ang = Math.atan2(-n2[1], -n2[0]), s = 6;           // straight into the card
      el('path', { class: 'wire__head', d: `M${p2[0] - Math.cos(ang - 0.6) * s} ${p2[1] - Math.sin(ang - 0.6) * s} L${p2[0]} ${p2[1]} L${p2[0] - Math.cos(ang + 0.6) * s} ${p2[1] - Math.sin(ang + 0.6) * s}` }, g);
      // the bits shown on hover, written along the same curve
      const t = el('text', { class: 'wire__bits', dy: '3.5' }, g);
      const tp = el('textPath', { href: `#${id}`, startOffset: '0' }, t);
      tp.textContent = BITS.repeat(Math.ceil(len / 60) + 2);
    });
  };

  // While a card is hovered, its bits stream toward it.
  let streamTimer = 0;
  const stream = (on) => {
    clearInterval(streamTimer);
    if (!on) return;
    let k = 0;
    streamTimer = setInterval(() => {
      k = (k + 1) % 8;
      svg.querySelectorAll('.wire.is-hot textPath').forEach((tp) => tp.setAttribute('startOffset', `${k * 6.2 - 49.6}`));
    }, 70);
  };

  /* ---------- Fit the graph to the screen ----------
     On a laptop the whole graph should be visible without scrolling. If it is taller than the
     window it is scaled down as one piece (never below MIN_SCALE, after which the page scrolls),
     and the negative margin gives back the space the scaling freed. Phones get the stacked
     layout instead, which scrolls. */
  const MIN_SCALE = 0.72;
  const fit = () => {
    if (!graph) return;
    graph.style.transform = '';
    graph.style.marginBottom = '';
    graph.style.height = '';
    scale = 1;
    if (getComputedStyle(svg).display === 'none') return;
    // the canvas is as tall as its lowest card
    const bottom = Math.max(...Array.from(graph.querySelectorAll('[data-id]')).map((n) => n.offsetTop + n.offsetHeight));
    graph.style.height = `${bottom + 28}px`;
    const natural = graph.offsetHeight, wide = graph.offsetWidth;
    const room = d.documentElement.clientWidth - 32;
    const byHeight = Math.max(MIN_SCALE, (window.innerHeight - 2) / natural);
    scale = Math.min(1, room / wide, byHeight);
    graph.style.transform = `translateX(-50%) scale(${scale})`;
    graph.style.marginBottom = `${-natural * (1 - scale)}px`;
  };
  const layout = () => { fit(); draw(); };

  if (graph && svg) {
    layout();
    if ('ResizeObserver' in window) {
      new ResizeObserver(draw).observe(graph);
      // The viewport's size, watched through an invisible full-screen box: not every resize
      // (zoom, split view, a height-only change) fires 'resize'.
      const viewport = d.createElement('div');
      viewport.setAttribute('aria-hidden', 'true');
      viewport.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;z-index:-1';
      d.body.appendChild(viewport);
      new ResizeObserver(layout).observe(viewport);
    }
    window.addEventListener('resize', layout);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(layout);
    window.addEventListener('load', layout);

    // Hovering (or focusing) a node lights the wires that lead to it.
    const chainOf = (n) => {
      const id = n.dataset.id;
      return id.startsWith('s-') ? id.slice(2) : id;
    };
    const light = (chain) => { hotChain = chain; svg.querySelectorAll('.wire').forEach((w) => w.classList.toggle('is-hot', w.dataset.chain === chain)); stream(Boolean(chain)); };
    graph.querySelectorAll('.node.is-link[data-id]').forEach((n) => {
      n.addEventListener('pointerenter', () => light(chainOf(n)));
      n.addEventListener('pointerleave', () => light(null));
      n.addEventListener('focusin', () => light(chainOf(n)));
      n.addEventListener('focusout', () => light(null));
    });
  }

  /* ---------- Popups ----------
     Each node opens a <dialog>. The URL follows along (#experience), so a popup can be linked
     to, and the old section URLs (/experiences → /#experience) open the right one. */
  const pops = new Map(Array.from(d.querySelectorAll('dialog.pop')).map((p) => [p.id, p]));
  const canModal = pops.size && typeof d.createElement('dialog').showModal === 'function';
  const clearHash = () => history.replaceState(null, '', location.pathname + location.search);

  const openPop = (id) => {
    const p = pops.get(id);
    if (!p || !canModal) return false;
    pops.forEach((o) => { if (o !== p && o.open) o.close(); });
    if (!p.open) p.showModal();
    p.scrollTop = 0;
    history.replaceState(null, '', `#${id}`);
    return true;
  };

  if (canModal) {
    d.addEventListener('click', (e) => {
      const a = e.target.closest('[data-open]');
      if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (openPop(a.dataset.open)) e.preventDefault();
    });
    pops.forEach((p) => {
      // A click on the dialog element itself is a click on the blurred backdrop.
      p.addEventListener('click', (e) => { if (e.target === p || e.target.closest('[data-close]')) p.close(); });
      p.addEventListener('close', () => { if (location.hash === `#${p.id}`) clearHash(); });
    });
    const fromHash = () => { const id = location.hash.slice(1); if (pops.has(id)) openPop(id); };
    window.addEventListener('hashchange', fromHash);
    fromHash();
  }

  /* ---------- Resume request dialog ----------
     The resume isn't public, so every Resume button opens a request form. The buttons are
     still links to /resume, which renders the same form if this never runs. */
  const rq = d.getElementById('resume-dialog');
  if (rq && typeof rq.showModal === 'function') {
    const form = rq.querySelector('[data-resume-form]');
    const ask = rq.querySelector('.rq__ask');
    const done = rq.querySelector('.rq__done');
    const submit = form.querySelector('[type="submit"]');

    const setError = (name, msg) => {
      const el = form.querySelector(`[data-error="${name}"]`);
      if (!el) return;
      el.textContent = msg || '';
      if (name === 'form') { el.hidden = !msg; return; }
      const field = el.closest('.field');
      const input = field.querySelector('input, textarea');
      field.classList.toggle('has-error', Boolean(msg));
      if (msg) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    };
    const clearErrors = () => ['name', 'email', 'form'].forEach((n) => setError(n, ''));
    form.addEventListener('input', (e) => setError(e.target.name, ''));

    d.querySelectorAll('a[data-resume]').forEach((a) => {
      a.addEventListener('click', (e) => {
        // Let modified clicks open /resume in a new tab as usual.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        rq.showModal();
      });
    });

    // A click on the dialog element itself is a click on the backdrop around the panel.
    rq.addEventListener('click', (e) => {
      if (e.target === rq || e.target.closest('[data-close]')) rq.close();
    });
    rq.addEventListener('close', () => {
      if (done.hidden) return;
      form.reset();
      clearErrors();
      done.hidden = true;
      ask.hidden = false;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submit.disabled) return;
      clearErrors();
      submit.disabled = true;
      form.setAttribute('aria-busy', 'true');
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });
        const data = await res.json();
        if (data.ok) {
          rq.querySelector('[data-sent-to]').textContent = form.elements.email.value.trim();
          ask.hidden = true;
          done.hidden = false;
          done.querySelector('[data-close]').focus();
        } else {
          Object.entries(data.errors || {}).forEach(([name, msg]) => setError(name, msg));
          if (data.error) setError('form', data.error);
          const bad = form.querySelector('[aria-invalid="true"]');
          if (bad) bad.focus();
        }
      } catch (err) {
        setError('form', 'Couldn’t reach the server. Check your connection and try again.');
      } finally {
        submit.disabled = false;
        form.removeAttribute('aria-busy');
      }
    });
  }
})();
