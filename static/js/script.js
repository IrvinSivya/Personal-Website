/* Irvin Sivya — portfolio interactions.
   Everything here is progressive enhancement: the page reads fine without it. */
(() => {
  const d = document;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasIO = 'IntersectionObserver' in window;

  /* ---------- Header state, scroll progress, hero parallax ---------- */
  const header = d.getElementById('site-header');
  const progress = d.querySelector('.progress span');
  const heroMedia = d.querySelector('.hero__media');
  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (header) header.classList.toggle('is-scrolled', y > 24);
      if (progress) {
        const h = d.documentElement.scrollHeight - window.innerHeight;
        progress.style.setProperty('--p', h > 0 ? (y / h).toFixed(4) : 0);
      }
      if (heroMedia && !reduceMotion && y < window.innerHeight * 1.3) {
        heroMedia.style.transform = `translateY(${(y * 0.08).toFixed(1)}px)`;
      }
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const burger = d.getElementById('burger');
  const menu = d.getElementById('menu');
  if (burger && menu) {
    const setMenu = (open) => {
      burger.classList.toggle('is-open', open);
      menu.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.setAttribute('aria-hidden', String(!open));
      d.body.classList.toggle('menu-open', open);
    };
    burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    d.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false);
    });
  }

  /* ---------- Reveal on scroll ---------- */
  const revealEls = d.querySelectorAll('[data-reveal]');
  if (hasIO && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Active nav link ---------- */
  const navLinks = Array.from(d.querySelectorAll('.nav a[data-nav]'));
  const sections = navLinks.map((a) => d.getElementById(a.dataset.nav)).filter(Boolean);
  if (sections.length && hasIO) {
    const setActive = (id) => navLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.nav === id));
    const so = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id); });
    }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
    sections.forEach((s) => so.observe(s));
    window.addEventListener('scroll', () => {
      if (window.scrollY < sections[0].offsetTop - window.innerHeight * 0.5) setActive(null);
    }, { passive: true });
  }

  /* ---------- Counters ---------- */
  const counters = d.querySelectorAll('[data-count]');
  const fmt = (n) => n.toLocaleString('en-US');
  const runCounter = (el) => {
    const target = Number(el.dataset.count);
    const duration = 1500;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const startCounters = () => {
    if (reduceMotion || !hasIO) {
      counters.forEach((el) => { el.textContent = fmt(Number(el.dataset.count)); });
      return;
    }
    const co = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { runCounter(en.target); co.unobserve(en.target); }
      });
    }, { threshold: 0.5 });
    counters.forEach((el) => co.observe(el));
  };
  // Don't count under the intro overlay; wait until it has handed off to the hero.
  (window.introPromise || Promise.resolve()).then(startCounters);

  /* ---------- Hero spotlight follows the cursor ---------- */
  const hero = d.querySelector('.hero');
  if (hero && finePointer && !reduceMotion) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', `${((e.clientX - r.left) / r.width * 100).toFixed(2)}%`);
      hero.style.setProperty('--my', `${((e.clientY - r.top) / r.height * 100).toFixed(2)}%`);
    });
  }

  /* ---------- Card sheen tracks the cursor ---------- */
  if (finePointer) {
    d.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--x', `${e.clientX - r.left}px`);
        card.style.setProperty('--y', `${e.clientY - r.top}px`);
      });
    });
  }

  /* ---------- Magnetic buttons ---------- */
  if (finePointer && !reduceMotion) {
    d.querySelectorAll('[data-magnetic]').forEach((btn) => {
      const strength = 0.22;
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${(x * strength).toFixed(1)}px, ${(y * strength).toFixed(1)}px)`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }

  /* ---------- "Read more" for clamped descriptions ---------- */
  d.querySelectorAll('.clamp').forEach((p) => {
    const btn = p.parentElement && p.parentElement.querySelector('.more');
    if (!btn) return;
    const check = () => { if (p.scrollHeight > p.clientHeight + 2) btn.hidden = false; };
    check();
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(check);
    btn.addEventListener('click', () => {
      const open = p.classList.toggle('is-open');
      btn.textContent = open ? 'Show less' : 'Read more';
      btn.setAttribute('aria-expanded', String(open));
    });
  });
})();
