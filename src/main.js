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
renderer.xr.setReferenceSpaceType("local-floor");

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

const xrControllers = [renderer.xr.getController(0), renderer.xr.getController(1)];
xrControllers.forEach((controller) => scene.add(controller));
const controllerGrabInputs = new Map(
  xrControllers.map((controller) => [controller, new Set()]),
);
let grabbedController = null;
let vrViewScale = 0.34;
let rightBWasPressed = false;
let rightAWasPressed = false;
let endingVr = false;
let settingsHorizontalLatch = 0;
let settingsVerticalLatch = 0;
let vrSettingsPanel = null;
let vrSettingsRows = [];

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
  shellFlatTubes: document.querySelector("#shell-flat-tubes"),
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
  showOuter: false,
  showShells: false,
  showEndpoints: false,
  innerOpaque: true,
  sideTubes: true,
  flatTubes: true,
};
let currentKey = "shells";
let currentView = new VIEW_CLASSES[currentKey]({
  flagCount: selectedFlagCount,
  ...shellOptions,
});
let angle = 0;
let rotationSpeed = CONFIG.simulationSpeed;
let paused = false;
let rendering = true;
let lastTime = 0;
scene.add(currentView.group);
applyPresentationTransform(false);
syncViewUI(currentKey);

function applyPresentationTransform(presenting = renderer.xr.isPresenting) {
  if (presenting) {
    currentView.group.position.set(0, 1.55, -3);
    currentView.group.scale.setScalar(vrViewScale);
    floor.visible = false;
  } else {
    currentView.group.position.set(1.35, 0, 0);
    currentView.group.scale.setScalar(1);
    floor.visible = true;
  }
}

function beginControllerGrab(controller, inputName) {
  if (!renderer.xr.isPresenting) return;
  controllerGrabInputs.get(controller)?.add(inputName);
  if (grabbedController && grabbedController !== controller) return;
  if (grabbedController === controller) return;
  grabbedController = controller;
  controller.attach(currentView.group);
}

function endControllerGrab(controller, inputName) {
  const inputs = controllerGrabInputs.get(controller);
  inputs?.delete(inputName);
  if (grabbedController !== controller || inputs?.size) return;
  scene.attach(currentView.group);
  grabbedController = null;
  vrViewScale = currentView.group.scale.x;
}

function forceReleaseGrab(restorePresentation = true) {
  if (grabbedController) {
    scene.attach(currentView.group);
    grabbedController = null;
  }
  controllerGrabInputs.forEach((inputs) => inputs.clear());
  if (restorePresentation) applyPresentationTransform(renderer.xr.isPresenting);
}

xrControllers.forEach((controller) => {
  controller.addEventListener("selectstart", () =>
    beginControllerGrab(controller, "trigger"));
  controller.addEventListener("selectend", () =>
    endControllerGrab(controller, "trigger"));
  controller.addEventListener("squeezestart", () =>
    beginControllerGrab(controller, "grip"));
  controller.addEventListener("squeezeend", () =>
    endControllerGrab(controller, "grip"));
});

function replaceView(key, { preserveAxis = false } = {}) {
  const axis = preserveAxis ? currentView.axis?.toArray() : undefined;
  forceReleaseGrab(false);
  scene.remove(currentView.group);
  currentView.dispose();
  currentKey = key;
  currentView = new VIEW_CLASSES[key]({
    flagCount: selectedFlagCount,
    axis,
    ...(key === "shells" ? shellOptions : {}),
  });
  scene.add(currentView.group);
  applyPresentationTransform();
  currentView.update(angle);
}

function selectView(key) {
  if (!VIEW_CLASSES[key] || key === currentKey) return;
  angle = 0;
  ui.slider.value = "0";
  replaceView(key);
  syncViewUI(key);
}

function syncViewUI(key) {
  const copy = VIEW_COPY[key];
  ui.kicker.textContent = copy.kicker;
  ui.title.textContent = copy.title;
  ui.copy.textContent = copy.copy;
  ui.random.classList.toggle("hidden", key === "flags");
  ui.random.textContent = key === "wires" ? "Toggle initial flip"
      : key === "shells" ? "New S³ circle" : "New SU(2)";
  ui.flagCountControl.classList.toggle(
    "hidden",
    key === "wires" || key === "shells",
  );
  ui.shellOptions.classList.toggle("hidden", key !== "shells");
  ui.shellAxis.disabled = shellOptions.mode === "random";
  ui.shellWireLabel.textContent = shellOptions.sideTubes ? "Tubes" : "Wires";
  ui.shellFlatTubes.disabled = !shellOptions.sideTubes;
  document.querySelectorAll(".view-tab").forEach((button) => button.classList.toggle("active", button.dataset.view === key));
  drawVRSettingsPanel();
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
    syncShellControlsFromState();
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
  replaceView(currentKey, { preserveAxis: true });
});

