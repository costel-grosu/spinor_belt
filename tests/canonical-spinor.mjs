import {
  canonicalInnerQuaternion,
  canonicalShellQuaternion,
  cartesianBeltDirections,
  rotateVectorByFieldQuaternion,
} from "../src/spinor-math.js";

function near(actual, expected, message) {
  if (Math.abs(actual - expected) > 1e-10) throw new Error(message);
}

const directions = cartesianBeltDirections();
for (let step = 0; step <= 144; step++) {
  const time = step * Math.PI / 36;
  const q = canonicalInnerQuaternion(time);
  near(q.w, 0, "The circle must avoid both scalar poles ±1");
  const top = rotateVectorByFieldQuaternion(q, [0, 1, 0]);
  top.forEach((value, i) => near(value, [0, -1, 0][i], "Top must attach at bottom"));
  const expectedX = [Math.cos(time), 0, -Math.sin(time)];
  rotateVectorByFieldQuaternion(q, [1, 0, 0]).forEach((value, i) =>
    near(value, expectedX[i], "Rotor must spin about world +Y"));
  for (let radial = 0; radial <= 40; radial++) {
    const s = radial / 40;
    const field = canonicalShellQuaternion(s, time);
    near(Math.hypot(field.w, ...field.v), 1, "Every shell must remain nonsingular");
    const wrapped = canonicalShellQuaternion(s, time + 4 * Math.PI);
    [field.w, ...field.v].forEach((value, i) =>
      near(value, [wrapped.w, ...wrapped.v][i], "Whole field must repeat at 720°"));
    // A common rotation on each fixed-radius shell preserves separation.
    const mapped = directions.map((d) => rotateVectorByFieldQuaternion(field, d));
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
      near(Math.hypot(...mapped[i].map((v, k) => v - mapped[j][k])),
        Math.hypot(...directions[i].map((v, k) => v - directions[j][k])),
        "Distinct belts must remain separated on every shell");
    }
    if (radial === 0) near(field.w, 1, "Outer sphere must remain fixed");
  }
}
const start = canonicalInnerQuaternion(0);
const once = canonicalInnerQuaternion(2 * Math.PI);
near(once.v[0], -start.v[0], "One turn must negate the spinor");
const mid0 = canonicalShellQuaternion(0.5, 0);
const mid360 = canonicalShellQuaternion(0.5, 2 * Math.PI);
if (Math.abs(mid0.v[0] - mid360.v[0]) < 1) throw new Error("Belts must not reset at 360°");
