export const CONFIG = {
  background: 0xf4f1e8,
  camera: { fov: 38, near: 0.05, far: 100, position: [5.8, 3.8, 7.8] },
  simulationSpeed: 22,
  sphereRadius: 1.62,
  samples: 12,
};

export const VIEW_COPY = {
  flags: {
    kicker: "01 — The flag picture",
    title: "A rotation has memory.",
    copy: "Follow the colored frames around a Bloch sphere. One full turn changes the spinor’s sign; only the second turn brings it home.",
  },
  su2: {
    kicker: "02 — A path through SU(2)",
    title: "Every turn lifts to a path.",
    copy: "A single axis generates a continuous SU(2) motion. Change the generator and watch every state travel together through the double cover.",
  },
  belt: {
    kicker: "03 — Dirac’s belt trick",
    title: "The twist can escape.",
    copy: "The ends stay put while the frame turns. At 360° the belt is caught; at 720° the twist can flow away continuously.",
  },
  wires: {
    kicker: "04 — The quaternion field",
    title: "The whole space untangles.",
    copy: "Three families of wires follow a compact SU(2) rotation field. Its off-axis escape closes the loop at 720° while the outer boundary stays fixed.",
  },
  shells: {
    kicker: "05 — Concentric material shells",
    title: "Every radius keeps its place.",
    copy: "Fixed angular labels connect a rotating inner sphere to a stationary outer one. The nonsingular quaternion filling lets every material wire return straight after 720°.",
  },
};