function updateShellOptions(changes) {
  Object.assign(shellOptions, changes);
  syncShellControlsFromState();
  if (currentKey === "shells") currentView.setOptions?.(changes, angle);
}

function syncShellControlsFromState() {
  ui.shellMode.value = shellOptions.mode;
  ui.shellAxis.value = shellOptions.axis;
  ui.shellWire.value = String(shellOptions.wireCount);
  ui.shellWireValue.textContent = String(shellOptions.wireCount);
  ui.shellSamples.value = String(shellOptions.radialSamples);
  ui.shellSampleValue.textContent = String(shellOptions.radialSamples);
  ui.shellInner.value = String(shellOptions.innerRadius);
  ui.shellInnerValue.textContent = shellOptions.innerRadius.toFixed(2);
  ui.shellOuter.value = String(shellOptions.outerRadius);
  ui.shellOuterValue.textContent = shellOptions.outerRadius.toFixed(2);
  ui.shellShowInner.checked = shellOptions.showInner;
  ui.shellShowOuter.checked = shellOptions.showOuter;
  ui.shellShowShells.checked = shellOptions.showShells;
  ui.shellShowEndpoints.checked = shellOptions.showEndpoints;
  ui.shellInnerOpaque.checked = shellOptions.innerOpaque;
  ui.shellSideTubes.checked = shellOptions.sideTubes;
  ui.shellFlatTubes.checked = shellOptions.flatTubes;
  ui.shellAxis.disabled = shellOptions.mode === "random";
  ui.shellWireLabel.textContent = shellOptions.sideTubes ? "Tubes" : "Wires";
  ui.shellFlatTubes.disabled = !shellOptions.sideTubes;
  drawVRSettingsPanel();
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
ui.shellFlatTubes.addEventListener("change", () =>
  updateShellOptions({ flatTubes: ui.shellFlatTubes.checked }));

function cycleSetting(values, current, direction) {
  const index = Math.max(0, values.indexOf(current));
  return values[(index + direction + values.length) % values.length];
}

function createVRSettingsPanel() {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1200;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.08, 1.44),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.position.set(-1.15, 1.55, -2.25);
  mesh.rotation.y = 0.35;
  mesh.renderOrder = 1000;
  mesh.visible = false;
  scene.add(mesh);
  return {
    canvas,
    context: canvas.getContext("2d"),
    texture,
    mesh,
    selected: 0,
  };
}

function drawVRSettingsPanel() {
  if (!vrSettingsPanel) return;
  const { canvas, context } = vrSettingsPanel;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(18, 27, 23, 0.94)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#d7ff42";
  context.lineWidth = 8;
  context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  context.fillStyle = "#ffffff";
  context.font = "700 52px sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText("Spinor Belt settings", 48, 68);
  context.fillStyle = "#aeb8b2";
  context.font = "28px sans-serif";
  context.fillText("Right stick ↑↓ select  •  ←→ change  •  A close", 48, 116);

  const visibleRows = 13;
  const start = THREE.MathUtils.clamp(
    vrSettingsPanel.selected - Math.floor(visibleRows / 2),
    0,
    Math.max(0, vrSettingsRows.length - visibleRows),
  );
  const end = Math.min(vrSettingsRows.length, start + visibleRows);
  const rowHeight = 76;
  for (let index = start; index < end; index++) {
    const row = vrSettingsRows[index];
    const y = 166 + (index - start) * rowHeight;
    if (index === vrSettingsPanel.selected) {
      context.fillStyle = "#d7ff42";
      context.fillRect(28, y - 31, canvas.width - 56, 62);
      context.fillStyle = "#17211d";
    } else {
      context.fillStyle = index % 2
        ? "rgba(255,255,255,0.045)"
        : "rgba(255,255,255,0.018)";
      context.fillRect(28, y - 31, canvas.width - 56, 62);
      context.fillStyle = "#f5f3eb";
    }
    context.font = "600 31px sans-serif";
    context.textAlign = "left";
    context.fillText(row.label, 52, y);
    context.font = "700 31px sans-serif";
    context.textAlign = "right";
    context.fillText(row.value(), canvas.width - 52, y);
  }
  vrSettingsPanel.texture.needsUpdate = true;
}

function adjustVRSetting(direction) {
  if (!vrSettingsPanel || !vrSettingsRows.length) return;
  vrSettingsRows[vrSettingsPanel.selected].adjust(direction);
  drawVRSettingsPanel();
}

