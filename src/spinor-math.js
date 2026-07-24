/**
 * Mathematical helpers shared by the Three.js views.
 *
 * This module deliberately has no rendering dependency: values cross the
 * boundary as numbers and plain arrays, leaving visualizations.js responsible
 * only for turning them into Three.js objects.
 */

export const degreesToRadians = (degrees) => degrees * Math.PI / 180;

export const wrapDegrees = (degrees, period = 360) =>
  ((degrees % period) + period) % period;

// SU(2) uses half the corresponding SO(3) rotation angle.
export const spinorPhaseRadians = (physicalDegrees) =>
  degreesToRadians(physicalDegrees * 0.5);

// Complex numbers are plain { re, im } records so the C² state remains
// readable in a debugger and in the source.
export const complex = (re = 0, im = 0) => ({ re, im });

export const complexAdd = (left, right) =>
  complex(left.re + right.re, left.im + right.im);

export const complexMultiply = (left, right) =>
  complex(
    left.re * right.re - left.im * right.im,
    left.re * right.im + left.im * right.re,
  );

export const complexConjugate = (value) => complex(value.re, -value.im);

export const complexMagnitudeSquared = (value) =>
  value.re * value.re + value.im * value.im;

export const identitySU2 = () => [
  [complex(1, 0), complex(0, 0)],
  [complex(0, 0), complex(1, 0)],
];

/** Create U = cos(theta/2)I - i sin(theta/2)(axis · sigma). */
export function su2MatrixFromAxisAngle(axis, physicalDegrees) {
  const [rawX, rawY, rawZ] = axis;
  const length = Math.hypot(rawX, rawY, rawZ);
  if (length === 0) throw new RangeError("An SU(2) rotation axis cannot be zero.");

  const x = rawX / length;
  const y = rawY / length;
  const z = rawZ / length;
  const halfAngle = spinorPhaseRadians(physicalDegrees);
  const cosine = Math.cos(halfAngle);
  const sine = Math.sin(halfAngle);

  return [
    [complex(cosine, -z * sine), complex(-y * sine, -x * sine)],
    [complex(y * sine, -x * sine), complex(cosine, z * sine)],
  ];
}

/** Multiply a 2×2 complex SU(2) matrix by a two-component C² spinor. */
export function multiplySU2Spinor(matrix, spinor) {
  return [
    complexAdd(complexMultiply(matrix[0][0], spinor[0]), complexMultiply(matrix[0][1], spinor[1])),
    complexAdd(complexMultiply(matrix[1][0], spinor[0]), complexMultiply(matrix[1][1], spinor[1])),
  ];
}

/** Canonical normalized spinor whose Bloch vector points along direction. */
export function spinorFromBlochDirection(direction) {
  const [rawX, rawY, rawZ] = direction;
  const length = Math.hypot(rawX, rawY, rawZ);
  if (length === 0) throw new RangeError("A Bloch direction cannot be zero.");
  const x = rawX / length;
  const y = rawY / length;
  const z = rawZ / length;
  const alpha = Math.sqrt(Math.max(0, (1 + z) * 0.5));

  if (alpha < 1e-10) return [complex(0, 0), complex(1, 0)];
  return [complex(alpha, 0), complex(x / (2 * alpha), y / (2 * alpha))];
}

/** Map a normalized C² spinor back to its point on the Bloch sphere. */
export function blochDirectionFromSpinor(spinor) {
  const [alpha, beta] = spinor;
  const alphaConjugateBeta = complexMultiply(complexConjugate(alpha), beta);
  return [
    2 * alphaConjugateBeta.re,
    2 * alphaConjugateBeta.im,
    complexMagnitudeSquared(alpha) - complexMagnitudeSquared(beta),
  ];
}

/**
 * Convert a normalized spinor directly to quaternion components [x, y, z, w].
 *
 * For z = (alpha, beta), the associated SU(2) element is
 * [[alpha, -conj(beta)], [beta, conj(alpha)]]. Unlike reconstructing a frame
 * from only its Bloch direction, this retains the fiber information and has no
 * antipodal-vector singularity.
 */
export function rotationQuaternionFromSpinor(spinor) {
  const [alpha, beta] = spinor;
  return [-beta.im, beta.re, -alpha.im, alpha.re];
}

/**
 * U(1) phase relative to the canonical Bloch-sphere section. This is the
 * angle rendered by a flag around its pole.
 */
