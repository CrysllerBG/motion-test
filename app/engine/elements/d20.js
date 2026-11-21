// A 3D twenty-sided die, rendered with Three.js (ported from reference/dungeon-roller-v2.html).
//
// 3D shapes are hard to describe in JSON, so the die itself lives in this code module, and
// everything you'd want to change over time is an ordinary prop that tracks can animate:
//   tumble 0 → 1   the die spins `turns` times and comes to rest showing `face`
//   glow           the landed face's number lights up
//   wobble, roll   a settle after landing; a tilt of the resting die
// The picture is still a pure function of t: orientation is computed from `tumble`, never
// accumulated frame by frame.
import { loadThree, three, renderToCanvas } from '../three/renderer.js';
import { mulberry } from '../random.js';

const cache = new Map();     // per layer id: its scene, camera, lights and die
let shared = null;           // geometry + face numbering, the same for every die

function buildShared(THREE) {
  const geo = new THREE.IcosahedronGeometry(1, 0);          // 20 faces × 3 vertices, flat-shaded
  const pos = geo.attributes.position;
  const V = i => new THREE.Vector3().fromBufferAttribute(pos, i);
  const faces = [];
  for (let f = 0; f < pos.count / 3; f++) {
    const a = V(3 * f), b = V(3 * f + 1), c = V(3 * f + 2);
    const centroid = a.clone().add(b).add(c).divideScalar(3);
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    faces.push({ a, normal: centroid.clone().normalize(), ccw: n.dot(centroid) > 0, num: 0 });
  }
  // Opposite faces sum to 21, like a real die. Face 0 becomes the 20.
  const opposite = f => faces.findIndex(g => g !== f && g.normal.dot(f.normal) < -0.999);
  faces[0].num = 20; faces[opposite(faces[0])].num = 1;
  let next = 2;
  for (const f of faces) { if (f.num) continue; f.num = next; faces[opposite(f)].num = 21 - next; next++; }
  // Texture atlas: 5 × 4 cells, one number per cell. Vertex a always gets the cell's top corner.
  const COLS = 5, ROWS = 4, TRI = { top: [0.5, 0.92], bl: [0.06, 0.17], br: [0.94, 0.17] };
  const uv = new Float32Array(pos.count * 2);
  faces.forEach((f, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const toUV = ([x, y]) => [(col + x) / COLS, 1 - (row + 1 - y) / ROWS];
    (f.ccw ? [TRI.top, TRI.bl, TRI.br] : [TRI.top, TRI.br, TRI.bl]).forEach((pt, k) => { const [u, v] = toUV(pt); uv[(3 * i + k) * 2] = u; uv[(3 * i + k) * 2 + 1] = v; });
  });
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // The resting orientation for each number: that face toward the camera, its top corner up.
  const targets = {};
  for (const f of faces) {
    const fwd = f.normal.clone();
    const up = f.a.clone().sub(fwd.clone().multiplyScalar(f.a.dot(fwd))).normalize();
    const right = up.clone().cross(fwd);
    const basis = new THREE.Matrix4().makeBasis(right, up, fwd);
    targets[f.num] = new THREE.Quaternion().setFromRotationMatrix(basis.clone().transpose());
  }
  return { geo, faces, targets, COLS, ROWS };
}