vrSettingsRows = [
  {
    label: "Visualization",
    value: () => VIEW_COPY[currentKey].kicker.slice(0, 2) + " " + currentKey,
    adjust: (direction) => {
      const views = ["shells", "flags", "su2", "wires"];
      selectView(cycleSetting(views, currentKey, direction));
    },
  },
  {
    label: "Animation",
    value: () => paused ? "Paused" : "Playing",
    adjust: () => {
      paused = !paused;
      ui.pause.textContent = paused ? "Resume" : "Pause";
    },
  },
  {
    label: "Speed",
    value: () => `${Math.round(rotationSpeed)}°/s`,
    adjust: (direction) => {
      rotationSpeed = THREE.MathUtils.clamp(
        rotationSpeed + direction * 10,
        0,
        900,
      );
      ui.speedSlider.value = String(rotationSpeed);
      ui.speed.textContent = `${rotationSpeed}°/s`;
    },
  },
  {
    label: "Filling",
    value: () => ({
      nonsingular: "Nonsingular",
      naive: "Naïve",
      random: "Random S³",
    })[shellOptions.mode],
    adjust: (direction) => updateShellOptions({
      mode: cycleSetting(
        ["nonsingular", "naive", "random"],
        shellOptions.mode,
        direction,
      ),
    }),
  },
  {
    label: "Spin axis",
    value: () => shellOptions.mode === "random"
      ? "Derived"
      : shellOptions.axis.toUpperCase(),
    adjust: (direction) => {
      if (shellOptions.mode !== "random") {
        updateShellOptions({
          axis: cycleSetting(["x", "y", "z"], shellOptions.axis, direction),
        });
      }
    },
  },
  {
    label: "Wires / tubes",
    value: () => String(shellOptions.wireCount),
    adjust: (direction) => updateShellOptions({
      wireCount: THREE.MathUtils.clamp(
        shellOptions.wireCount + direction * 2,
        6,
        500,
      ),
    }),
  },
  {
    label: "Radial samples",
    value: () => String(shellOptions.radialSamples),
    adjust: (direction) => updateShellOptions({
      radialSamples: THREE.MathUtils.clamp(
        shellOptions.radialSamples + direction * 5,
        50,
        150,
      ),
    }),
  },
  {
    label: "Inner radius",
    value: () => shellOptions.innerRadius.toFixed(2),
    adjust: (direction) => updateShellOptions({
      innerRadius: THREE.MathUtils.clamp(
        shellOptions.innerRadius + direction * 0.05,
        0.2,
        shellOptions.outerRadius - 0.2,
      ),
    }),
  },
  {
    label: "Outer radius",
    value: () => shellOptions.outerRadius.toFixed(2),
    adjust: (direction) => updateShellOptions({
      outerRadius: THREE.MathUtils.clamp(
        shellOptions.outerRadius + direction * 0.05,
        shellOptions.innerRadius + 0.2,
        2.8,
      ),
    }),
  },
  {
    label: "Inner sphere",
    value: () => shellOptions.showInner ? "On" : "Off",
    adjust: () => updateShellOptions({ showInner: !shellOptions.showInner }),
  },
  {
    label: "Outer sphere",
    value: () => shellOptions.showOuter ? "On" : "Off",
    adjust: () => updateShellOptions({ showOuter: !shellOptions.showOuter }),
  },
  {
    label: "Faint shells",
    value: () => shellOptions.showShells ? "On" : "Off",
    adjust: () => updateShellOptions({ showShells: !shellOptions.showShells }),
  },
  {
    label: "Endpoints",
    value: () => shellOptions.showEndpoints ? "On" : "Off",
    adjust: () => updateShellOptions({
      showEndpoints: !shellOptions.showEndpoints,
    }),
  },
  {
    label: "Opaque inner",
    value: () => shellOptions.innerOpaque ? "On" : "Off",
    adjust: () => updateShellOptions({
      innerOpaque: !shellOptions.innerOpaque,
    }),
  },
  {
    label: "Render style",
    value: () => shellOptions.sideTubes ? "Tubes" : "Wires",
    adjust: () => updateShellOptions({ sideTubes: !shellOptions.sideTubes }),
  },
  {
    label: "Flat tubes",
    value: () => shellOptions.flatTubes ? "6:1" : "Square",
    adjust: () => updateShellOptions({ flatTubes: !shellOptions.flatTubes }),
  },
  {
    label: "New S³ circle",
    value: () => "Generate →",
    adjust: () => {
      updateShellOptions({ mode: "random" });
      if (currentKey === "shells") currentView.randomize?.(angle);
    },
  },
];
vrSettingsPanel = createVRSettingsPanel();
drawVRSettingsPanel();

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
    vrViewScale = 0.34;
    rightBWasPressed = false;
    rightAWasPressed = false;
    settingsHorizontalLatch = 0;
    settingsVerticalLatch = 0;
    endingVr = false;
    vrSettingsPanel.mesh.visible = false;
    vrSettingsPanel.selected = 0;
    drawVRSettingsPanel();
    applyPresentationTransform(true);
    lastTime = performance.now();
    ui.vr.textContent = "Exit VR";
    session.addEventListener("end", () => {
      forceReleaseGrab(false);
      applyPresentationTransform(false);
      lastTime = performance.now();
      rightBWasPressed = false;
      rightAWasPressed = false;
      settingsHorizontalLatch = 0;
      settingsVerticalLatch = 0;
      endingVr = false;
      vrSettingsPanel.mesh.visible = false;
      ui.vr.textContent = "Enter VR";
    });
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

