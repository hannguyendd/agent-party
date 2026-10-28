// The 3D view of the demo office: the pastel "toy diorama" from dashboard/public/office/3d (copied to office/3d by
// scripts/build-site.sh), driven by the same simulation as the 2D map. Loaded on demand when 3D is switched on.
// Asset contract (design/office-style/3d/README.md): 1 unit = 1 tile, Y up, model front = +Z, origin on the floor,
// layout3d.json places every object and wall; characters carry the clips idle, walk, sit, type, sit-idle, talk, wave.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = 'office/3d/';
const EL = 0.86;            // camera elevation (about 49 degrees), as in the approved prototype
const AZ = -0.26;           // start with a slight turn so walls and desks show depth; the visitor can rotate from there
const FACE = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 };

const css = `
.ap3 { position: absolute; inset: 0; }
.ap3 canvas { position: absolute; inset: 0; width: 100% !important; height: 100% !important; outline: none; cursor: pointer; }
.ap3-labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.ap3-tag { position: absolute; left: 0; top: 0; white-space: nowrap; font: 700 var(--tag, 11px)/1.45 Nunito, system-ui, sans-serif; padding: 0 .6em; border-radius: 999px; background: rgba(255, 250, 244, .94); color: #332C4A; box-shadow: inset 0 0 0 1.5px var(--c); will-change: transform; }
.ap3-tag.me { background: #D9663F; color: #fff; box-shadow: none; }
.ap3-bubble { position: absolute; left: 0; top: 0; background: #fff; border-radius: 10px; padding: 6px 8px; box-shadow: 0 0 0 1.5px #332C4A, 0 3px 0 rgba(51, 44, 74, .2); opacity: 0; transition: opacity .2s; will-change: transform; }
.ap3-bubble.on { opacity: 1; }
.ap3-bubble i { display: block; width: 24px; height: 6px; background: url(office/ui/typing.png) 0 0 / 72px 6px; image-rendering: pixelated; animation: dots .9s steps(3) infinite; }
.ap3 canvas.grabbing { cursor: grabbing; }
`;

function modelUrl(name, dirs) { return BASE + dirs[name] + '/' + name + '.glb'; }

// fetch + JSON with two retries (static hosts sometimes drop a request in a burst).
async function fetchJson(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      if (r.status === 404 || attempt >= 2) throw new Error(url + ': HTTP ' + r.status);
    } catch (e) { if (attempt >= 2) throw e; }
    await new Promise((ok) => setTimeout(ok, 300 * (attempt + 1)));
  }
}