export function spinorFiberPhase(spinor) {
  const canonical = spinorFromBlochDirection(blochDirectionFromSpinor(spinor));
  const useAlphaChart = complexMagnitudeSquared(canonical[0]) >= complexMagnitudeSquared(canonical[1]);
  const component = useAlphaChart ? spinor[0] : spinor[1];
  const reference = useAlphaChart ? canonical[0] : canonical[1];
  const relativePhase = complexMultiply(component, complexConjugate(reference));
  return Math.atan2(relativePhase.im, relativePhase.re);
}

export function quaternionMultiply(left, right) {
  const [lx, ly, lz, lw] = left;
  const [rx, ry, rz, rw] = right;
  return [
    lw * rx + lx * rw + ly * rz - lz * ry,
    lw * ry - lx * rz + ly * rw + lz * rx,
    lw * rz + lx * ry - ly * rx + lz * rw,
    lw * rw - lx * rx - ly * ry - lz * rz,
  ];
}

export function rotateVectorByQuaternion(vector, quaternion) {
  const [x, y, z] = vector;
  const [qx, qy, qz, qw] = quaternion;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [
    x + qw * tx + qy * tz - qz * ty,
    y + qw * ty + qz * tx - qx * tz,
    z + qw * tz + qx * ty - qy * tx,
  ];
}

/** Decompose one spinor into the exact frame used by the flag renderer. */
export function flagFrameFromSpinor(spinor) {
  const poleDirection = blochDirectionFromSpinor(spinor);
  const canonicalSpinor = spinorFromBlochDirection(poleDirection);
  const poleQuaternion = quaternionMultiply(
    rotationQuaternionFromSpinor(canonicalSpinor),
    [Math.SQRT1_2, 0, 0, Math.SQRT1_2], // local +Y pole to Bloch +Z
  );
  const fiberPhase = spinorFiberPhase(spinor);
  const fiberQuaternion = [0, Math.sin(fiberPhase * 0.5), 0, Math.cos(fiberPhase * 0.5)];
  return {
    poleDirection,
    fiberPhase,
    quaternion: quaternionMultiply(poleQuaternion, fiberQuaternion),
    poleQuaternion,
  };
}

export function fibonacciSphereDirections(count) {
  if (!Number.isInteger(count) || count < 2) {
    throw new RangeError("A Fibonacci sphere requires at least two samples.");
  }

  const directions = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < count; index++) {
    const y = 1 - (index / (count - 1)) * 2;
    const radialDistance = Math.sqrt(Math.max(0, 1 - y * y));
    const azimuth = goldenAngle * index;
    directions.push([
      Math.cos(azimuth) * radialDistance,
      y,
      Math.sin(azimuth) * radialDistance,
    ]);
  }
  return directions;
}

export function createSpinorArray(count) {
  return fibonacciSphereDirections(count).map(spinorFromBlochDirection);
}

export function randomUnitDirection(random = Math.random) {
  // Uniform on S², unlike independently sampling and normalizing a cube.
  const y = random() * 2 - 1;
  const azimuth = random() * Math.PI * 2;
  const radialDistance = Math.sqrt(Math.max(0, 1 - y * y));
  return [
    Math.cos(azimuth) * radialDistance,
    y,
    Math.sin(azimuth) * radialDistance,
  ];
}

/** Uniform random normalized spinor on S³. */
export function randomSpinor(random = Math.random) {
  const first = random();
  const second = random() * Math.PI * 2;
  const third = random() * Math.PI * 2;
  const radiusA = Math.sqrt(1 - first);
  const radiusB = Math.sqrt(first);
  return [
    complex(radiusA * Math.sin(second), radiusA * Math.cos(second)),
    complex(radiusB * Math.sin(third), radiusB * Math.cos(third)),
  ];
}

function spinorComponents(spinor) {
  return [spinor[0].re, spinor[0].im, spinor[1].re, spinor[1].im];
}

function spinorFromComponents([alphaReal, alphaImaginary, betaReal, betaImaginary]) {
  return [complex(alphaReal, alphaImaginary), complex(betaReal, betaImaginary)];
}

/** Spherical interpolation on S³ without discarding the physically meaningful sign. */
export function slerpSpinors(start, end, t) {
  const from = spinorComponents(start);
  const to = spinorComponents(end);
  const dot = Math.max(-1, Math.min(1, from.reduce((sum, value, index) => sum + value * to[index], 0)));
  let components;

  if (dot > 1 - 1e-8) {
    components = from.map((value, index) => value + (to[index] - value) * t);
  } else if (dot < -1 + 1e-8) {
    const orthogonal = [-from[1], from[0], -from[3], from[2]];
    components = from.map((value, index) =>
      value * Math.cos(Math.PI * t) + orthogonal[index] * Math.sin(Math.PI * t));
  } else {
    const angle = Math.acos(dot);
    const denominator = Math.sin(angle);
    const startWeight = Math.sin((1 - t) * angle) / denominator;
    const endWeight = Math.sin(t * angle) / denominator;
    components = from.map((value, index) => value * startWeight + to[index] * endWeight);
  }

  const length = Math.hypot(...components);
  return spinorFromComponents(components.map((value) => value / length));
}