function processXRControllerInput(delta) {
  if (!renderer.xr.isPresenting) return;
  const session = renderer.xr.getSession();
  const inputSources = [...session.inputSources];
  const rightSource = inputSources
    .find((source) => source.handedness === "right" && source.gamepad);

  if (!rightSource) {
    rightBWasPressed = false;
    rightAWasPressed = false;
    settingsHorizontalLatch = 0;
    settingsVerticalLatch = 0;
  } else {
    const bPressed = Boolean(rightSource.gamepad.buttons[5]?.pressed);
    if (bPressed && !rightBWasPressed && !endingVr) {
      endingVr = true;
      session.end().catch((error) => {
        endingVr = false;
        showError(`Could not exit VR: ${error.message}`);
      });
    }
    rightBWasPressed = bPressed;

    const aPressed = Boolean(rightSource.gamepad.buttons[4]?.pressed);
    if (aPressed && !rightAWasPressed) {
      vrSettingsPanel.mesh.visible = !vrSettingsPanel.mesh.visible;
      settingsHorizontalLatch = 0;
      settingsVerticalLatch = 0;
      drawVRSettingsPanel();
    }
    rightAWasPressed = aPressed;

    const axes = rightSource.gamepad.axes;
    const horizontalAxis = axes.length >= 4 ? axes[2] : axes[0] ?? 0;
    const verticalAxis = axes.length >= 4 ? axes[3] : axes[1] ?? 0;

    if (vrSettingsPanel.mesh.visible) {
      const horizontalDirection = Math.abs(horizontalAxis) >= 0.65
        ? Math.sign(horizontalAxis)
        : 0;
      const verticalDirection = Math.abs(verticalAxis) >= 0.65
        ? Math.sign(verticalAxis)
        : 0;

      if (verticalDirection && !settingsVerticalLatch) {
        vrSettingsPanel.selected = (
          vrSettingsPanel.selected +
          verticalDirection +
          vrSettingsRows.length
        ) % vrSettingsRows.length;
        drawVRSettingsPanel();
      }
      if (horizontalDirection && !settingsHorizontalLatch) {
        adjustVRSetting(horizontalDirection);
      }

      settingsHorizontalLatch = Math.abs(horizontalAxis) <= 0.3
        ? 0
        : horizontalDirection || settingsHorizontalLatch;
      settingsVerticalLatch = Math.abs(verticalAxis) <= 0.3
        ? 0
        : verticalDirection || settingsVerticalLatch;
    } else {
      settingsHorizontalLatch = 0;
      settingsVerticalLatch = 0;
      if (Math.abs(verticalAxis) >= 0.14) {
        const zoomFactor = Math.exp(-verticalAxis * delta * 1.7);
        if (grabbedController) {
          const nextScale = THREE.MathUtils.clamp(
            currentView.group.scale.x * zoomFactor,
            0.06,
            0.5,
          );
          currentView.group.scale.setScalar(nextScale);
        } else {
          vrViewScale = THREE.MathUtils.clamp(
            vrViewScale * zoomFactor,
            0.12,
            0.8,
          );
          currentView.group.scale.setScalar(vrViewScale);
        }
      }
    }
  }
}

function animate(time) {
  const delta = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  processXRControllerInput(delta);
  if (!paused) angle = (angle + delta * rotationSpeed) % 720;
  currentView.update(angle);
  ui.slider.value = String(Math.round(angle));
  ui.angle.textContent = `${Math.round(angle)}°`;
  controls.enabled = !renderer.xr.isPresenting;
  controls.update();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
