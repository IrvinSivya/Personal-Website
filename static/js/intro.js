/* Flight to Waterloo — the opening sequence.

   A WebGL2 globe rendered in one fragment shader (a ray-traced sphere, no 3D library). Land is a
   lattice of dots sampled from a Natural Earth coastline mask; the night side glows with city
   lights baked from 7,342 real populated places; the atmosphere keeps a constant on-screen
   thickness at any altitude; and the dot lattice subdivides by three as the camera descends, so
   detail never runs out.

   The light tells the story: the globe opens backlit in eclipse (a thin crescent and a hemisphere
   of cities), a side key sweeps a terminator across it during the flight, and the landing happens
   at night over the lit Great Lakes with a sunrise on the limb. The Waterloo pin's ring then
   becomes an aperture the camera dollies through, each hero element enters as the ring crosses
   it, and the destination dot flies into the hero's "CS @ Waterloo" marker.

   A 2D canvas draws the route, the plane and its shadow, pins and tags. Plays once per session,
   skippable (click, Esc, Space, Enter), never for reduced motion or deep links, and falls back to
   simply showing the site when WebGL2 is missing, software-rendered, or the textures are slow.
   The flight departs from Punjab, India (Amritsar, ATQ).
   Debug: ?intro forces a replay; &introFrom=LHR tests another origin; &introT=2.5 freezes time. */
