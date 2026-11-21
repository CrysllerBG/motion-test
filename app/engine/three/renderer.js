// Three.js support. Three is loaded on demand (it's large, and Node never needs it), and one
// WebGL renderer is shared by every 3D layer: each 3D layer renders its own scene into it,
// and the result is copied into the main 2D canvas at that layer's place in the stack.
let THREE = null, loading = null, renderer = null;

export function three() { return THREE; }
export function loadThree() {
  if (THREE) return Promise.resolve(THREE);
  return loading ||= import('../../vendor/three-0.128.0.module.js').then(m => (THREE = m));
}

// Render `scene` through `camera` at W×H and return the WebGL canvas holding the picture.
export function renderToCanvas(scene, camera, W, H) {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);           // transparent: 2D layers behind show through
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
  }
  const c = renderer.domElement;
  if (c.width !== W || c.height !== H) renderer.setSize(W, H, false);
  renderer.render(scene, camera);
  return c;
}
