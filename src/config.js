export const CONFIG = {
  background: 0xf4f1e8,
  camera: { fov: 38, near: 0.05, far: 100, position: [5.8, 3.8, 7.8] },
  simulationSpeed: 22,
  sphereRadius: 1.62,
  samples: 12,
};

export const VIEW_COPY = {
  shells: {
    kicker: "01 — Concentric material shells",
    title: "Two turns bring it home.",
    copy: "The spinor at the centre rotates with a period of 4π (720°). Its connecting belts or wires bend and unwind without tangling, returning to their original shape after two full turns.",
  },
  flags: {
    kicker: "02 — The flag picture",
    title: "A rotation has memory.",
    copy: "Follow the colored frames around a Bloch sphere. One full turn changes the spinor’s sign; only the second turn brings it home.",
  },
  su2: {
    kicker: "03 — A path through SU(2)",
    title: "Every turn lifts to a path.",
    copy: "A single axis generates a continuous SU(2) motion. Change the generator and watch every state travel together through the double cover.",
  },
  wires: {
    kicker: "04 — The quaternion field",
    title: "The whole space untangles.",
    copy: "Three families of wires follow a compact SU(2) rotation field. Its off-axis escape closes the loop at 720° while the outer boundary stays fixed.",
  },
  flow: {
    kicker: "05 — Fleeting integral ribbons",
    title: "Watch the field flow.",
    copy: "Short-lived ribbons grow along the quaternion field and rapidly fade, revealing its evolving integral lines around a rotating textured core.",
  },
  gridflow: {
    kicker: "06 — Grid-seeded tube flow",
    title: "Order releases the flow.",
    copy: "A changing random subset of a regular 3D lattice releases short-lived 6:1 tubes into the evolving quaternion field.",
  },
};