(() => {
  const html = document.documentElement;
  const overlay = document.getElementById('intro');
  const beacon = document.querySelector('.intro-beacon');
  let resolveDone;
  window.introPromise = new Promise((r) => { resolveDone = r; });

  let handedOff = false;
  let cleanup = () => {};
  let under = [];

  const dropBeacon = () => {
    html.classList.remove('beacon-flying');
    if (beacon) beacon.remove();
  };
  // Hand the page back: un-inert it, move focus out of the overlay, start the hero entrance.
  const handOff = () => {
    if (handedOff) return;
    handedOff = true;
    under.forEach((el) => { el.inert = false; });
    const hadFocus = overlay && overlay.contains(document.activeElement);
    if (overlay) overlay.inert = true;
    html.classList.remove('intro-pending');
    html.classList.add('hero-go');
    if (hadFocus) {
      const a = document.querySelector('.site-header a');
      if (a) a.focus({ preventScroll: true });
    }
  };
  const bailOut = () => {
    handOff();
    dropBeacon();
    resolveDone();
    if (overlay) {
      overlay.classList.add('is-leaving');
      setTimeout(() => { overlay.remove(); cleanup(); }, 900);
    }
  };

  if (!overlay || !html.classList.contains('intro-pending')) { bailOut(); return; }
  window.__introStarted = true;
  overlay.classList.add('is-active');
  under = [...document.body.children].filter((el) => el !== overlay && el !== beacon && el.tagName !== 'SCRIPT');
  under.forEach((el) => { el.inert = true; });
  try { sessionStorage.setItem('intro-seen', '1'); } catch (e) { /* private mode */ }

  const params = new URLSearchParams(location.search);
  const FREEZE = params.has('introT') ? Math.max(0, parseFloat(params.get('introT')) || 0) : null;

  /* ------------------------------------------------------------------ math */
  const D2R = Math.PI / 180;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const sineIO = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
  const easeInOut = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  const easeOutBack = (x, s = 1.7) => { x = clamp01(x); return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
  const seg = (t, a, b) => clamp01((t - a) / (b - a));

  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const slerpV = (a, b, k) => {
    const w = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
    if (w < 1e-4) return a;
    const s = Math.sin(w);
    return add(mul(a, Math.sin((1 - k) * w) / s), mul(b, Math.sin(k * w) / s));
  };
  const rotAxis = (v, k, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
  };

  // World: unit sphere; east is to the right when viewed from outside with north up.
  const toVec = (lat, lon) => {
    const p = lat * D2R, l = lon * D2R, c = Math.cos(p);
    return [c * Math.cos(l), Math.sin(p), -c * Math.sin(l)];
  };

  /* --------------------------------------------------------------- route */
  const DEST = { code: 'YKF', name: 'Waterloo', lat: 43.4643, lon: -80.5204 };
  const ORIGINS = [
    { code: 'ATQ', name: 'Punjab', lat: 31.71, lon: 74.80 },       // Amritsar, Punjab, India
    { code: 'LHR', name: 'London', lat: 51.47, lon: -0.46 },
    { code: 'HND', name: 'Tokyo', lat: 35.55, lon: 139.78 },
    { code: 'BOM', name: 'Mumbai', lat: 19.09, lon: 72.87 },
    { code: 'GRU', name: 'São Paulo', lat: -23.43, lon: -46.47 },
    { code: 'SYD', name: 'Sydney', lat: -33.95, lon: 151.18 },
    { code: 'CDG', name: 'Paris', lat: 49.01, lon: 2.55 },
    { code: 'DXB', name: 'Dubai', lat: 25.25, lon: 55.36 },
    { code: 'SFO', name: 'San Francisco', lat: 37.62, lon: -122.38 },
    { code: 'SIN', name: 'Singapore', lat: 1.36, lon: 103.99 },
    { code: 'CPT', name: 'Cape Town', lat: -33.97, lon: 18.6 },
  ];
  // The flight always departs from Punjab, India. Other origins exist only for testing via ?introFrom=.
  const forced = (params.get('introFrom') || '').toUpperCase();
  const origin = ORIGINS.find((o) => o.code === forced) || ORIGINS[0];

  const A = toVec(origin.lat, origin.lon);
  const B = toVec(DEST.lat, DEST.lon);
  const omega = Math.acos(Math.max(-1, Math.min(1, dot(A, B))));
  const routeKm = 6371 * omega;
  const slerp = (t) => {
    const s = Math.sin(omega) || 1;
    const a = Math.sin((1 - t) * omega) / s, b = Math.sin(t * omega) / s;
    return [A[0] * a + B[0] * b, A[1] * a + B[1] * b, A[2] * a + B[2] * b];
  };
  const ARC_H = 0.035 + 0.11 * (omega / Math.PI);           // arc height, fraction of Earth radius
  const arcAlt = (u) => ARC_H * Math.sin(Math.PI * clamp01(u));
  let arcK = 1;                                              // flattens the arc after touchdown
  // +0.002 (~12 km) keeps the ground track from failing the occlusion test at grazing angles.
  const routePoint = (s) => mul(slerp(s), 1 + (ARC_H * arcK + 0.002) * Math.sin(Math.PI * clamp01(s)));

  // Route-relative framing: the camera travels in the flight direction and rolls smoothly from
  // north-up at the origin to north-up at Waterloo, so no route ever whips around a pole.
  const AX = norm(cross(A, B));
  const travelAt = (p) => norm(cross(AX, p));
  const northAt = (p) => norm(sub([0, 1, 0], mul(p, p[1])));
  const angAbout = (a, b, n) => Math.atan2(dot(cross(a, b), n), dot(a, b));
  const thA = angAbout(travelAt(A), northAt(A), A);
  const thB = angAbout(travelAt(B), northAt(B), B);
  const dTh = Math.atan2(Math.sin(thB - thA), Math.cos(thB - thA));
  const upAlong = (p, k) => {
    const Tv = travelAt(p), th = thA + dTh * k;
    return add(mul(Tv, Math.cos(th)), mul(cross(p, Tv), Math.sin(th)));
  };
  // Tags sit on the side away from the direction of travel.
  const eastAt = (P) => norm(cross([0, 1, 0], P));
  const cosAB = dot(A, B);
  const ORIGIN_TAG = dot(sub(B, mul(A, cosAB)), eastAt(A)) > 0 ? 'left' : 'right';
  const DEST_TAG = dot(sub(mul(B, cosAB), A), eastAt(B)) > 0 ? 'right' : 'left';

  /* ------------------------------------------------------------ timeline (s) */
  const T = {
    fadeIn: [0, 0.35],
    boot: [0.35, 1.3],
    pre: [0, 1.6],
    sunUp: [0.15, 1.6],
    fly: [0.4, 3.1],
    landed: 3.1,
    dive: [2.45, 3.95],
    pitch: [2.8, 3.95],
    sunDown: [2.55, 3.85],
    portal: [3.9, 4.7],
    end: 4.75,
  };

  /* -------------------------------------------------------------- viewport */
  const glCanvas = overlay.querySelector('.intro__gl');
  const fx = overlay.querySelector('.intro__fx');
  const ctx = fx.getContext('2d');
  const STACK_MQ = window.matchMedia('(max-width: 900px) and (orientation: portrait)');
  let W = 0, H = 0, fxDPR = 1, glScale = 1, mobile = false;
  let stacked = false, stageCx = 0, hudLeft = 1e9;
  let baseFocal = 1, cruiseH = 2.55, baseGrid = 1.0;

  const sizeGL = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75) * glScale;
    glCanvas.width = Math.max(1, Math.round(W * dpr));
    glCanvas.height = Math.max(1, Math.round(H * dpr));
  };
  const layout = () => {
    // Size from the overlay itself: with a classic scrollbar the viewport and the overlay differ.
    const rect = overlay.getBoundingClientRect();
    W = rect.width || window.innerWidth;
    H = rect.height || window.innerHeight;
    stacked = STACK_MQ.matches;
    mobile = Math.min(W, H) < 600;
    fxDPR = Math.min(window.devicePixelRatio || 1, 2);
    fx.width = Math.round(W * fxDPR); fx.height = Math.round(H * fxDPR);
    let targetR;
    if (stacked) {
      targetR = Math.min(W * 0.43, H * 0.25);
      stageCx = W * 0.5;
      hudLeft = 1e9;
    } else {
      // Globe and HUD are one centred group: [globe] gap [hud column].
      const gut = Math.min(72, Math.max(20, W * 0.05));
      const hudW = Math.min(440, Math.max(300, W * 0.30));
      const gap = Math.min(140, Math.max(40, W * 0.045));
      targetR = Math.min(H * 0.39, (W - 2 * gut - gap - hudW) / 2 / 1.08);
      const left = Math.max(gut, (W - (2 * targetR + gap + hudW)) / 2);
      stageCx = left + targetR;
      hudLeft = left + 2 * targetR + gap;
      overlay.style.setProperty('--hud-x', `${hudLeft}px`);
      overlay.style.setProperty('--hud-w', `${hudW}px`);
      overlay.style.setProperty('--stage', `${left}px`);
    }
    baseFocal = targetR / Math.tan(Math.asin(1 / (1 + cruiseH)));
    const pxPerDeg = baseFocal * D2R / cruiseH;               // dot spacing ≈ 6 CSS px at cruise
    baseGrid = Math.min(2.4, Math.max(0.7, 6.2 / pxPerDeg));
    sizeGL();
  };
  const frame = (dv) => (stacked
    ? { x: W * 0.5, y: lerp(H * 0.34, H * 0.40, dv) }
    : { x: lerp(stageCx, stageCx + W * 0.03, dv), y: lerp(H * 0.52, H * 0.60, dv) });

  /* ---------------------------------------------------------------- WebGL */
  const gl = glCanvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  if (!gl) { bailOut(); return; }
  // A software renderer (remote desktops, blocklisted GPUs) would play this at 7-15 fps.
  const ri = gl.getExtension('WEBGL_debug_renderer_info');
  const rendererName = String(ri ? gl.getParameter(ri.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  if (/SwiftShader|llvmpipe|softpipe|Basic Render/i.test(rendererName)) { bailOut(); return; }

  const VERT = `#version 300 es
  in vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
  precision highp float;
  uniform vec2 uCenter;      // principal point, GL px (origin bottom-left)
  uniform float uFocal;      // GL px
  uniform vec3 uCamPos, uCamR, uCamU, uCamF;
  uniform vec3 uSun;
  uniform float uTime, uFade, uBoot, uGrid, uPxTarget, uAltK, uLightsSize;
  uniform vec3 uBootC, uDest;
  uniform float uDestGlow;
  uniform sampler2D uLand, uLights;
  out vec4 outColor;

  const float PI = 3.14159265359;
  const vec3 BONE = vec3(0.949, 0.929, 0.894);
  const vec3 ACC  = vec3(1.0, 0.353, 0.122);
  const vec3 AMBER = vec3(1.0, 0.62, 0.34);
  const vec3 BG   = vec3(0.051, 0.047, 0.043);

  float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  vec2 toUV(float lat, float lon) { return vec2((lon + 180.0) / 360.0, (90.0 - lat) / 180.0); }

  // One level of a nested dot lattice (1, 3, 9, 27 cells per top cell, so levels line up).
  // x: coverage, y: land, z: city light, w: seed. rk = radius / cell, g = growth 0..1.
  vec4 lattice(float lat, float lon, float delta, float aa, float aaR, float rk, float g) {
    float k = floor(uGrid / delta + 0.5);
    float trow = floor((lat + 90.0) / uGrid);
    float row = trow * k + clamp(floor((lat + 90.0 - trow * uGrid) / delta), 0.0, k - 1.0);
    float clat = -90.0 + (row + 0.5) * delta;
    float ncols = max(1.0, floor(360.0 * cos(radians(-90.0 + (trow + 0.5) * uGrid)) / uGrid)) * k;
    float colw = 360.0 / ncols;
    float clon = -180.0 + (floor((lon + 180.0) / colw) + 0.5) * colw;
    float h = hash13(vec3(floor(vec2(clat, clon) * 512.0 + 0.5), 3.0));   // parent and centre child share a seed
    float r = delta * rk * smoothstep(h * 0.35, h * 0.35 + 0.65, g);
    vec2 dd = vec2(lat - clat, (lon - clon) * cos(radians(lat)));
    float a = (1.0 - smoothstep(r - aa, r + aa, length(dd))) * min(1.0, r / max(aa, 1e-5) * 1.2);
    float meanCov = 3.14159 * (r / delta) * (r / delta);
    a = mix(a, meanCov, smoothstep(1.2, 2.8, aaR / max(r, 1e-6)));        // grazing rows average instead of sparkle
    vec2 uv = toUV(clat, clon);
    return vec4(a, step(0.5, textureLod(uLand, uv, 0.0).r), textureLod(uLights, uv, 0.0).r, h);
  }

  vec3 stars(vec3 d) {
    float sc = 150.0;
    vec3 cell = floor(d * sc);
    float h = hash13(cell);
    if (h < 0.982) return vec3(0.0);
    vec3 jit = vec3(hash13(cell + 1.7), hash13(cell + 4.3), hash13(cell + 8.9)) - 0.5;
    vec3 sp = normalize((cell + 0.5 + jit * 0.7) / sc);
    float px = acos(clamp(dot(d, sp), -1.0, 1.0)) * uFocal;
    float br = 0.15 + 0.85 * pow(hash13(cell + 2.2), 5.0);
    float tw = 0.75 + 0.25 * sin(uTime * (0.8 + h * 4.0) + h * 60.0);
    vec3 tint = mix(BONE, AMBER, step(0.9, hash13(cell + 5.5)) * 0.6);
    return tint * br * tw * exp(-px * px / 1.3);
  }

  vec3 shade(vec3 n, vec3 rd, float t, vec3 atmoCol) {
    float lat = degrees(asin(clamp(n.y, -1.0, 1.0)));
    float lon = degrees(atan(-n.z, n.x));
    float ndv = max(dot(n, -rd), 0.0);
    float sunD = dot(n, uSun);
    float day = smoothstep(-0.10, 0.30, sunD);
    float degPerPx = degrees(t / uFocal);
    float aa = degPerPx / max(ndv, 0.12) * 0.75;
    float aaR = degPerPx / max(ndv, 0.02) * 0.75;
    float degPerPxIso = degPerPx / sqrt(max(ndv, 0.08));

    // Ocean: near-black, warmed by the key light, with a soft glint.
    vec3 col = vec3(0.018, 0.016, 0.015) + vec3(0.080, 0.060, 0.046) * pow(max(sunD, 0.0), 1.4);
    vec3 hv = normalize(uSun - rd);
    col += vec3(1.0, 0.78, 0.55) * pow(max(dot(n, hv), 0.0), 70.0) * 0.10 * day;

    // Graticule every 15 degrees.
    float gLat = abs(fract(lat / 15.0 + 0.5) - 0.5) * 15.0;
    float gLon = abs(fract(lon / 15.0 + 0.5) - 0.5) * 15.0 * cos(radians(lat));
    float grid = 1.0 - smoothstep(0.0, aa * 1.6, min(gLat, gLon));
    col += BONE * grid * 0.028 * (0.35 + 0.65 * day);

    // Boot sweep: dots switch on in a wave radiating from the origin city.
    float ang = acos(clamp(dot(n, uBootC), -1.0, 1.0));
    float front = uBoot * PI * 1.08;
    float vis = 1.0 - smoothstep(front - 0.10, front + 0.02, ang);
    float edge = exp(-pow((ang - front) / 0.07, 2.0)) * step(0.001, uBoot) * (1.0 - step(0.999, uBoot));

    // Nested lattice LOD: the parent shrinks onto its centre child while the other children grow in.
    float lvl = clamp(log(uGrid / degPerPxIso / uPxTarget) / log(3.0), 0.0, 3.0);
    float l0 = min(floor(lvl), 2.0);
    float f = smoothstep(0.15, 0.85, lvl - l0);
    float d0 = uGrid / pow(3.0, l0);
    vec4 La = lattice(lat, lon, d0, aa, aaR, mix(0.30, 0.10, f), 1.0);
    vec4 Lb = lattice(lat, lon, d0 / 3.0, aa, aaR, 0.30, f);

    float twA = 0.80 + 0.20 * sin(uTime * 2.3 + La.w * 40.0);
    float twB = 0.80 + 0.20 * sin(uTime * 2.3 + Lb.w * 40.0);
    float lambert = pow(max(sunD, 0.0), 0.75);
    vec3 dayDot = mix(AMBER * 1.05, BONE, smoothstep(0.02, 0.40, sunD)) * (0.16 + 0.84 * lambert) * (0.62 + 0.38 * ndv);
    float zA = pow(La.z, 1.1), zB = pow(Lb.z, 1.1);
    vec3 nightA = BONE * 0.10 + mix(ACC, vec3(1.0, 0.80, 0.58), smoothstep(0.55, 1.0, zA)) * zA * 2.2 * twA;
    vec3 nightB = BONE * 0.10 + mix(ACC, vec3(1.0, 0.80, 0.58), smoothstep(0.55, 1.0, zB)) * zB * 2.2 * twB;
    vec3 dotA = mix(nightA, dayDot, day);
    vec3 dotB = mix(nightB, dayDot, day);
    float covA = La.x * La.y, covB = Lb.x * Lb.y;
    vec3 dotCol = covB > covA ? dotB : dotA;                               // pick the covering dot; never blend grids
    float cov = max(covA, covB) * vis;
    dotCol = mix(dotCol, ACC * 1.6, edge * 0.85);
    col = mix(col, dotCol, cov);

    // Light-pollution haze on the night side, mip-filtered so it never shimmers.
    float lod = max(0.0, log2(degPerPxIso * uLightsSize / 360.0));
    float haze = textureLod(uLights, toUV(lat, lon), lod).r;
    col += ACC * haze * 0.22 * (1.0 - day) * vis;

    // Destination bloom.
    float dAng = acos(clamp(dot(n, uDest), -1.0, 1.0));
    col += ACC * exp(-dAng * dAng / 0.0009) * uDestGlow * 0.55;

    // Fresnel rim, stronger on the sunlit limb and thinner as the camera comes down.
    float rim = pow(1.0 - ndv, 3.0);
    col += atmoCol * rim * (0.30 + 0.70 * smoothstep(-0.3, 0.6, sunD)) * 0.85 * mix(0.3, 1.0, uAltK);
    return col;
  }

  void main() {
    vec2 p = gl_FragCoord.xy - uCenter;
    vec3 rd = normalize(uCamF * uFocal + uCamR * p.x + uCamU * p.y);
    vec3 ro = uCamPos;
    float b = dot(ro, rd);
    float c = dot(ro, ro) - 1.0;
    float disc = b * b - c;

    float tc = max(-b, 0.0);
    vec3 closest = ro + rd * tc;
    float dist = length(closest);
    vec3 limbN = closest / max(dist, 1e-4);
    float limbLit = smoothstep(-0.45, 0.55, dot(limbN, uSun));
    vec3 atmoCol = mix(ACC * 0.85, mix(AMBER, BONE, 0.35), limbLit);

    // Analytic coverage of the limb, so the horizon is smooth without MSAA.
    float pxOut = (dist - 1.0) * uFocal / max(tc, 1e-3);
    float limbCov = b < 0.0 ? clamp(0.5 - pxOut, 0.0, 1.0) : 0.0;

    vec3 sky = BG, surf = BG;
    if (limbCov < 1.0) {
      vec3 col = BG;
      float over = max(dist - 1.0, 0.0) / uAltK;                       // constant on-screen thickness
      float halo = exp(-over * 16.0) * (0.22 + 0.78 * limbLit) * 0.95 + exp(-over * 3.2) * 0.06;
      float fwd = pow(max(dot(rd, uSun), 0.0), 6.0);                  // forward scatter: sun behind the limb
      halo += exp(-over * 9.0) * fwd * 0.8;
      col += min(mix(atmoCol, vec3(1.0, 0.84, 0.68), fwd * 0.5) * halo, vec3(1.0, 0.86, 0.72));
      col += stars(rd) * (1.0 - clamp(halo * 3.0, 0.0, 1.0)) * smoothstep(0.0, 0.6, uFade);
      sky = col;
    }
    if (limbCov > 0.0) {
      bool hit = disc > 0.0;
      float t = hit ? -b - sqrt(max(disc, 0.0)) : tc;
      vec3 n = hit ? ro + rd * t : limbN;
      surf = shade(n, rd, t, atmoCol);
    }
    vec3 col = mix(sky, surf, limbCov);
    col = mix(BG, col, uFade);
    col += (hash13(vec3(gl_FragCoord.xy, uTime)) - 0.5) / 255.0;       // dither
    outColor = vec4(col, 1.0);
  }`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { bailOut(); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); bailOut(); return; }
  gl.deleteShader(vs); gl.deleteShader(fs);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  ['uCenter', 'uFocal', 'uCamPos', 'uCamR', 'uCamU', 'uCamF', 'uSun', 'uTime', 'uFade', 'uBoot', 'uGrid', 'uPxTarget',
    'uAltK', 'uLightsSize', 'uBootC', 'uDest', 'uDestGlow', 'uLand', 'uLights'].forEach((k) => { U[k] = gl.getUniformLocation(prog, k); });

  /* ---------------------------------------------------------------- camera */
  // Look at surface point `focus` from altitude h, pitched toward the horizon (rad), with `up`
  // as the screen-up hint.
  const cam = { pos: [0, 0, 3], r: [1, 0, 0], u: [0, 1, 0], f: [0, 0, -1], focal: 1, cx: 0, cy: 0 };
  const setCamera = (focus, h, pitch, focal, cx, cy, up) => {
    const n = focus;
    let north = sub(up, mul(n, dot(up, n)));
    north = Math.hypot(north[0], north[1], north[2]) < 1e-6 ? [1, 0, 0] : norm(north);
    const back = add(mul(n, Math.cos(pitch)), mul(north, -Math.sin(pitch)));
    cam.pos = add(n, mul(back, h));
    cam.f = mul(back, -1);
    cam.r = norm(cross(cam.f, north));
    cam.u = cross(cam.r, cam.f);
    cam.focal = focal; cam.cx = cx; cam.cy = cy;
  };
  const project = (P) => {
    const v = sub(P, cam.pos);
    const z = dot(v, cam.f);
    if (z <= 1e-4) return null;
    return { x: cam.cx + cam.focal * dot(v, cam.r) / z, y: cam.cy - cam.focal * dot(v, cam.u) / z, z };
  };
  const occluded = (P) => {
    const v = sub(P, cam.pos);
    const L = Math.hypot(v[0], v[1], v[2]);
    const d = mul(v, 1 / L);
    const b = dot(cam.pos, d);
    const c = dot(cam.pos, cam.pos) - 1;
    const h = b * b - c;
    if (h <= 0) return false;
    const t1 = -b - Math.sqrt(h);
    return t1 > 0 && t1 < L - 1e-3;
  };

  /* ------------------------------------------------------------------- HUD */
  const hud = {};
  overlay.querySelectorAll('[data-hud]').forEach((el) => { hud[el.dataset.hud] = el; });
  const setText = (k, v) => { const el = hud[k]; if (el && el.textContent !== v) el.textContent = v; };
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  setText('fromName', origin.name);
  setText('dist', `${fmt(routeKm)} km`);
  try {
    const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    setText('clock', clock.format(new Date()));
  } catch (e) { /* no Intl time zones */ }

  /* ------------------------------------------------------------ 2D effects */
  const ACC = '255, 90, 31';
  const BONE = '242, 237, 228';
  const PLANE = new Path2D('M12 1.6c.9 0 1.5.9 1.5 2.2v5.1l8.3 4.9v2l-8.3-2.5v5.1l2.3 1.7V22L12 21l-3.8 1v-1.9l2.3-1.7v-5.1L2.2 15.8v-2l8.3-4.9V3.8c0-1.3.6-2.2 1.5-2.2z');
  const mono = (px, weight) => `${weight || 500} ${px}px "Geist Mono", ui-monospace, Menlo, monospace`;
  const PORTAL_R0 = 22;
  let sunW = [0, 0, 1], sunS = [-0.8, 0.48, 0.3];              // world- and camera-space sun
  let lastHeading = 0;

  const drawRoute = (u, alpha) => {
    const STEPS = 160;
    const pts = [];
    for (let i = 0; i <= STEPS; i++) {
      const P = routePoint(i / STEPS);
      const s = project(P);
      // Cull points past the tangent as well as occluded ones, so the trail never folds over the limb.
      pts.push(s && !occluded(P) && dot(P, sub(cam.pos, P)) > 0 ? s : null);
    }
    const head = Math.floor(u * STEPS);
    let tail = head;
    while (tail > 0 && !pts[tail]) tail--;
    while (tail > 0 && pts[tail - 1]) tail--;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.7;
    for (let i = 1; i <= head; i++) {
      const a0 = pts[i - 1], a1 = pts[i];
      if (!a0 || !a1) continue;
      const k = Math.pow(i / Math.max(head, 1), 1.6);
      const e = tail > 0 ? smooth((i - tail) / 10) : 1;        // a cut end fades instead of stopping dead
      ctx.strokeStyle = `rgba(255, 150, 95, ${(0.2 + 0.8 * k) * alpha * e})`;
      ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke();
    }
    ctx.restore();
  };

  const drawPlane = (u, alpha) => {
    const P = routePoint(u);
    const s = project(P);
    if (!s || occluded(P) || alpha <= 0) return;
    const s2 = project(routePoint(Math.min(1, u + 0.003))) || s;
    if (Math.hypot(s2.x - s.x, s2.y - s.y) > 0.3) lastHeading = Math.atan2(s2.y - s.y, s2.x - s.x) + Math.PI / 2;
    const heading = lastHeading;
    const altK = arcAlt(u) / ARC_H;
    const size = Math.min(24, Math.max(12, cam.focal * 0.028 / s.z * 3)) * (1 + 0.25 * altK);
    // Silhouette shadow on the ground: further and softer the higher the plane, gone at night.
    const G = slerp(u), g = project(G), dayK = smooth((dot(G, sunW) + 0.1) / 0.4);
    if (g && !occluded(G) && dayK > 0) {
      const sl = Math.hypot(sunS[0], sunS[1]) || 1, off = 4 + 56 * altK;
      ctx.save();
      ctx.translate(g.x - sunS[0] / sl * off, g.y + sunS[1] / sl * off);
      ctx.rotate(heading);
      ctx.scale(size / 24 * 0.85, size / 24 * 0.85);
      ctx.translate(-12, -12);
      ctx.filter = `blur(${(1 + 2.5 * altK).toFixed(1)}px)`;
      ctx.globalAlpha = alpha * dayK * (0.6 - 0.3 * altK);
      ctx.fillStyle = '#000';
      ctx.fill(PLANE);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(heading);
    ctx.scale(size / 24, size / 24);
    ctx.translate(-12, -12);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3 * 24 / size;
    ctx.strokeStyle = 'rgb(13, 12, 11)';                       // knockout so it reads over lit dots
    ctx.stroke(PLANE);
    ctx.fillStyle = `rgb(${BONE})`;
    ctx.fill(PLANE);
    ctx.restore();
  };

  const drawTag = (x, y, code, name, alpha, align) => {
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const lx = x, ly = y - 26;
    ctx.strokeStyle = `rgba(${BONE}, 0.35)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(lx, ly + 7); ctx.stroke();
    ctx.font = mono(11, 500);
    const t1 = code, t2 = name.toUpperCase();
    const w1 = ctx.measureText(t1).width;
    ctx.font = mono(11, 400);
    const w2 = ctx.measureText(t2).width;
    const pad = 7, gap = 8, w = pad * 2 + w1 + gap + w2, h = 20;
    let bx = align === 'left' ? lx - w + 1 : lx - 1;
    bx = Math.max(12, Math.min(Math.min(W, hudLeft) - 12 - w, bx));   // stay on screen and off the HUD
    const by = ly - h / 2;
    ctx.fillStyle = 'rgba(13,12,11,0.8)';
    ctx.strokeStyle = `rgba(${BONE}, 0.16)`;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, w, h, 4); else ctx.rect(bx, by, w, h);
    ctx.fill(); ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.font = mono(11, 500); ctx.fillStyle = `rgb(${ACC})`;
    ctx.fillText(t1, bx + pad, ly + 0.5);
    ctx.font = mono(11, 400); ctx.fillStyle = `rgba(${BONE}, 0.85)`;
    ctx.fillText(t2, bx + pad + w1 + gap, ly + 0.5);
    ctx.restore();
  };

  // Pin: a dot and a ring. At Waterloo: one touchdown ripple, then the ring gathers into the aperture.
  const drawPin = (V, t, alpha, isDest) => {
    const s = project(V);
    if (!s || occluded(V)) return null;
    ctx.save();
    ctx.globalAlpha = alpha;
    let ringR = 6.5;
    if (isDest) {
      const k = seg(t, T.landed - 0.02, T.landed + 0.5);
      if (k > 0 && k < 1) {
        ctx.strokeStyle = `rgba(${ACC}, ${0.8 * (1 - k)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(s.x, s.y, 6 + 64 * easeOut(k), 0, Math.PI * 2); ctx.stroke();
      }
      ringR = lerp(6.5, PORTAL_R0, easeOutBack(seg(t, T.portal[0] - 0.25, T.portal[0])));
    }
    ctx.fillStyle = `rgb(${ACC})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${BONE}, 0.9)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(s.x, s.y, ringR, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    return s;
  };

  /* ----------------------------------------------- hand-off choreography */
  // Each hero element starts its entrance when the expanding aperture reaches it.
  const HERO_PARTS = ['.hero__eyebrow', '.hero__title .line:nth-child(1) > span', '.hero__title .line:nth-child(2) > span',
    '.hero__tag', '.hero__lede', '.hero__cta', '.hero__proof', '.hero__media', '.hero__frame img'];
  const timeHeroToPortal = (tNow) => {
    const c = frame(1);
    const maxR = Math.hypot(Math.max(c.x, W - c.x), Math.max(c.y, H - c.y)) + 40;
    const dur = T.portal[1] - T.portal[0];
    HERO_PARTS.forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const b = (el.closest('.line') || el.closest('.hero__media') || el).getBoundingClientRect();
      const d = Math.hypot(Math.max(b.left - c.x, 0, c.x - b.right), Math.max(b.top - c.y, 0, c.y - b.bottom));
      const pkHit = d <= PORTAL_R0 ? 0 : Math.min(1, Math.pow(Math.log(d / PORTAL_R0) / Math.log(maxR / PORTAL_R0), 1 / 1.6));
      el.style.animationDelay = `${Math.max(0, T.portal[0] + pkHit * dur - tNow - 0.12).toFixed(3)}s`;
    });
  };
  const clearHeroDelays = () => HERO_PARTS.forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.style.animationDelay = '';
  });

  // The Waterloo dot flies into the hero's "CS @ Waterloo" marker.
  let beaconOn = false;
  const flyBeacon = (from) => {
    const pulse = document.querySelector('.hero__eyebrow .pulse');
    if (!beacon || !pulse) return;
    html.classList.add('beacon-flying');
    const s0 = performance.now(), HOLD = 280, DUR = 700;
    const step = (now) => {
      if (!beacon.isConnected) return;
      const r = pulse.getBoundingClientRect();                  // re-measured: the eyebrow is still rising
      const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
      const k = easeInOut((now - s0 - HOLD) / DUR);
      const mx = lerp(from.x, tx, 0.5), my = Math.min(from.y, ty) - 80;
      const x = (1 - k) * (1 - k) * from.x + 2 * (1 - k) * k * mx + k * k * tx;
      const y = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * my + k * k * ty;
      beacon.style.transform = `translate(${x}px, ${y}px)`;
      beacon.style.opacity = '1';
      if (now - s0 < HOLD + DUR + 250) requestAnimationFrame(step); else dropBeacon();
    };
    requestAnimationFrame(step);
  };

  /* ----------------------------------------------------------- the frame */
  const SUN_BACK = norm([-0.50, 0.55, -0.67]);   // behind the globe: an eclipse crescent, upper left
  const SUN_KEY = norm([-0.80, 0.48, 0.30]);     // cruise: a side key with a visible terminator
  const SUN_DUSK = norm([0.12, 0.30, -0.95]);    // below the horizon ahead: night landing, sunrise on the limb

  let lastT = null;
  let glow = null;                                   // warm light behind the aperture
  const render = (t) => {
    lastT = t;
    const fade = smooth(seg(t, ...T.fadeIn));
    const boot = sineIO(seg(t, ...T.boot));
    const u = smooth(seg(t, ...T.fly));
    const dive = easeInOut(seg(t, ...T.dive));

    // Camera: starts upstream on the route's great circle and decelerates into the flight,
    // leading the plane slightly, then descends and pitches toward the horizon.
    const lead = clamp01(u + 0.07 * Math.sin(Math.PI * u));
    const pre = 0.9 * Math.pow(1 - seg(t, ...T.pre), 2);
    const focus = norm(rotAxis(slerp(lead), AX, -pre));
    const up = upAlong(focus, smooth(seg(t, T.fly[0], T.pitch[0])));
    const approach = lerp(6.5, cruiseH, easeOut(seg(t, 0, 1.3)));
    const hCruise = approach + 0.9 * Math.sin(Math.PI * u) * (omega / Math.PI);
    const h = Math.exp(lerp(Math.log(hCruise), Math.log(stacked ? 0.34 : 0.28), dive));
    const pitch = lerp(0, (stacked ? 46 : 54) * D2R, easeInOut(seg(t, ...T.pitch)));
    const { x: cx, y: cy } = frame(dive);
    // Portal: one exponential scale drives both the dolly and the aperture.
    const pk = seg(t, ...T.portal), PP = Math.pow(pk, 1.6), Z = Math.exp(Math.log(8) * PP);
    setCamera(focus, h / Z, pitch, baseFocal, cx, cy, up);

    let S3 = slerpV(SUN_BACK, SUN_KEY, easeInOut(seg(t, ...T.sunUp)));
    S3 = slerpV(S3, SUN_DUSK, easeInOut(seg(t, ...T.sunDown)));
    const sun = norm(add(add(mul(cam.r, S3[0]), mul(cam.u, S3[1])), mul(cam.f, -S3[2])));
    sunW = sun; sunS = S3;
    arcK = 1 - smooth(seg(t, T.landed - 0.2, T.landed + 0.5));

    // ---- GL pass
    const gw = glCanvas.width, gh = glCanvas.height;
    const sx = gw / W;
    gl.viewport(0, 0, gw, gh);
    gl.uniform2f(U.uCenter, cx * sx, (H - cy) * sx);
    gl.uniform1f(U.uFocal, baseFocal * sx);
    gl.uniform3fv(U.uCamPos, cam.pos);
    gl.uniform3fv(U.uCamR, cam.r);
    gl.uniform3fv(U.uCamU, cam.u);
    gl.uniform3fv(U.uCamF, cam.f);
    gl.uniform3fv(U.uSun, sun);
    gl.uniform1f(U.uTime, t);
    gl.uniform1f(U.uFade, fade);
    gl.uniform1f(U.uBoot, boot);
    gl.uniform3fv(U.uBootC, A);
    gl.uniform1f(U.uGrid, baseGrid);
    gl.uniform1f(U.uPxTarget, 6.2 * sx);
    gl.uniform1f(U.uAltK, Math.min(1, Math.max(0.2, Math.sqrt(Math.max(dot(cam.pos, cam.pos) - 1, 1e-3)) / 3.4)));
    gl.uniform3fv(U.uDest, B);
    gl.uniform1f(U.uDestGlow, (0.35 + 0.65 * smooth(seg(t, T.landed - 0.4, T.landed + 0.4))) * (1 - smooth(pk * 1.4)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // ---- FX pass
    ctx.setTransform(fxDPR, 0, 0, fxDPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const fxA = fade * (1 - smooth(seg(t, T.portal[0], T.portal[0] + 0.35)));
    const routeA = fxA * smooth(seg(t, T.fly[0] - 0.4, T.fly[0] + 0.1));
    if (routeA > 0) drawRoute(u, routeA * (1 - 0.7 * smooth(seg(t, T.landed, T.landed + 0.6))));
    const o = drawPin(A, t, routeA * (1 - smooth(seg(t, T.dive[0], T.dive[0] + 0.6))), false);
    if (o) drawTag(o.x, o.y, origin.code, origin.name, routeA * (1 - smooth(seg(t, T.dive[0] - 0.4, T.dive[0] + 0.2))), ORIGIN_TAG);
    const d = drawPin(B, t, fxA * smooth(seg(t, 0.4, 1.2)), true);
    if (d) drawTag(d.x, d.y, DEST.code, DEST.name, fxA * smooth(seg(t, 0.8, 1.4)), DEST_TAG);
    if (u < 1) drawPlane(u, fxA * smooth(seg(t, T.fly[0] - 0.2, T.fly[0] + 0.15)) * (1 - smooth(seg(t, T.landed - 0.15, T.landed + 0.05))));

    // ---- Portal: the pin's ring becomes an aperture onto the site.
    if (pk > 0) {
      const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 40;
      const r = PORTAL_R0 * Math.exp(Math.log(maxR / PORTAL_R0) * PP);
      overlay.style.setProperty('--px', `${cx}px`);
      overlay.style.setProperty('--py', `${cy}px`);
      overlay.style.setProperty('--pr', `${r}px`);
      overlay.classList.add('is-portal');
      const ringA = 1 - smooth(seg(pk, 0.55, 1));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255, 214, 180, ${0.95 * ringA})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(${ACC}, ${0.28 * ringA})`;
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      if (!beaconOn) { beaconOn = true; flyBeacon({ x: cx, y: cy }); }
      // Behind the overlay (so only visible through the hole): a warm bloom that fades as the
      // site appears, so the first frames of the aperture are light, not an empty black disc.
      if (!glow) {
        glow = document.createElement('div');
        glow.className = 'intro-glow';
        glow.setAttribute('aria-hidden', 'true');
        document.body.appendChild(glow);
      }
      glow.style.setProperty('--px', `${cx}px`);
      glow.style.setProperty('--py', `${cy}px`);
      glow.style.opacity = String((1 - smooth(seg(pk, 0.25, 0.75))) * 0.9);
    }

    // ---- HUD
    const flying = t >= T.fly[0] && t < T.landed;
    setText('dist', flying ? `${fmt(routeKm * (1 - u))} km to go` : `${fmt(routeKm)} km`);
    if (t >= T.landed && !overlay.classList.contains('is-landed')) {
      overlay.classList.add('is-landed');
      if (hud.title) hud.title.innerHTML = 'Welcome to <em>Waterloo</em>.';
    }
    if (t >= T.dive[0] + 0.3 && !overlay.classList.contains('is-diving')) overlay.classList.add('is-diving');
    if (t >= T.portal[0] - 0.45 && !handedOff) { timeHeroToPortal(t); handOff(); }
  };

  /* ------------------------------------------------------------------ loop */
  const ac = new AbortController();
  const on = { signal: ac.signal };
  const texs = [];
  let raf = 0, leaving = false, frozenFrames = 0, dead = false;
  let clock = 0, lastNow = 0, frameBudget = 0;
  const frameTimes = [];
  let ro = null;

  cleanup = () => {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    ac.abort();
    if (ro) ro.disconnect();
    texs.forEach((tx) => gl.deleteTexture(tx));
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    glCanvas.width = glCanvas.height = fx.width = fx.height = 1;
  };
  const finish = () => { overlay.remove(); if (glow) glow.remove(); cleanup(); resolveDone(); };
  const skip = () => {
    if (leaving) return;
    leaving = true;
    if (!handedOff) clearHeroDelays();
    handOff();
    dropBeacon();
    resolveDone();
    overlay.classList.add('is-leaving');
    if (glow) glow.style.opacity = '0';
    setTimeout(finish, 800);
  };

  const loop = (now) => {
    // A pausable clock: a hidden tab resumes where it left off instead of jumping to the end.
    const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0;
    // Adaptive resolution that compares against the display's own frame budget, so a 30 Hz cap
    // (Low Power Mode, energy saver) is not mistaken for a slow GPU.
    if (lastNow && FREEZE === null && frameBudget) {
      const ms = now - lastNow;
      if (ms < 250) frameTimes.push(ms);
      if (frameTimes.length >= 12) {
        const m = frameTimes.slice().sort((a, b) => a - b)[6];
        frameTimes.length = 0;
        if (m > frameBudget * 1.5) {
          if (glScale > 0.6) { glScale *= 0.75; sizeGL(); } else if (clock < T.landed && m > 70) { skip(); return; }
        }
      }
    }
    lastNow = now;
    clock += dt;
    const t = FREEZE !== null ? FREEZE : clock;
    render(t);
    if (FREEZE !== null) {                     // debug stills: draw a few frames, then hold
      if (++frozenFrames < 3) raf = requestAnimationFrame(loop);
      else overlay.classList.add('is-frozen');
      return;
    }
    if (t >= T.end) { finish(); return; }
    if (!leaving) raf = requestAnimationFrame(loop);
  };

  const skipBtn = overlay.querySelector('.intro__skip');
  if (skipBtn) skipBtn.addEventListener('click', (e) => { e.stopPropagation(); skip(); }, on);
  overlay.addEventListener('click', skip, on);
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); skip(); }
  }, on);
  glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); skip(); }, on);

  const relayout = () => { layout(); if (!dead && lastT !== null) render(lastT); };
  layout();
  if ('ResizeObserver' in window) { ro = new ResizeObserver(relayout); ro.observe(overlay); }
  window.addEventListener('resize', relayout, on);   // a devicePixelRatio change doesn't resize the overlay

  const loadTexture = (url, unit, mip) => new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (dead) { resolve(null); return; }
      const tex = gl.createTexture();
      texs.push(tex);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, img);
      if (mip) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      resolve(img.naturalWidth);
    };
    img.onerror = reject;
    img.src = url;
  });

  // Measure the display's frame interval while the textures download (costs ~0 ms).
  const vsyncProbe = new Promise((res) => {
    const d = [];
    let p = 0;
    const f = (n) => {
      if (p) d.push(n - p);
      p = n;
      if (d.length < 12) requestAnimationFrame(f);
      else { d.sort((a, b) => a - b); res(d[3]); }
    };
    requestAnimationFrame(f);
    setTimeout(() => res(16.7), 600);
  }).then((v) => { frameBudget = Math.max(v, 16.7); });

  const bail = setTimeout(bailOut, 3000);
  const fontsReady = (document.fonts && document.fonts.ready)
    ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 400))])
    : Promise.resolve();
  Promise.all([
    loadTexture(glCanvas.dataset.land, 0, false),
    loadTexture(glCanvas.dataset.lights, 1, true),
    fontsReady,
    vsyncProbe,
  ]).then(([, lightsW]) => {
    clearTimeout(bail);
    if (handedOff || dead) return;
    gl.uniform1i(U.uLand, 0);
    gl.uniform1i(U.uLights, 1);
    gl.uniform1f(U.uLightsSize, lightsW || 4096);
    overlay.classList.add('is-ready');
    raf = requestAnimationFrame(loop);
  }).catch(() => { clearTimeout(bail); bailOut(); });
})();