// Paint the numbers: a colour map (resin + gold numbers) and a glow map (which numbers light up).
function drawAtlas(THREE, P) {
  const { faces, COLS, ROWS } = shared, CELL = 256;
  const color = document.createElement('canvas'), glow = document.createElement('canvas');
  color.width = glow.width = COLS * CELL; color.height = glow.height = ROWS * CELL;
  const g = color.getContext('2d'), e = glow.getContext('2d'), rng = mulberry(5);
  g.fillStyle = P.color; g.fillRect(0, 0, color.width, color.height);
  for (let k = 0; k < 160; k++) {                                   // marbled resin swirls
    const x = rng() * color.width, y = rng() * color.height, r = 20 + rng() * 90;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const tone = rng() < 0.5 ? '0,0,0' : '255,255,255';
    grd.addColorStop(0, `rgba(${tone},0.12)`); grd.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = grd; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  e.fillStyle = '#000'; e.fillRect(0, 0, glow.width, glow.height);
  g.textAlign = e.textAlign = 'center'; g.textBaseline = e.textBaseline = 'middle';
  g.font = e.font = `96px "${P.font}", "Palatino Linotype", Georgia, serif`;
  faces.forEach((f, i) => {
    const cx = (i % COLS + 0.5) * CELL, cy = (Math.floor(i / COLS) + 1 - 0.42) * CELL;
    const label = f.num === 6 || f.num === 9 ? f.num + '.' : String(f.num);   // 6. and 9. so they can't be confused
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(label, cx + 3, cy + 4);       // engraved shadow
    g.fillStyle = P.ink; g.fillText(label, cx, cy);
    e.fillStyle = f.num === P.face ? P.glowColor : '#2a1e0c';                 // the landing face glows fully
    e.fillText(label, cx, cy);
  });
  const mk = cv => { const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; };
  return { map: mk(color), glowMap: mk(glow) };
}

function build(THREE) {
  shared ||= buildShared(THREE);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 60);
  camera.position.set(0, 0, 7); camera.lookAt(0, 0, 0);
  const mat = new THREE.MeshPhysicalMaterial({ emissive: 0xffffff, roughness: 0.42, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 });
  const die = new THREE.Mesh(shared.geo, mat);
  die.castShadow = true;
  scene.add(die);
  const ambient = new THREE.AmbientLight(0x2a1a10, 0.3); scene.add(ambient);
  // Warm key light from the front-left: lights the face we see and throws the shadow
  const key = new THREE.SpotLight(0xffc996, 1, 30, 0.45, 0.9, 1);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0006;
  key.shadow.camera.near = 2; key.shadow.camera.far = 25;
  scene.add(key, key.target);
  // Cool rim light from behind-right: separates the die's edges from a dark background
  const rim = new THREE.DirectionalLight(0x6f86c8, 0.55); rim.position.set(3, 3, -4); scene.add(rim);
  // Two warm "torch" lights at the sides
  const warmL = new THREE.PointLight(0xff9a4d, 0, 11, 2), warmR = new THREE.PointLight(0xff9a4d, 0, 11, 2);
  scene.add(warmL, warmR);
  // An invisible wall behind the die that only shows shadows, so the shadow lands on whatever
  // 2D layers are behind this one
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), new THREE.ShadowMaterial({ opacity: 0.5 }));
  catcher.receiveShadow = true; scene.add(catcher);
  return { scene, camera, die, mat, key, rim, warmL, warmR, ambient, catcher, atlasKey: null, q: { A: new THREE.Quaternion(), B: new THREE.Quaternion(), W: new THREE.Quaternion(), R: new THREE.Quaternion() } };
}

const AX1 = [0.6, 1, 0.25], AX2 = [1, -0.3, 0.5];

