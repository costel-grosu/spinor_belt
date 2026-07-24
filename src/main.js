import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CONFIG, VIEW_COPY } from "./config.js";
import { VIEW_CLASSES } from "./visualizations.js";

const canvas = document.querySelector("#scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(CONFIG.background);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.xr.enabled = true;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(CONFIG.background, 10, 18);
const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, CONFIG.camera.near, CONFIG.camera.far);
camera.position.fromArray(CONFIG.camera.position);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 4.5;
controls.maxDistance = 13;
controls.target.set(1.25, 0, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa49e, 2.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
keyLight.position.set(4, 7, 5);
scene.add(keyLight);
const floor = new THREE.Mesh(new THREE.CircleGeometry(4.3, 64), new THREE.MeshBasicMaterial({ color: 0xdcd9cf, transparent: true, opacity: 0.32 }));
floor.rotation.x = -Math.PI / 2;
floor.position.set(1.4, -2.18, 0);
scene.add(floor);

const ui = {
  title: document.querySelector("#view-title"), copy: document.querySelector("#view-copy"), kicker: document.querySelector("#view-kicker"),
  angle: document.querySelector("#angle-value"), slider: document.querySelector("#angle-slider"), pause: document.querySelector("#pause-button"),
  speed: document.querySelector("#speed-value"), speedSlider: document.querySelector("#speed-slider"),
  flagCount: document.querySelector("#flag-count-value"), flagCountSlider: document.querySelector("#flag-count-slider"),
  flagCountControl: document.querySelector("#flag-count-control"),
  shellOptions: document.querySelector("#shell-options"),
  shellMode: document.querySelector("#shell-mode"), shellAxis: document.querySelector("#shell-axis"),
  shellWire: document.querySelector("#shell-wire-slider"), shellWireValue: document.querySelector("#shell-wire-value"), shellWireLabel: document.querySelector("#shell-wire-label"),
  shellSamples: document.querySelector("#shell-sample-slider"), shellSampleValue: document.querySelector("#shell-sample-value"),
  shellInner: document.querySelector("#shell-inner-slider"), shellInnerValue: document.querySelector("#shell-inner-value"),
  shellOuter: document.querySelector("#shell-outer-slider"), shellOuterValue: document.querySelector("#shell-outer-value"),
  shellShowInner: document.querySelector("#shell-show-inner"), shellShowOuter: document.querySelector("#shell-show-outer"),
  shellShowShells: document.querySelector("#shell-show-shells"), shellShowEndpoints: document.querySelector("#shell-show-endpoints"),
  shellInnerOpaque: document.querySelector("#shell-inner-opaque"), shellSideTubes: document.querySelector("#shell-side-tubes"),
  render: document.querySelector("#render-button"), reset: document.querySelector("#reset-button"), random: document.querySelector("#random-button"), vr: document.querySelector("#vr-button"),
};

const flagCounts = [6, CONFIG.samples, CONFIG.samples * 2, CONFIG.samples * 4];
let selectedFlagCount = CONFIG.samples;
const shellOptions = {
  wireCount: 12,
  radialSamples: 81,
  innerRadius: 0.2,
  outerRadius: 2.35,
  axis: "z",
  mode: "nonsingular",
  showInner: true,
  showOuter: true,
  showShells: false,
  showEndpoints: false,
  innerOpaque: true,
  sideTubes: true,
};
let currentKey = "flags";
let currentView = new VIEW_CLASSES[currentKey]({ flagCount: selectedFlagCount });
let angle = 0;
let rotationSpeed = CONFIG.simulationSpeed;
let paused = false;
let rendering = true;
let lastTime = 0;
currentView.group.position.x = 1.35;
scene.add(currentView.group);

function replaceView(key, { preserveAxis = false } = {}) {
  const axis = preserveAxis ? currentView.axis?.toArray() : undefined;
  scene.remove(currentView.group);
  currentView.dispose();
  currentKey = key;
  currentView = new VIEW_CLASSES[key]({
    flagCount: selectedFlagCount,
    axis,
    ...(key === "shells" ? shellOptions : {}),
  });
  currentView.group.position.x = 1.35;
  scene.add(currentView.group);
  currentView.update(angle);
}

function selectView(key) {
  if (!VIEW_CLASSES[key] || key === currentKey) return;
  angle = 0;
  ui.slider.value = "0";
  replaceView(key);
  const copy = VIEW_COPY[key];
  ui.kicker.textContent = copy.kicker;
  ui.title.textContent = copy.title;
  ui.copy.textContent = copy.copy;
  ui.random.classList.toggle("hidden", key === "flags");
  ui.random.textContent = key === "belt"
    ? "Regenerate spinors"
    : key === "wires" ? "Toggle initial flip"
      : key === "shells" ? "New S³ circle" : "New SU(2)";
  ui.flagCountControl.classList.toggle(
    "hidden",
    key === "belt" || key === "wires" || key === "shells",
  );
  ui.shellOptions.classList.toggle("hidden", key !== "shells");
  ui.shellAxis.disabled = shellOptions.mode === "random";
  ui.shellWireLabel.textContent = shellOptions.sideTubes ? "Tubes" : "Wires";
  document.querySelectorAll(".view-tab").forEach((button) => button.classList.toggle("active", button.dataset.view === key));
}

document.querySelectorAll(".view-tab").forEach((button) => button.addEventListener("click", () => selectView(button.dataset.view)));
ui.pause.addEventListener("click", () => { paused = !paused; ui.pause.textContent = paused ? "Resume" : "Pause"; });
ui.render.addEventListener("click", () => {
  rendering = !rendering;
  ui.render.textContent = rendering ? "Stop rendering" : "Start rendering";
  if (rendering) { lastTime = performance.now(); renderer.setAnimationLoop(animate); }
  else renderer.setAnimationLoop(null);
});
ui.reset.addEventListener("click", () => { angle = 0; ui.slider.value = "0"; currentView.update(angle); });
ui.random.addEventListener("click", () => {
  if (currentKey === "shells") {
    shellOptions.mode = "random";
    ui.shellMode.value = "random";
    ui.shellAxis.disabled = true;
  }
  currentView.randomize?.(angle);
});
ui.slider.addEventListener("input", () => { angle = Number(ui.slider.value); paused = true; ui.pause.textContent = "Resume"; currentView.update(angle); });
ui.speedSlider.addEventListener("input", () => {
  rotationSpeed = Number(ui.speedSlider.value);
  ui.speed.textContent = `${rotationSpeed}°/s`;
});
ui.flagCountSlider.addEventListener("input", () => {
  selectedFlagCount = flagCounts[Number(ui.flagCountSlider.value)];
  ui.flagCount.textContent = String(selectedFlagCount);
  if (currentKey !== "belt") replaceView(currentKey, { preserveAxis: true });
});

function updateShellOptions(changes) {
  Object.assign(shellOptions, changes);
  ui.shellAxis.disabled = shellOptions.mode === "random";
  ui.shellWireLabel.textContent = shellOptions.sideTubes ? "Tubes" : "Wires";
  if (currentKey === "shells") currentView.setOptions?.(changes, angle);
}

ui.shellMode.addEventListener("change", () =>
  updateShellOptions({ mode: ui.shellMode.value }));
ui.shellAxis.addEventListener("change", () =>
  updateShellOptions({ axis: ui.shellAxis.value }));
ui.shellWire.addEventListener("input", () => {
  ui.shellWireValue.textContent = ui.shellWire.value;
});
ui.shellWire.addEventListener("change", () =>
  updateShellOptions({ wireCount: Number(ui.shellWire.value) }));
ui.shellSamples.addEventListener("input", () => {
  ui.shellSampleValue.textContent = ui.shellSamples.value;
});
ui.shellSamples.addEventListener("change", () =>
  updateShellOptions({ radialSamples: Number(ui.shellSamples.value) }));
ui.shellInner.addEventListener("input", () => {
  ui.shellInnerValue.textContent = Number(ui.shellInner.value).toFixed(2);
  updateShellOptions({ innerRadius: Number(ui.shellInner.value) });
});
ui.shellOuter.addEventListener("input", () => {
  ui.shellOuterValue.textContent = Number(ui.shellOuter.value).toFixed(2);
  updateShellOptions({ outerRadius: Number(ui.shellOuter.value) });
});
ui.shellShowInner.addEventListener("change", () =>
  updateShellOptions({ showInner: ui.shellShowInner.checked }));
ui.shellShowOuter.addEventListener("change", () =>
  updateShellOptions({ showOuter: ui.shellShowOuter.checked }));
ui.shellShowShells.addEventListener("change", () =>
  updateShellOptions({ showShells: ui.shellShowShells.checked }));
ui.shellShowEndpoints.addEventListener("change", () =>
  updateShellOptions({ showEndpoints: ui.shellShowEndpoints.checked }));
ui.shellInnerOpaque.addEventListener("change", () =>
  updateShellOptions({ innerOpaque: ui.shellInnerOpaque.checked }));
ui.shellSideTubes.addEventListener("change", () =>
  updateShellOptions({ sideTubes: ui.shellSideTubes.checked }));
document.addEventListener("keydown", (event) => { if (event.code === "Space" && event.target.tagName !== "INPUT") { event.preventDefault(); ui.pause.click(); } });

const dialog = document.querySelector("#about-dialog");
document.querySelector("#about-button").addEventListener("click", () => dialog.showModal());
document.querySelector("#about-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

async function toggleVR() {
  if (renderer.xr.isPresenting) { await renderer.xr.getSession().end(); return; }
  if (!navigator.xr) return;
  try {
    const session = await navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor", "bounded-floor"] });
    await renderer.xr.setSession(session);
    ui.vr.textContent = "Exit VR";
    session.addEventListener("end", () => { ui.vr.textContent = "Enter VR"; });
  } catch (error) { showError(`Could not start VR: ${error.message}`); }
}
ui.vr.addEventListener("click", toggleVR);
if (!navigator.xr) { ui.vr.disabled = true; ui.vr.title = "WebXR is not available in this browser"; }
else navigator.xr.isSessionSupported("immersive-vr").then((supported) => { ui.vr.disabled = !supported; });

function showError(message) { const box = document.querySelector("#error"); box.textContent = message; box.classList.remove("hidden"); }

function resize() {
  const width = window.innerWidth, height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

function animate(time) {
  const delta = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  if (!paused && !renderer.xr.isPresenting) angle = (angle + delta * rotationSpeed) % 720;
  currentView.update(angle);
  ui.slider.value = String(Math.round(angle));
  ui.angle.textContent = `${Math.round(angle)}°`;
  controls.enabled = !renderer.xr.isPresenting;
  controls.update();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