export function beltSurface({
  segments = 96,
  width = 0.56,
  startPosition = [-2.4, 0, 0],
  endPosition = [2.4, 0, 0],
  startSpinor,
  endSpinor,
  tangentScale,
} = {}) {
  if (!startSpinor || !endSpinor) {
    throw new TypeError("A belt surface requires both endpoint spinors.");
  }

  const vertices = [];
  const colorWeights = [];
  const indices = [];
  const orientationSpinors = [];
  const startDirection = flagFrameFromSpinor(startSpinor).poleDirection;
  const endDirection = flagFrameFromSpinor(endSpinor).poleDirection;
  const distance = Math.hypot(...endPosition.map((value, index) => value - startPosition[index]));
  const tangentLength = tangentScale ?? distance * 0.72;
  // Tangents point out of each flag. The parameterized curve approaches the
  // right endpoint in the opposite direction to its outward-facing flag.
  const startTangent = startDirection.map((value) => value * tangentLength);
  const endTangent = endDirection.map((value) => -value * tangentLength);

  for (let index = 0; index <= segments; index++) {
    const t = index / segments;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    const center = startPosition.map((value, component) =>
      h00 * value + h10 * startTangent[component] + h01 * endPosition[component] + h11 * endTangent[component]);

    const dh00 = 6 * t2 - 6 * t;
    const dh10 = 3 * t2 - 4 * t + 1;
    const dh01 = -6 * t2 + 6 * t;
    const dh11 = 3 * t2 - 2 * t;
    const tangent = startPosition.map((value, component) =>
      dh00 * value + dh10 * startTangent[component] + dh01 * endPosition[component] + dh11 * endTangent[component]);
    const tangentMagnitude = Math.hypot(...tangent) || 1;
    const tangentDirection = tangent.map((value) => value / tangentMagnitude);

    const orientationSpinor = slerpSpinors(startSpinor, endSpinor, t);
    const flagFrame = flagFrameFromSpinor(orientationSpinor);
    const rawAcross = rotateVectorByQuaternion([1, 0, 0], flagFrame.quaternion);
    const tangentComponent = rawAcross.reduce((sum, value, component) =>
      sum + value * tangentDirection[component], 0);
    let acrossDirection = rawAcross.map((value, component) =>
      value - tangentComponent * tangentDirection[component]);
    const acrossMagnitude = Math.hypot(...acrossDirection);
    if (acrossMagnitude > 1e-8) {
      acrossDirection = acrossDirection.map((value) => value / acrossMagnitude);
    } else {
      const fallback = Math.abs(tangentDirection[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1];
      const projection = fallback.reduce((sum, value, component) =>
        sum + value * tangentDirection[component], 0);
      acrossDirection = fallback.map((value, component) =>
        value - projection * tangentDirection[component]);
      const fallbackMagnitude = Math.hypot(...acrossDirection);
      acrossDirection = acrossDirection.map((value) => value / fallbackMagnitude);
    }
    orientationSpinors.push(orientationSpinor);
    const across = acrossDirection.map((component) => component * width * 0.5);

    for (const side of [-1, 1]) {
      vertices.push(
        center[0] + across[0] * side,
        center[1] + across[1] * side,
        center[2] + across[2] * side,
      );
      colorWeights.push(t);
    }

    if (index < segments) {
      const vertex = index * 2;
      indices.push(vertex, vertex + 2, vertex + 1, vertex + 2, vertex + 3, vertex + 1);
    }
  }

  return { vertices, colorWeights, indices, orientationSpinors };
}

// Quaternion-field helpers for the wire view. These use { w, v } records to
// keep them distinct from the [x, y, z, w] arrays used by the flag renderer.
export const fieldQuaternion = (w = 1, v = [0, 0, 0]) => ({ w, v });

export function multiplyFieldQuaternions(left, right) {
  const [lx, ly, lz] = left.v;
  const [rx, ry, rz] = right.v;
  return fieldQuaternion(
    left.w * right.w - lx * rx - ly * ry - lz * rz,
    [
      left.w * rx + right.w * lx + ly * rz - lz * ry,
      left.w * ry + right.w * ly + lz * rx - lx * rz,
      left.w * rz + right.w * lz + lx * ry - ly * rx,
    ],
  );
}

export function normalizeFieldQuaternion(quaternion) {
  const length = Math.hypot(quaternion.w, ...quaternion.v);
  if (length < 1e-10) throw new RangeError("Quaternion field became singular.");
  return fieldQuaternion(
    quaternion.w / length,
    quaternion.v.map((component) => component / length),
  );
}

export function axisAngleFieldQuaternion(axis, angle) {
  const length = Math.hypot(...axis);
  if (length < 1e-10) throw new RangeError("A quaternion rotation axis cannot be zero.");
  const sine = Math.sin(angle * 0.5) / length;
  return fieldQuaternion(
    Math.cos(angle * 0.5),
    axis.map((component) => component * sine),
  );
}

export function rotateVectorByFieldQuaternion(quaternion, vector) {
  const q = normalizeFieldQuaternion(quaternion);
  const pureVector = fieldQuaternion(0, vector);
  const conjugate = fieldQuaternion(q.w, q.v.map((component) => -component));
  return multiplyFieldQuaternions(
    multiplyFieldQuaternions(q, pureVector),
    conjugate,
  ).v;
}

export function smoothCompactProfile(radius, activeRadius) {
  if (radius >= activeRadius) return 0;
  const u = radius / activeRadius;
  return 1 - 3 * u * u + 2 * u * u * u;
}

function perpendicularAxis(axis) {
  const length = Math.hypot(...axis);
  const [x, y, z] = axis.map((component) => component / length);
  const reference = Math.abs(x) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const cross = [
    y * reference[2] - z * reference[1],
    z * reference[0] - x * reference[2],
    x * reference[1] - y * reference[0],
  ];
  const crossLength = Math.hypot(...cross);
  return cross.map((component) => component / crossLength);
}

/**
 * Compactly supported SU(2) field from the shared pseudocode. `time` is the
 * physical angle in radians over a complete 0..4π spin loop.
 */
export function spinLoopQuaternionField(position, time, {
  activeRadius = 1.7,
  epsilon = 0.48,
  spinAxis = [0, 0, 1],
} = {}) {
  const rho = smoothCompactProfile(Math.hypot(...position), activeRadius);
  const phi = time * 0.5;
  const axisLength = Math.hypot(...spinAxis);
  const axis = spinAxis.map((component) => component / axisLength);
  const escapeAxis = perpendicularAxis(axis);
  const escapeStrength =
    epsilon * rho * (1 - rho) * Math.sin(phi * 0.5) ** 2;

  return normalizeFieldQuaternion(fieldQuaternion(
    (1 - rho) + rho * Math.cos(phi),
    axis.map((component, index) =>
      rho * component * Math.sin(phi) + escapeStrength * escapeAxis[index]),
  ));
}

export function totalQuaternionField(position, time, {
  initialAngle = Math.PI,
  initialAxis = [1, 0, 0],
  multiplicationMode = "SPACE_FIXED",
  ...fieldOptions
} = {}) {
  const rho = smoothCompactProfile(
    Math.hypot(...position),
    fieldOptions.activeRadius ?? 1.7,
  );
  const initial = axisAngleFieldQuaternion(initialAxis, initialAngle * rho);
  const loop = spinLoopQuaternionField(position, time, fieldOptions);
  const total = multiplicationMode === "BODY_FIXED"
    ? multiplyFieldQuaternions(initial, loop)
    : multiplyFieldQuaternions(loop, initial);
  return normalizeFieldQuaternion(total);
}

export function quaternionDirectionField(position, time, referenceAxis, options) {
  const direction = rotateVectorByFieldQuaternion(
    totalQuaternionField(position, time, options),
    referenceAxis,
  );
  const length = Math.hypot(...direction);
  return direction.map((component) => component / length);
}

export function rk4WireStep(position, time, referenceAxis, stepSize, options) {
  const directionAt = (point) =>
    quaternionDirectionField(point, time, referenceAxis, options);
  const offset = (point, direction, scale) =>
    point.map((component, index) => component + direction[index] * scale);
  const k1 = directionAt(position);
  const k2 = directionAt(offset(position, k1, stepSize * 0.5));
  const k3 = directionAt(offset(position, k2, stepSize * 0.5));
  const k4 = directionAt(offset(position, k3, stepSize));
  return position.map((component, index) =>
    component + stepSize *
      (k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index]) / 6);
}

