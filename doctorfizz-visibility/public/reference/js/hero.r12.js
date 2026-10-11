/* Hero scene: "the index field".
   A lattice of points receding into depth, one point per notional result. The near rows carry
   the brand colour and fade out with distance, which is the thing the tool measures. A scan
   wave travels through it, and a completed check pulses the depth band matching the position.

   Loaded only after first paint, only on capable devices, and never when reduced motion is set. */

// Resolved against this module's own URL, so the subfolder never has to be known here.
import * as THREE from '../vendor/three.module.min.js';

const COLS = 46;
const ROWS = 64;
const SPACING_X = 1.5;
const SPACING_Z = 1.7;

let renderer, scene, camera, points, material, raf = 0, running = false;
let pointer = { x: 0, y: 0 }, target = { x: 0, y: 0 };
const clock = new THREE.Clock();

const VERT = `
  attribute float aRank;
  attribute float aSeed;
  uniform float uTime;
  uniform float uMark;
  uniform float uMarkAt;
  varying float vRank;
  varying float vLift;
  varying float vMark;

  void main() {
    vRank = aRank;
    vec3 p = position;

    float wave = sin(p.x * 0.18 + uTime * 0.55) * cos(p.z * 0.13 - uTime * 0.38);
    float breathe = sin(uTime * 0.7 + aSeed * 6.2831) * 0.22;
    p.y += wave * 1.15 + breathe;

    // A scan pulse travelling away from the camera through the field.
    float scan = smoothstep(0.0, 1.0, 1.0 - abs(mod(uTime * 7.0, 120.0) + p.z) / 7.0);
    p.y += scan * 1.5;
    vLift = scan;

    // Depth band highlighted after a completed check.
    float band = uMark > 0.0
      ? smoothstep(3.0, 0.0, abs(-p.z - uMark)) * max(0.0, 1.0 - (uTime - uMarkAt) * 0.35)
      : 0.0;
    p.y += band * 2.2;
    vMark = band;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (58.0 / -mv.z) * (1.0 + scan * 0.7 + band * 1.4);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = `
  precision mediump float;
  uniform vec3 uRust;
  uniform vec3 uEmber;
  uniform vec3 uCool;
  varying float vRank;
  varying float vLift;
  varying float vMark;

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.06, d);

    // Near rows carry the brand colour, distant rows cool off into the background.
    vec3 col = mix(uRust, uCool, clamp(vRank, 0.0, 1.0));
    col = mix(col, uEmber, vLift * 0.85 + vMark);

    float alpha = soft * (0.16 + (1.0 - vRank) * 0.6 + vLift * 0.5 + vMark * 0.9);
    gl_FragColor = vec4(col, alpha);
  }
`;

function buildField() {
  const count = COLS * ROWS;
  const pos   = new Float32Array(count * 3);
  const rank  = new Float32Array(count);
  const seed  = new Float32Array(count);

  let i = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      pos[i * 3]     = (c - COLS / 2) * SPACING_X;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = -r * SPACING_Z;
      rank[i] = r / ROWS;
      seed[i] = Math.random();
      i++;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRank', new THREE.BufferAttribute(rank, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  return geo;
}

function onPointer(ev) {
  const t = ev.touches ? ev.touches[0] : ev;
  if (!t) { return; }
  target.x = (t.clientX / window.innerWidth - 0.5) * 2;
  target.y = (t.clientY / window.innerHeight - 0.5) * 2;
}

function resize(canvas) {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
}

function loop() {
  if (!running) { return; }
  raf = requestAnimationFrame(loop);

  material.uniforms.uTime.value = clock.getElapsedTime();

  pointer.x += (target.x - pointer.x) * 0.045;
  pointer.y += (target.y - pointer.y) * 0.045;

  camera.position.x = pointer.x * 3.4;
  camera.position.y = 7.5 - pointer.y * 1.6;
  camera.lookAt(0, 0, -34);

  renderer.render(scene, camera);
}

export function init(canvas) {
  if (!canvas) { return null; }

  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0B0908, 0.022);

  camera = new THREE.PerspectiveCamera(58, 1, 0.1, 240);
  camera.position.set(0, 7.5, 14);

  material = new THREE.ShaderMaterial({
    uniforms: {
      uTime:   { value: 0 },
      uMark:   { value: 0 },
      uMarkAt: { value: 0 },
      uRust:   { value: new THREE.Color(0xCA5322) },
      uEmber:  { value: new THREE.Color(0xFF9A5E) },
      uCool:   { value: new THREE.Color(0x2A2320) }
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  points = new THREE.Points(buildField(), material);
  scene.add(points);

  resize(canvas);
  const onResize = () => resize(canvas);
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('touchmove', onPointer, { passive: true });

  // Stop rendering when the tab is hidden or the hero is scrolled away. No point burning
  // a phone battery to animate something nobody is looking at.
  const onVisibility = () => { if (document.hidden) stop(); else start(); };
  document.addEventListener('visibilitychange', onVisibility);

  let observer;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.isIntersecting ? start() : stop(); });
    }, { threshold: 0.02 });
    observer.observe(canvas);
  }

  canvas.classList.add('ready');
  start();

  window.DFHero = {
    destroy: function () {
      stop(); observer?.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('touchmove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      points.geometry.dispose(); material.dispose(); renderer.dispose();
      renderer = null; canvas.classList.remove('ready');
    },
    mark: function (position) {
      if (!material) { return; }
      material.uniforms.uMark.value = position > 0 ? Math.min(position, 50) * SPACING_Z * 0.9 : 0;
      material.uniforms.uMarkAt.value = clock.getElapsedTime();
    }
  };

  return window.DFHero;
}

function start() {
  if (running || !renderer) { return; }
  running = true;
  loop();
}

function stop() {
  running = false;
  cancelAnimationFrame(raf);
}