export default {
  label: '3D die (D20)',
  props: {
    x:         { type: 'number', default: 50, min: -50, max: 150, step: 0.1, help: 'centre, % of width' },
    y:         { type: 'number', default: 45, min: -50, max: 150, step: 0.1, help: 'centre, % of height' },
    size:      { type: 'number', default: 18, min: 1, max: 80, step: 0.1, help: 'diameter, % of width' },
    tumble:    { type: 'number', default: 1, min: 0, max: 1, step: 0.001, help: '0 = spinning in the air, 1 = landed. Animate it to roll the die' },
    turns:     { type: 'number', default: 3, min: 0, max: 20, step: 0.1, help: 'how many times it spins before landing' },
    face:      { type: 'number', default: 20, min: 1, max: 20, step: 1, help: 'the number it lands on' },
    wobble:    { type: 'number', default: 0, min: -45, max: 45, step: 0.1, help: 'rock forward/back, degrees (animate to settle after landing)' },
    roll:      { type: 'number', default: 0, min: -180, max: 180, step: 0.5, help: 'turn the die in the picture plane, degrees' },
    depth:     { type: 'number', default: 0, min: -5, max: 5, step: 0.01, help: 'toward (+) / away from (−) the camera' },
    glow:      { type: 'number', default: 0, min: 0, max: 1, step: 0.01, help: 'the landed number lights up' },
    glowColor: { type: 'color', default: '#ffc770' },
    color:     { type: 'color', default: '#7d1016', help: 'resin colour' },
    ink:       { type: 'color', default: '#e8c477', help: 'number colour' },
    font:      { type: 'font', default: 'IM Fell English' },
    keyLight:  { type: 'number', default: 1.6, min: 0, max: 5, step: 0.01, help: 'main light from the front-left' },
    rimLight:  { type: 'number', default: 0.55, min: 0, max: 3, step: 0.01, help: 'cool edge light from behind' },
    warmLight: { type: 'number', default: 0.6, min: 0, max: 5, step: 0.01, help: 'warm side lights, like torches' },
    shadow:    { type: 'number', default: 0.5, min: 0, max: 1, step: 0.01, help: 'darkness of the shadow on the wall behind' }
  },
  prepare: () => loadThree(),
  paint(ctx, P, env, node) {
    const THREE = three();
    if (!THREE) return;                       // prepare() hasn't finished: nothing to draw yet
    const { W, H } = env;
    let s = cache.get(node.src.id);
    if (!s) { s = build(THREE); cache.set(node.src.id, s); }
    const face = Math.min(20, Math.max(1, Math.round(P.face)));

    // Repaint the numbers only when their look changes
    const atlasKey = [P.color, P.ink, P.font, face, P.glowColor].join('|');
    if (s.atlasKey !== atlasKey) {
      const { map, glowMap } = drawAtlas(THREE, { ...P, face });
      s.mat.map?.dispose(); s.mat.emissiveMap?.dispose();
      s.mat.map = map; s.mat.emissiveMap = glowMap; s.mat.needsUpdate = true;
      s.atlasKey = atlasKey;
    }

    // Screen position (% of frame) → a point on the plane the camera looks at
    s.camera.aspect = W / H; s.camera.updateProjectionMatrix();
    const halfH = 7 * Math.tan(THREE.MathUtils.degToRad(17.5)), halfW = halfH * W / H;
    const wx = (P.x / 100 * 2 - 1) * halfW, wy = -(P.y / 100 * 2 - 1) * halfH;
    s.die.position.set(wx, wy, P.depth);
    s.die.scale.setScalar(P.size / 100 * halfW);

    // Orientation = resting pose × the spin still to go. At tumble = 1 the spin is zero,
    // so the die always comes to rest exactly on `face`.
    const spin = (1 - Math.min(1, Math.max(0, P.tumble))) * P.turns * Math.PI * 2;
    s.q.A.setFromAxisAngle(new THREE.Vector3(...AX1).normalize(), spin);
    s.q.B.setFromAxisAngle(new THREE.Vector3(...AX2).normalize(), spin * 0.37);
    s.die.quaternion.copy(shared.targets[face]).multiply(s.q.A).multiply(s.q.B);
    s.q.W.setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(P.wobble));
    s.q.R.setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(P.roll));
    s.die.quaternion.premultiply(s.q.W).premultiply(s.q.R);

    // Lights follow the die so it looks the same wherever it sits in the frame
    s.key.position.set(wx - 3.2, wy + 3.4, 6.5); s.key.target.position.set(wx, wy, 0); s.key.intensity = P.keyLight;
    s.rim.intensity = P.rimLight;
    s.warmL.position.set(wx - 3.6, wy - 0.2, 0.4); s.warmR.position.set(wx + 3.6, wy - 0.2, 0.4);
    s.warmL.intensity = s.warmR.intensity = 2.6 * P.warmLight;
    s.mat.emissiveIntensity = 0.35 + 2.2 * P.glow;
    s.catcher.position.set(0, 0, P.depth - 1.25);
    s.catcher.material.opacity = P.shadow;
    s.catcher.visible = P.shadow > 0;

    ctx.drawImage(renderToCanvas(s.scene, s.camera, W, H), 0, 0, W, H);
  }
};