export function traceQuaternionWire(seed, time, referenceAxis, {
  domainRadius = 2.45,
  curveStepSize = 0.075,
  curveSteps = 42,
  ...fieldOptions
} = {}) {
  const traceHalf = (direction) => {
    const points = [];
    let position = [...seed];
    for (let step = 0; step < curveSteps; step++) {
      position = rk4WireStep(
        position,
        time,
        referenceAxis,
        curveStepSize * direction,
        fieldOptions,
      );
      if (Math.hypot(...position) > domainRadius) break;
      points.push(position);
    }
    return points;
  };

  const backward = traceHalf(-1).reverse();
  return [...backward, [...seed], ...traceHalf(1)];
}

export function shellParameter(radius, innerRadius, outerRadius) {
  if (outerRadius <= innerRadius) {
    throw new RangeError("The outer shell radius must exceed the inner radius.");
  }
  return (outerRadius - radius) / (outerRadius - innerRadius);
}

function approximateErf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const polynomial = (((((1.061405429 * t - 1.453152027) * t) +
    1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return sign * (1 - polynomial * Math.exp(-x * x));
}

/**
 * Normalized Gaussian CDF on [0, 1]. Its derivative is a Gaussian centered
 * between the shells, so interpolation is slow near both boundaries.
 */
export function gaussianShellProfile(shellCoordinate, sigma = 0.18) {
  const clamped = Math.max(0, Math.min(1, shellCoordinate));
  if (sigma <= 0) throw new RangeError("Gaussian shell sigma must be positive.");
  const scale = Math.SQRT2 * sigma;
  const lower = approximateErf(-0.5 / scale);
  const upper = approximateErf(0.5 / scale);
  return (
    approximateErf((clamped - 0.5) / scale) - lower
  ) / (upper - lower);
}

export function choosePerpendicularDirection(axis) {
  const length = Math.hypot(...axis);
  if (length < 1e-10) throw new RangeError("A shell spin axis cannot be zero.");
  const normalized = axis.map((component) => component / length);
  const reference = Math.abs(normalized[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const cross = [
    normalized[1] * reference[2] - normalized[2] * reference[1],
    normalized[2] * reference[0] - normalized[0] * reference[2],
    normalized[0] * reference[1] - normalized[1] * reference[0],
  ];
  const crossLength = Math.hypot(...cross);
  return cross.map((component) => component / crossLength);
}

export function innerShellQuaternion(time, spinAxis = [0, 0, 1]) {
  return axisAngleFieldQuaternion(spinAxis, time);
}

/**
 * Explicit nonsingular filling between the fixed outer shell and the rotating
 * inner shell. This is the stereographic construction specified in
 * concentric_shells.md, including its escape through the perpendicular axis.
 */
export function nonsingularShellQuaternion(
  shellCoordinate,
  time,
  spinAxis = [0, 0, 1],
  escapeAxis = choosePerpendicularDirection(spinAxis),
) {
  const axisLength = Math.hypot(...spinAxis);
  const escapeLength = Math.hypot(...escapeAxis);
  const axis = spinAxis.map((component) => component / axisLength);
  const escape = escapeAxis.map((component) => component / escapeLength);
  const alpha = time * 0.5;
  const cosine = Math.cos(alpha);
  const sine = Math.sin(alpha);
  const a = 1 - shellCoordinate + shellCoordinate * cosine;
  const b = shellCoordinate * sine;
  const d = a * a + b * b;
  const denominator = d + 1;
  return normalizeFieldQuaternion(fieldQuaternion(
    2 * a / denominator,
    axis.map((component, index) =>
      (2 * b * component + (d - 1) * escape[index]) / denominator),
  ));
}

export function normalizedQuaternionBlendFromIdentity(shellCoordinate, target) {
  const blended = fieldQuaternion(
    1 - shellCoordinate + shellCoordinate * target.w,
    target.v.map((component) => shellCoordinate * component),
  );
  const length = Math.hypot(blended.w, ...blended.v);
  // The naïve identity-to-minus-identity interpolation is genuinely singular.
  // Return null so comparison renderers can expose, rather than conceal, it.
  if (length < 1e-8) return null;
  return fieldQuaternion(
    blended.w / length,
    blended.v.map((component) => component / length),
  );
}

export function naiveShellQuaternion(shellCoordinate, time, spinAxis = [0, 0, 1]) {
  return normalizedQuaternionBlendFromIdentity(
    shellCoordinate,
    innerShellQuaternion(time, spinAxis),
  );
}

export function shellMappedPoint(direction, radius, quaternion) {
  if (!quaternion) return null;
  return rotateVectorByFieldQuaternion(quaternion, direction)
    .map((component) => component * radius);
}