// Load many files a few at a time, retrying once; a file that still fails comes back as null.
async function loadAll(loader, urls, onEach, limit = 6) {
  const out = new Array(urls.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < urls.length) {
      const i = next++;
      for (let attempt = 0; attempt < 2 && !out[i]; attempt++) {
        try { out[i] = await loader.loadAsync(urls[i]); } catch (e) { if (attempt) console.warn('3D model failed to load:', urls[i]); }
      }
      if (onEach) onEach();
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

// Every placement of the same model becomes one InstancedMesh per mesh part, so the 1,800 tiles and props draw fast.
function instance(gltfScene, placements) {
  const group = new THREE.Group();
  gltfScene.updateMatrixWorld(true);
  const place = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  gltfScene.traverse((node) => {
    if (!node.isMesh) return;
    const im = new THREE.InstancedMesh(node.geometry, node.material, placements.length);
    placements.forEach((p, i) => {
      q.setFromAxisAngle(up, (p.rot || 0) * Math.PI / 180);
      place.compose(new THREE.Vector3(p.x, p.y || 0, p.z), q, new THREE.Vector3(1, p.sy || 1, 1));
      im.setMatrixAt(i, place.clone().multiply(node.matrixWorld));
    });
    im.castShadow = true; im.receiveShadow = true;
    group.add(im);
  });
  return group;
}

export async function mount(host, office, opts) {
  opts = opts || {};
  const sim = office.sim;
  if (!document.getElementById('ap3-style')) {
    const st = document.createElement('style'); st.id = 'ap3-style'; st.textContent = css; document.head.appendChild(st);
  }
  const root = document.createElement('div'); root.className = 'ap3';
  const labels = document.createElement('div'); labels.className = 'ap3-labels';
  root.append(labels);
  if (opts.hidden) root.hidden = true;
  host.appendChild(root);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); // sharp enough, and much cheaper than 2x+ on big screens
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.insertBefore(renderer.domElement, labels);

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const target = new THREE.Vector3(28, 0, 18);
  // The camera orbits the office centre at angle az (radians), offset by pan when zoomed in.
  let az = AZ, azGoal = AZ;
  const pan = new THREE.Vector3();
  function place(withPan = true) {
    const t = withPan ? target.clone().add(pan) : target;
    cam.position.set(t.x + Math.sin(az) * Math.cos(EL) * 90, Math.sin(EL) * 90, t.z + Math.cos(az) * Math.cos(EL) * 90);
    cam.lookAt(t);
    cam.updateMatrixWorld();
  }
  place();

  scene.add(new THREE.HemisphereLight('#fff4ea', '#d8c9ea', 1.9));
  const sun = new THREE.DirectionalLight('#fff1e0', 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 140 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  sun.position.set(target.x - 16, 34, target.z + 20);
  sun.target.position.copy(target);
  scene.add(sun, sun.target);

  // ---- load the layout and every model it names ----
  const layout = await fetchJson(BASE + 'layout3d.json');
  const loader = new GLTFLoader();
  const dirs = {};
  const want = new Set(layout.objects.map((o) => o.model).concat(layout.walls.map((w) => w.model)));
  // Furniture lives in props/, walls and floors in kit/; models.json (written by scripts/build-site.sh) says which.
  const index = await fetchJson(BASE + 'models.json');
  ['props', 'kit'].forEach((d) => (index[d] || []).forEach((n) => { if (!dirs[n]) dirs[n] = d; }));
  const names = [...want].filter((n) => dirs[n] || console.warn('3D model missing:', n));
  const skinsAll = [...new Set(sim.all.map((a) => a.skin))];
  let done = 0;
  const total = names.length + skinsAll.length;
  const tick = () => { done++; if (opts.onProgress) opts.onProgress(done, total); };
  tick(); done = 0;
  const loaded = {};
  (await loadAll(loader, names.map((n) => modelUrl(n, dirs)), tick)).forEach((g, i) => { if (g) loaded[names[i]] = g; });

  const byModel = {};
  layout.objects.forEach((o) => { (byModel[o.model] = byModel[o.model] || []).push(o); });
  Object.keys(byModel).forEach((name) => { if (loaded[name]) scene.add(instance(loaded[name].scene, byModel[name])); });
  // Walls are grouped by the side they face. The sides turned toward the camera drop low so they don't hide the
  // room (the prototype's cut-away); which sides those are changes as the view rotates.
  const FACING = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] };
  const wallGroups = {};
  Object.keys(FACING).forEach((f) => {
    const g = new THREE.Group(), mine = {};
    layout.walls.filter((w) => w.facing === f).forEach((w) => { (mine[w.model] = mine[w.model] || []).push(w); });
    Object.keys(mine).forEach((name) => { if (loaded[name]) g.add(instance(loaded[name].scene, mine[name])); });
    scene.add(g); wallGroups[f] = g;
  });
  function cutaway(step) {
    const cx = Math.sin(az), cz = Math.cos(az);
    Object.keys(FACING).forEach((f) => {
      const dot = FACING[f][0] * cx + FACING[f][1] * cz;
      const want = dot > 0.2 ? 0.22 : 1, g = wallGroups[f];
      g.scale.y += (want - g.scale.y) * step;
    });
  }
  cutaway(1);

  // ---- characters, one per simulated agent, plus the visitor ----
  const skins = [...new Set(sim.all.map((a) => a.skin))];
  const charGltf = {};
  (await loadAll(loader, skins.map((s) => BASE + 'characters/' + s + '.glb'), tick)).forEach((g, i) => { if (g) charGltf[skins[i]] = g; });
  const anyChar = Object.values(charGltf)[0];
  if (!anyChar) throw new Error('no 3D characters loaded');
  const actors = sim.all.map((a) => {
    const g = charGltf[a.skin] || anyChar;
    const obj = g.scene.clone(true);
    obj.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    scene.add(obj);
    const mixer = new THREE.AnimationMixer(obj);
    const clips = {};
    g.animations.forEach((c) => { clips[c.name] = mixer.clipAction(c); });
    const height = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()).y || 1.6;
    const tag = document.createElement('span'); tag.className = 'ap3-tag' + (a.isPlayer ? ' me' : ''); tag.textContent = a.label || a.id; tag.style.setProperty('--c', a.c);
    const bub = document.createElement('span'); bub.className = 'ap3-bubble'; bub.innerHTML = '<i></i>';
    labels.append(tag, bub);
    return { a, obj, mixer, clips, current: null, height, tag, bub, yaw: FACE[a.face] || 0 };
  });

  function play(act, name) {
    const next = act.clips[name] || act.clips.idle;
    if (!next || act.current === next) return;
    next.reset().fadeIn(0.18).play();
    if (act.current) act.current.fadeOut(0.18);
    act.current = next;
  }
  function clipFor(a) {
    if (a.isPlayer) return a.mode === 'walk' ? 'walk' : a.hiWith ? 'wave' : 'idle';
    if (a.withPlayer) return a.mode === 'sit' ? 'sit-idle' : 'talk';
    if (a.mode === 'walk') return 'walk';
    if (a.mode === 'sit') return a.busy ? 'sit-idle' : 'type';
    if (a.mode === 'talk' || a.busy) return 'talk';
    return 'idle';
  }

  // ---- fit the whole office in the frame ----
  const corners = [];
  for (const x of [0, 56]) for (const y of [0, 2.5]) for (const z of [0, 36]) corners.push(new THREE.Vector3(x, y, z));
  // size: the canvas size in px, measured on resize only (reading layout every frame is costly).
  const size = { w: 1, h: 1 };
  function resize() {
    size.w = host.clientWidth || 1; size.h = host.clientHeight || 1;
    renderer.setSize(size.w, size.h, false);
    labels.style.setProperty('--tag', Math.max(9, Math.min(13, size.w / 95)) + 'px');
    fit();
  }
  // Frame the whole office for the current rotation (cheap: no canvas resize).
  function fit() {
    const aspect = size.w / size.h;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    place(false); // frame the whole office from the unpanned camera
    const inv = cam.matrixWorldInverse.clone();
    place();
    corners.forEach((c) => { const p = c.clone().applyMatrix4(inv); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    let halfW = (maxX - minX) / 2 * 1.02, halfH = (maxY - minY) / 2 * 1.02;
    if (halfW / halfH > aspect) halfH = halfW / aspect; else halfW = halfH * aspect;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    Object.assign(cam, { left: cx - halfW, right: cx + halfW, top: cy + halfH, bottom: cy - halfH });
    cam.updateProjectionMatrix();
  }
  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host); else addEventListener('resize', resize);

  // ---- the floor under the pointer; click walks there, drag pans, wheel zooms ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const canvas = renderer.domElement;
  function groundAt(x, y) {
    const r = canvas.getBoundingClientRect(), out = new THREE.Vector3();
    ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    return ray.ray.intersectPlane(ground, out) ? out : null;
  }
  function shift(dx, dz) {
    // keep the office in view: the further in, the further you may pan
    const k = 1 - 1 / cam.zoom;
    pan.x = Math.max(-28 * k, Math.min(28 * k, pan.x + dx));
    pan.z = Math.max(-18 * k, Math.min(18 * k, pan.z + dz));
    place();
  }
  function zoomAt(f, x, y) {
    const before = groundAt(x, y);
    cam.zoom = Math.max(1, Math.min(5, cam.zoom * f));
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    if (cam.zoom === 1) { pan.set(0, 0, 0); place(); return; }
    const after = groundAt(x, y);
    if (before && after) shift(before.x - after.x, before.z - after.z);
  }
  function center() { const r = canvas.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
  // Drag rotates; right-drag or Shift+drag pans (when zoomed in) and stops following the player.
  let down = null, dragged = false, rotating = false, follow = false;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY }; dragged = false;
    rotating = !(e.button === 2 || e.shiftKey);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    if (!dragged && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) return;
    if (!dragged) { dragged = true; canvas.classList.add('grabbing'); }
    if (rotating) {
      az -= (e.clientX - down.x) * 0.008; azGoal = az; place(); fit();
    } else {
      const a = groundAt(down.x, down.y), b = groundAt(e.clientX, e.clientY);
      if (a && b && cam.zoom > 1) { follow = false; if (opts.onFollow) opts.onFollow(false); shift(a.x - b.x, a.z - b.z); }
    }
    down = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', () => { down = null; canvas.classList.remove('grabbing'); });
  canvas.addEventListener('click', (e) => {
    if (dragged) { dragged = false; return; }
    const hit = groundAt(e.clientX, e.clientY);
    if (!hit) return;
    const tx = Math.floor(hit.x), ty = Math.floor(hit.z);
    if (tx < 0 || ty < 0 || tx >= 56 || ty >= 36) return;
    sim.spawn();
    sim.walkPlayerTo(tx, ty);
  });

  let active = !opts.hidden, last = performance.now();
  const v = new THREE.Vector3();
  const view = {
    draw() {
      if (!active) return;
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (Math.abs(azGoal - az) > 0.001) { az += (azGoal - az) * Math.min(1, dt * 7); place(); fit(); }
      // WASD follows the camera, snapped to the grid's four directions.
      sim.inputTurn = -Math.round(az / (Math.PI / 2)) * (Math.PI / 2);
      cutaway(Math.min(1, dt * 8));
      // Follow: keep the visitor's character in the middle while zoomed in.
      const me = sim.player;
      if (follow && me.active && cam.zoom > 1) {
        const k = Math.min(1, dt * 5);
        shift((me.x - target.x - pan.x) * k, (me.y - target.z - pan.z) * k);
      }
      const w = size.w, h = size.h;
      actors.forEach((act) => {
        const a = act.a, shown = !a.isPlayer || a.active;
        if (shown !== act.shown) {
          act.shown = shown; act.obj.visible = shown; act.tag.style.display = shown ? '' : 'none';
          if (!shown) act.bub.classList.remove('on');
        }
        if (!shown) return;
        act.obj.position.set(a.x, 0, a.y);
        // turn smoothly toward where the agent faces
        let want = FACE[a.face] != null ? FACE[a.face] : act.yaw;
        let d = want - act.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        act.yaw += d * Math.min(1, dt * 12);
        act.obj.rotation.y = act.yaw;
        play(act, clipFor(a));
        act.mixer.update(dt);
        v.set(a.x, act.height + 0.15, a.y).project(cam);
        const sx = Math.round((v.x + 1) / 2 * w), sy = Math.round((1 - v.y) / 2 * h);
        if (sx !== act.sx || sy !== act.sy) {
          act.sx = sx; act.sy = sy;
          act.tag.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
          act.bub.style.transform = `translate(${sx}px, ${sy - 22}px) translate(-50%, -100%)`;
        }
        const bubble = !!a.bubble;
        if (bubble !== act.bubble) { act.bubble = bubble; act.bub.classList.toggle('on', bubble); }
      });
      renderer.render(scene, cam);
    },
    setActive(on) { active = on; root.hidden = !on; if (!on) sim.inputTurn = 0; if (on) { last = performance.now(); resize(); } },
    zoomBy(f) { const c = center(); zoomAt(f, c[0], c[1]); },
    resetZoom() { cam.zoom = 1; cam.updateProjectionMatrix(); pan.set(0, 0, 0); azGoal = AZ + Math.round((az - AZ) / (2 * Math.PI)) * 2 * Math.PI; place(); },
    setFollow(on) { follow = on; },
    rotate(dir) { azGoal = Math.round((azGoal - AZ) / (Math.PI / 2)) * (Math.PI / 2) + AZ + dir * Math.PI / 2; },
  };
  office.addView(view);
  if (opts.onReady) opts.onReady();
  return view;
}
