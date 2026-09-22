/* Flight to Waterloo — the opening sequence.
   A dotted Earth is built from a real coastline mask (Natural Earth), a plane flies a true
   great-circle route from a random world city into Waterloo while the globe turns beneath it,
   then the whole thing dissolves into the hero. Plays once per session, is skippable, and is
   never shown to reduced-motion users. Everything degrades to "just show the site". */
(() => {
  const html = document.documentElement;
  const overlay = document.getElementById('intro');
  let resolveDone;
  window.introPromise = new Promise((r) => { resolveDone = r; });

  const finish = () => {
    html.classList.remove('intro-pending');
    html.classList.add('hero-go');
    if (overlay) overlay.classList.add('is-leaving');
    setTimeout(() => { if (overlay) overlay.remove(); }, 1000);
    resolveDone();
  };

  if (!overlay || !html.classList.contains('intro-pending')) { finish(); return; }
  window.__introStarted = true;
  try { sessionStorage.setItem('intro-seen', '1'); } catch (e) { /* private mode */ }

  /* ---------- Setup ---------- */
  const canvas = overlay.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const hud = {};
  overlay.querySelectorAll('[data-hud]').forEach((el) => { hud[el.dataset.hud] = el; });

  const D2R = Math.PI / 180;
  const TAU = Math.PI * 2;
  const EARTH_KM = 6371;
  const DEST = { name: 'Waterloo, ON', lat: 43.4723, lon: -80.5449 };
  const ORIGINS = [
    { code: 'LHR', name: 'London', lat: 51.47, lon: -0.46 },
    { code: 'HND', name: 'Tokyo', lat: 35.55, lon: 139.78 },
    { code: 'BOM', name: 'Mumbai', lat: 19.09, lon: 72.87 },
    { code: 'GRU', name: 'São Paulo', lat: -23.43, lon: -46.47 },
    { code: 'SYD', name: 'Sydney', lat: -33.95, lon: 151.18 },
    { code: 'NBO', name: 'Nairobi', lat: -1.32, lon: 36.93 },
    { code: 'DXB', name: 'Dubai', lat: 25.25, lon: 55.36 },
    { code: 'SFO', name: 'San Francisco', lat: 37.62, lon: -122.38 },
  ];
  const origin = ORIGINS[Math.floor(Math.random() * ORIGINS.length)];

  // Timeline (ms)
  const T_FLY_START = 450;
  const T_FLY = 2700;
  const T_LANDED = T_FLY_START + T_FLY;      // 3150
  const T_LEAVE = T_LANDED + 700;            // 3850
  const T_END = T_LEAVE + 900;               // 4750

  const ACCENT = '255, 90, 31';
  const BONE = '242, 237, 228';
  const PLANE = new Path2D('M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z');

  const toVec = (lat, lon) => {
    const p = lat * D2R, l = lon * D2R, c = Math.cos(p);
    return [c * Math.cos(l), Math.sin(p), c * Math.sin(l)];
  };
  const A = toVec(origin.lat, origin.lon);
  const B = toVec(DEST.lat, DEST.lon);
  const omega = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
  const totalKm = EARTH_KM * omega;
  const slerp = (t) => {
    const s = Math.sin(omega);
    const a = Math.sin((1 - t) * omega) / s, b = Math.sin(t * omega) / s;
    return [A[0] * a + B[0] * b, A[1] * a + B[1] * b, A[2] * a + B[2] * b];
  };
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fmtKm = (km) => Math.round(km).toLocaleString('en-US') + ' km';

  /* ---------- Viewport ---------- */
  let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, R = 0, mobile = false;
  const resize = () => {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    mobile = W < 900;
    cx = mobile ? W * 0.5 : W * 0.40;
    cy = mobile ? H * 0.36 : H * 0.53;
    R = mobile ? Math.min(W * 0.40, H * 0.25) : Math.min(W * 0.26, H * 0.37);
  };
  resize();
  window.addEventListener('resize', resize);

  /* ---------- Dots from the land mask ---------- */
  let dots = null; // Float32Array of unit vectors [x, y, z, ...]
  const buildDots = (img) => {
    const mw = img.naturalWidth, mh = img.naturalHeight;
    const off = document.createElement('canvas');
    off.width = mw; off.height = mh;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(img, 0, 0);
    const data = octx.getImageData(0, 0, mw, mh).data;
    const N = mobile ? 11000 : 20000;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const spacing = Math.sqrt(4 * Math.PI / N);   // mean angular gap between points (radians)
    const out = [];
    let seed = 1337;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
    for (let i = 0; i < N; i++) {
      const y0 = 1 - (i / (N - 1)) * 2;
      const r0 = Math.sqrt(1 - y0 * y0);
      const th = golden * i;
      // jitter each point by up to ~35% of the spacing to break the spiral moiré
      const lat = Math.asin(y0) / D2R + rnd() * 0.7 * spacing / D2R;
      const lon = Math.atan2(Math.sin(th) * r0, Math.cos(th) * r0) / D2R + rnd() * 0.7 * spacing / D2R / Math.max(0.2, r0);
      const v = toVec(lat, lon);
      const x = v[0], y = v[1], z = v[2];
      const px = Math.min(mw - 1, Math.floor((lon + 180) / 360 * mw));
      const py = Math.min(mh - 1, Math.floor((90 - lat) / 180 * mh));
      if (data[(py * mw + px) * 4] > 127) out.push(x, y, z);
    }
    dots = new Float32Array(out);
  };

  /* ---------- Projection: camera centred on (lat0, lon0) ---------- */
  let cl = 1, sl = 0, ca = 1, sa = 0;
  const setCamera = (lat0, lon0) => {
    cl = Math.cos(lon0 * D2R); sl = Math.sin(lon0 * D2R);
    ca = Math.cos(lat0 * D2R); sa = Math.sin(lat0 * D2R);
  };
  // Returns [screenX, screenY, depth] for a vector at altitude factor `alt` (1 = surface)
  const project = (v, alt, radius) => {
    const x = v[0], y = v[1], z = v[2];
    const sx = z * cl - x * sl;
    const d0 = x * cl + z * sl;
    const y2 = y * ca - d0 * sa;
    const z2 = y * sa + d0 * ca;
    return [cx + sx * radius * alt, cy - y2 * radius * alt, z2, sx, y2];
  };
  const visible = (p, alt) => p[2] > 0 || (p[3] * p[3] + p[4] * p[4]) * alt * alt > 1;

  /* ---------- Drawing ---------- */
  const drawGlobe = (radius) => {
    // outer glow
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.35);
    glow.addColorStop(0, `rgba(${ACCENT}, 0.10)`);
    glow.addColorStop(1, `rgba(${ACCENT}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, radius * 1.35, 0, TAU); ctx.fill();
    // body
    const body = ctx.createRadialGradient(cx - radius * 0.4, cy - radius * 0.4, radius * 0.05, cx, cy, radius);
    body.addColorStop(0, '#1e1b18');
    body.addColorStop(1, '#0b0a09');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${BONE}, 0.16)`; ctx.lineWidth = 1; ctx.stroke();
  };

  const drawDots = (radius) => {
    if (!dots) return;
    const s = Math.max(1.1, radius / 140);
    let last = -1;
    for (let i = 0; i < dots.length; i += 3) {
      const x = dots[i], y = dots[i + 1], z = dots[i + 2];
      const sx = z * cl - x * sl;
      const d0 = x * cl + z * sl;
      const y2 = y * ca - d0 * sa;
      const z2 = y * sa + d0 * ca;
      if (z2 <= 0.02) continue;
      const bucket = Math.min(7, Math.floor(z2 * 8));
      if (bucket !== last) { ctx.fillStyle = `rgba(${BONE}, ${(0.12 + 0.78 * Math.pow((bucket + 1) / 8, 1.4)).toFixed(3)})`; last = bucket; }
      ctx.fillRect(cx + sx * radius - s / 2, cy - y2 * radius - s / 2, s, s);
    }
  };

  const drawRoute = (u, radius) => {
    const STEPS = 140;
    const seg = (from, to, style, dash) => {
      ctx.beginPath();
      ctx.setLineDash(dash);
      ctx.strokeStyle = style; ctx.lineWidth = 1.4;
      let pen = false;
      for (let i = 0; i <= STEPS; i++) {
        const t = from + (to - from) * (i / STEPS);
        const alt = 1 + 0.11 * Math.sin(Math.PI * t);
        const p = project(slerp(t), alt, radius);
        if (visible(p, alt)) { if (pen) ctx.lineTo(p[0], p[1]); else { ctx.moveTo(p[0], p[1]); pen = true; } }
        else pen = false;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    if (u < 1) seg(u, 1, `rgba(${BONE}, 0.22)`, [2, 6]);
    if (u > 0) seg(0, u, `rgba(${ACCENT}, 0.9)`, [5, 4]);
  };

  const drawMarker = (v, radius, label, t, landed) => {
    const p = project(v, 1, radius);
    if (p[2] <= 0) return;
    const a = 0.35 + 0.65 * p[2];
    if (landed) {
      const k = ((t / 1400) % 1);
      ctx.beginPath(); ctx.arc(p[0], p[1], 6 + k * 26, 0, TAU);
      ctx.strokeStyle = `rgba(${ACCENT}, ${(1 - k) * 0.7})`; ctx.lineWidth = 1.2; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(p[0], p[1], 3.2, 0, TAU);
    ctx.fillStyle = `rgba(${ACCENT}, ${a})`; ctx.fill();
    ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, TAU);
    ctx.strokeStyle = `rgba(${ACCENT}, ${a * 0.5})`; ctx.lineWidth = 1; ctx.stroke();
    if (label) {
      ctx.font = '500 11px "Geist Mono", ui-monospace, Menlo, monospace';
      ctx.fillStyle = `rgba(${BONE}, ${a})`;
      ctx.textBaseline = 'middle';
      ctx.fillText(label.toUpperCase(), p[0] + 14, p[1]);
    }
  };

  const drawPlane = (u, radius) => {
    const alt = (t) => 1 + 0.11 * Math.sin(Math.PI * t);
    const p = project(slerp(u), alt(u), radius);
    const q = project(slerp(Math.min(1, u + 0.004)), alt(Math.min(1, u + 0.004)), radius);
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
    const size = Math.max(16, radius / 11);
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.rotate(ang);
    ctx.scale(size / 24, size / 24);
    ctx.translate(-12, -12);
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.fillStyle = `rgb(${BONE})`;
    ctx.fill(PLANE);
    ctx.restore();
  };

  /* ---------- Timeline ---------- */
  let t0 = 0, raf = 0, leaving = false, landedAt = 0;
  const setText = (key, text) => { if (hud[key] && hud[key].textContent !== text) hud[key].textContent = text; };

  const leave = () => {
    if (leaving) return;
    leaving = true;
    overlay.classList.add('is-leaving');
    html.classList.remove('intro-pending');
    html.classList.add('hero-go');
    resolveDone();
    setTimeout(() => { cancelAnimationFrame(raf); overlay.remove(); }, 1000);
  };

  const frame = (now) => {
    const t = now - t0;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const u = easeInOut(clamp01((t - T_FLY_START) / T_FLY));
    const landed = t >= T_LANDED;
    const zoom = landed ? 1 + 0.9 * easeOut(clamp01((t - T_LANDED) / (T_END - T_LANDED))) : 1;
    const radius = R * zoom;

    // Camera rides with the plane; the world turns beneath it.
    const pv = slerp(u);
    const lat = Math.asin(pv[1]) / D2R;
    const lon = Math.atan2(pv[2], pv[0]) / D2R;
    setCamera(lat * 0.85 + DEST.lat * 0.15 * u, lon);

    drawGlobe(radius);
    drawDots(radius);
    drawRoute(u, radius);
    drawMarker(A, radius, origin.code, t, false);
    drawMarker(B, radius, DEST.name, t, landed);
    if (!landed) drawPlane(u, radius);

    // HUD
    if (t < T_FLY_START) setText('status', 'Boarding');
    else if (!landed) setText('status', 'En route');
    else setText('status', 'Landed');
    setText('dist', fmtKm(totalKm * (1 - u)));
    if (landed && !landedAt) {
      landedAt = t;
      overlay.classList.add('is-landed');
      if (hud.title) hud.title.innerHTML = 'Welcome to <em>Waterloo</em>.';
    }
    if (t >= T_LEAVE) leave();
    if (!leaving) raf = requestAnimationFrame(frame);
  };

  const start = () => {
    setText('from', `${origin.code} · ${origin.name}`);
    setText('dist', fmtKm(totalKm));
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  };

  // Skip: button, click anywhere, or a key.
  const skipBtn = overlay.querySelector('.intro__skip');
  if (skipBtn) skipBtn.addEventListener('click', (e) => { e.stopPropagation(); leave(); });
  overlay.addEventListener('click', leave);
  document.addEventListener('keydown', (e) => { if (['Escape', 'Enter', ' '].includes(e.key)) leave(); }, { once: true });

  // Load the mask; if it is slow or fails, skip the show rather than make anyone wait.
  const img = new Image();
  const bail = setTimeout(leave, 2500);
  img.onload = () => { clearTimeout(bail); try { buildDots(img); start(); } catch (e) { leave(); } };
  img.onerror = () => { clearTimeout(bail); leave(); };
  img.src = canvas.dataset.mask;
})();
