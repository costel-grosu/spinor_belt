import * as THREE from "three";
import { CONFIG } from "./config.js";
import {
  blochDirectionFromSpinor,
  choosePerpendicularDirection,
  createSpinorArray,
  fibonacciSphereDirections,
  flagFrameFromSpinor,
  gaussianShellProfile,
  identitySU2,
  innerShellQuaternion,
  multiplySU2Spinor,
  nonsingularShellQuaternion,
  normalizedQuaternionBlendFromIdentity,
  randomSpinor,
  randomUnitDirection,
  rotationQuaternionFromSpinor,
  totalQuaternionField,
  traceQuaternionWire,
  su2MatrixFromAxisAngle,
  wrapDegrees,
} from "./spinor-math.js";

const COLORS = [0xf05b4f, 0xf6b73c, 0xc9e43b, 0x31bea6, 0x3c8ddb, 0x7059d9, 0xd84fa4, 0xef7657, 0x58a85c, 0x4269ba, 0x9a55c3, 0xe55670];

function disposeGroup(group) {
  group.traverse((child) => {
    child.geometry?.dispose();
    const disposeMaterial = (material) => {
      material.map?.dispose();
      material.dispose();
    };
    if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
    else if (child.material) disposeMaterial(child.material);
  });
  group.clear();
}

function makeInnerSphereTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  context.fillStyle = "#e8e4f4";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(23, 33, 29, 0.62)";
  context.lineWidth = 4;
  for (let longitude = 0; longitude <= 12; longitude++) {
    const x = longitude * canvas.width / 12;
    context.lineWidth = longitude === 6 ? 9 : 4;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let latitude = 1; latitude < 8; latitude++) {
    const y = latitude * canvas.height / 8;
    context.lineWidth = latitude === 4 ? 9 : 4;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function sphereShell() {
  const group = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.sphereRadius, 48, 32),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.3, transmission: 0.12, side: THREE.DoubleSide })
  );
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.SphereGeometry(CONFIG.sphereRadius, 12, 8), 8),
    new THREE.LineBasicMaterial({ color: 0x7f8a85, transparent: true, opacity: 0.19 })
  );
  const originAxes = new THREE.AxesHelper(CONFIG.sphereRadius * 1.22);
  originAxes.material.transparent = true;
  originAxes.material.opacity = 0.72;
  originAxes.renderOrder = 2;
  group.add(sphere, wire, originAxes);
  return group;
}

function makeFlag(spinor, color) {
  const flag = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 8), new THREE.MeshStandardMaterial({ color: 0x25312b }));
  pole.position.y = 0.26;

  // The pivot sits exactly on the pole. The cloth is offset within it by half
  // its width, so rotating the pivot hinges the cloth at its attached edge.
  const phasePivot = new THREE.Group();
  phasePivot.position.y = 0.42;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.22), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.55 }));
  cloth.position.x = 0.18;
  phasePivot.add(cloth);
  flag.add(pole, phasePivot);
  flag.userData.phasePivot = phasePivot;
  setFlagOrientationFromSpinor(flag, spinor);
  return flag;
}

function setFlagOrientationFromSpinor(flag, spinor) {
  const frame = flagFrameFromSpinor(spinor);
  flag.quaternion.set(...frame.poleQuaternion);
  flag.userData.phasePivot.rotation.y = frame.fiberPhase;
}

function setFlagOnSphere(flag, spinor) {
  const direction = new THREE.Vector3(...blochDirectionFromSpinor(spinor)).normalize();
  flag.position.copy(direction).multiplyScalar(CONFIG.sphereRadius);
  setFlagOrientationFromSpinor(flag, spinor);
}

export class FlagView {
  constructor({ flagCount = CONFIG.samples } = {}) {
    this.group = new THREE.Group();
    this.rotor = new THREE.Group();
    this.spinors = createSpinorArray(flagCount);
    this.su2Matrix = identitySU2();
    this.group.add(sphereShell(), this.rotor);
    this.spinors.forEach((spinor, i) => {
      const flag = makeFlag(spinor, COLORS[i % COLORS.length]);
      setFlagOnSphere(flag, spinor);
      this.rotor.add(flag);
    });
    const axisMat = new THREE.LineBasicMaterial({ color: 0x17211d, transparent: true, opacity: 0.35 });
    this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -2.2, 0), new THREE.Vector3(0, 2.2, 0)]), axisMat));
  }
  update(angle) {
    this.su2Matrix = su2MatrixFromAxisAngle([0, 1, 0], wrapDegrees(angle, 720));
    this.transformedSpinors = this.spinors.map((spinor) => multiplySU2Spinor(this.su2Matrix, spinor));
    this.rotor.children.forEach((flag, index) => {
      setFlagOnSphere(flag, this.transformedSpinors[index]);
    });
  }
  dispose() { disposeGroup(this.group); }
}

export class SU2View {
  constructor({ flagCount = CONFIG.samples, axis } = {}) {
    this.group = new THREE.Group();
    this.states = new THREE.Group();
    this.spinors = createSpinorArray(flagCount);
    this.su2Matrix = identitySU2();
    this.axis = axis
      ? new THREE.Vector3(...axis).normalize()
      : new THREE.Vector3(0.42, 0.82, 0.38).normalize();
    this.group.add(sphereShell(), this.states);
    this.spinors.forEach((spinor, i) => {
      const flag = makeFlag(spinor, COLORS[i % COLORS.length]);
      setFlagOnSphere(flag, spinor);
      this.states.add(flag);
    });
    this.axisLine = new THREE.ArrowHelper(this.axis, this.axis.clone().multiplyScalar(-2.15), 4.3, 0x17211d, 0.2, 0.1);
    this.group.add(this.axisLine);
  }
  randomize() {
    this.axis.set(...randomUnitDirection());
    this.axisLine.setDirection(this.axis);
    this.axisLine.position.copy(this.axis).multiplyScalar(-2.15);
  }
  update(angle) {
    this.su2Matrix = su2MatrixFromAxisAngle(this.axis.toArray(), wrapDegrees(angle, 720));
    this.transformedSpinors = this.spinors.map((spinor) => multiplySU2Spinor(this.su2Matrix, spinor));
    this.states.children.forEach((flag, index) => {
      setFlagOnSphere(flag, this.transformedSpinors[index]);
    });
  }
  dispose() { disposeGroup(this.group); }
}

export class WireFieldView {
  constructor() {
    this.group = new THREE.Group();
    this.initialAngle = Math.PI;
    this.fieldOptions = {
      activeRadius: 1.7,
      domainRadius: 2.45,
      epsilon: 0.48,
      spinAxis: [0, 0, 1],
      initialAxis: [1, 0, 0],
      multiplicationMode: "SPACE_FIXED",
      curveStepSize: 0.075,
      curveSteps: 42,
    };
    this.referenceAxes = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    this.wireColors = [0xe9584f, 0x2da988, 0x397bd1];
    this.wires = [];
    this.lastRenderedAngle = Number.NaN;

    const domain = new THREE.LineSegments(
      new THREE.EdgesGeometry(
        new THREE.SphereGeometry(this.fieldOptions.domainRadius, 16, 10),
        12,
      ),
      new THREE.LineBasicMaterial({
        color: 0x77817c,
        transparent: true,
        opacity: 0.12,
      }),
    );
    const activeRegion = new THREE.Mesh(
      new THREE.SphereGeometry(this.fieldOptions.activeRadius, 32, 20),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.055,
        roughness: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.group.add(domain, activeRegion);

    const offsets = [-0.72, 0, 0.72];
    this.referenceAxes.forEach((referenceAxis, axisIndex) => {
      const perpendicularComponents = [0, 1, 2]
        .filter((index) => referenceAxis[index] === 0);
      offsets.forEach((first) => offsets.forEach((second) => {
        const seed = [0, 0, 0];
        seed[perpendicularComponents[0]] = first;
        seed[perpendicularComponents[1]] = second;
        const geometry = new THREE.BufferGeometry();
        const positions = new THREE.BufferAttribute(
          new Float32Array((this.fieldOptions.curveSteps * 2 + 1) * 3),
          3,
        );
        positions.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute("position", positions);
        const material = new THREE.LineBasicMaterial({
          color: this.wireColors[axisIndex],
          transparent: true,
          opacity: first === 0 && second === 0 ? 0.92 : 0.56,
        });
        const line = new THREE.Line(geometry, material);
        line.frustumCulled = false;
        this.wires.push({ line, seed, referenceAxis });
        this.group.add(line);
      }));
    });

    this.centerFrame = new THREE.Group();
    this.centerFrame.add(
      new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.72, this.wireColors[0], 0.14, 0.08),
      new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.72, this.wireColors[1], 0.14, 0.08),
      new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.72, this.wireColors[2], 0.14, 0.08),
    );
    this.centerMarker = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.12, 1),
      new THREE.MeshStandardMaterial({ color: 0x7658d6, roughness: 0.42 }),
    );
    this.group.add(this.centerFrame, this.centerMarker);
    this.update(0);
  }

  randomize(angle = 0) {
    this.initialAngle = this.initialAngle === 0 ? Math.PI : 0;
    this.lastRenderedAngle = Number.NaN;
    this.update(angle);
  }

  update(angle) {
    if (Math.abs(angle - this.lastRenderedAngle) < 0.65) return;
    this.lastRenderedAngle = angle;
    const time = angle * Math.PI / 180;
    const options = { ...this.fieldOptions, initialAngle: this.initialAngle };

    this.wires.forEach(({ line, seed, referenceAxis }) => {
      const points = traceQuaternionWire(seed, time, referenceAxis, options);
      const attribute = line.geometry.getAttribute("position");
      points.forEach((point, index) => attribute.setXYZ(index, ...point));
      attribute.needsUpdate = true;
      line.geometry.setDrawRange(0, points.length);
      line.geometry.computeBoundingSphere();
    });

    const center = totalQuaternionField([0, 0, 0], time, options);
    this.centerFrame.quaternion.set(...center.v, center.w);
    const initial = totalQuaternionField([0, 0, 0], 0, options);
    const phaseDot = center.w * initial.w +
      center.v.reduce(
        (sum, component, index) => sum + component * initial.v[index],
        0,
      );
    this.centerMarker.material.color
      .set(0xe96b62)
      .lerp(new THREE.Color(0x7658d6), (phaseDot + 1) * 0.5);
  }

  dispose() { disposeGroup(this.group); }
}

export class ShellWireBundle {
  constructor({ wireCount = 160, radialSamples = 81 } = {}) {
    this.group = new THREE.Group();
    this.lines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
      }),
    );
    this.lines.frustumCulled = false;
    this.endpoints = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        vertexColors: true,
        size: 0.045,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.endpoints.frustumCulled = false;
    this.group.add(this.lines, this.endpoints);
    this.rebuild(wireCount, radialSamples);
  }

  rebuild(wireCount, radialSamples) {
    this.wireCount = Math.max(6, Math.round(wireCount));
    this.radialSamples = Math.max(3, Math.round(radialSamples));
    this.labels = fibonacciSphereDirections(this.wireCount);
    this.pointScratch = new Float32Array(
      this.wireCount * this.radialSamples * 3,
    );

    const segmentVertexCount =
      this.wireCount * (this.radialSamples - 1) * 2;
    const positions = new THREE.BufferAttribute(
      new Float32Array(segmentVertexCount * 3),
      3,
    );
    positions.setUsage(THREE.DynamicDrawUsage);
    const colors = new Float32Array(segmentVertexCount * 3);
    const endpointPositions = new THREE.BufferAttribute(
      new Float32Array(this.wireCount * 2 * 3),
      3,
    );
    endpointPositions.setUsage(THREE.DynamicDrawUsage);
    const endpointColors = new Float32Array(this.wireCount * 2 * 3);
    const color = new THREE.Color();

    for (let wire = 0; wire < this.wireCount; wire++) {
      color.setHSL((wire / this.wireCount + 0.02) % 1, 0.68, 0.48);
      for (let segment = 0; segment < this.radialSamples - 1; segment++) {
        const vertexOffset =
          (wire * (this.radialSamples - 1) + segment) * 6;
        for (let component = 0; component < 2; component++) {
          const colorOffset = vertexOffset + component * 3;
          colors[colorOffset] = color.r;
          colors[colorOffset + 1] = color.g;
          colors[colorOffset + 2] = color.b;
        }
      }
      for (let endpoint = 0; endpoint < 2; endpoint++) {
        const offset = (wire * 2 + endpoint) * 3;
        endpointColors[offset] = color.r;
        endpointColors[offset + 1] = color.g;
        endpointColors[offset + 2] = color.b;
      }
    }

    this.lines.geometry.dispose();
    this.lines.geometry = new THREE.BufferGeometry();
    this.lines.geometry.setAttribute("position", positions);
    this.lines.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 3),
    );
    this.endpoints.geometry.dispose();
    this.endpoints.geometry = new THREE.BufferGeometry();
    this.endpoints.geometry.setAttribute("position", endpointPositions);
    this.endpoints.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(endpointColors, 3),
    );
  }

  update(innerRadius, outerRadius, quaternionAt) {
    const quaternions = [];
    for (let radial = 0; radial < this.radialSamples; radial++) {
      const fraction = radial / (this.radialSamples - 1);
      quaternions.push({
        radius: innerRadius + (outerRadius - innerRadius) * fraction,
        quaternion: quaternionAt(1 - fraction),
      });
    }

    for (let wire = 0; wire < this.wireCount; wire++) {
      const [x, y, z] = this.labels[wire];
      for (let radial = 0; radial < this.radialSamples; radial++) {
        const { radius, quaternion } = quaternions[radial];
        const pointOffset = (wire * this.radialSamples + radial) * 3;
        if (!quaternion) {
          this.pointScratch[pointOffset] = Number.NaN;
          this.pointScratch[pointOffset + 1] = Number.NaN;
          this.pointScratch[pointOffset + 2] = Number.NaN;
          continue;
        }
        const [qx, qy, qz] = quaternion.v;
        const qw = quaternion.w;
        const tx = 2 * (qy * z - qz * y);
        const ty = 2 * (qz * x - qx * z);
        const tz = 2 * (qx * y - qy * x);
        this.pointScratch[pointOffset] =
          (x + qw * tx + qy * tz - qz * ty) * radius;
        this.pointScratch[pointOffset + 1] =
          (y + qw * ty + qz * tx - qx * tz) * radius;
        this.pointScratch[pointOffset + 2] =
          (z + qw * tz + qx * ty - qy * tx) * radius;
      }
    }

    const segmentPositions = this.lines.geometry.getAttribute("position");
    const endpointPositions = this.endpoints.geometry.getAttribute("position");
    let destination = 0;
    for (let wire = 0; wire < this.wireCount; wire++) {
      const wireStart = wire * this.radialSamples * 3;
      for (let radial = 0; radial < this.radialSamples - 1; radial++) {
        const point = wireStart + radial * 3;
        for (let component = 0; component < 3; component++) {
          segmentPositions.array[destination++] = this.pointScratch[point + component];
        }
        for (let component = 0; component < 3; component++) {
          segmentPositions.array[destination++] =
            this.pointScratch[point + 3 + component];
        }
      }
      const endpointOffset = wire * 6;
      endpointPositions.array.set(
        this.pointScratch.subarray(wireStart, wireStart + 3),
        endpointOffset,
      );
      const outerPoint = wireStart + (this.radialSamples - 1) * 3;
      endpointPositions.array.set(
        this.pointScratch.subarray(outerPoint, outerPoint + 3),
        endpointOffset + 3,
      );
    }
    segmentPositions.needsUpdate = true;
    endpointPositions.needsUpdate = true;
  }
}

export class ShellTubeBundle {
  constructor({ wireCount = 12, radialSamples = 81 } = {}) {
    this.mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.52,
        metalness: 0.04,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.frustumCulled = false;
    this.rebuild(wireCount, radialSamples);
  }

  rebuild(tubeCount, radialSamples) {
    this.tubeCount = Math.max(6, Math.round(tubeCount));
    this.radialSamples = Math.max(3, Math.round(radialSamples));
    this.labels = fibonacciSphereDirections(this.tubeCount);
    this.centerScratch = new Float32Array(
      this.tubeCount * this.radialSamples * 3,
    );
    const sides = 4;
    const vertexCount = this.tubeCount * this.radialSamples * sides;
    const positions = new THREE.BufferAttribute(
      new Float32Array(vertexCount * 3),
      3,
    );
    positions.setUsage(THREE.DynamicDrawUsage);
    const colors = new Float32Array(vertexCount * 3);
    const indices = [];
    const color = new THREE.Color();

    for (let tube = 0; tube < this.tubeCount; tube++) {
      color.setHSL((tube / this.tubeCount + 0.02) % 1, 0.68, 0.48);
      for (let radial = 0; radial < this.radialSamples; radial++) {
        for (let side = 0; side < sides; side++) {
          const vertex = (tube * this.radialSamples * sides) +
            radial * sides + side;
          colors[vertex * 3] = color.r;
          colors[vertex * 3 + 1] = color.g;
          colors[vertex * 3 + 2] = color.b;
        }
      }
      const tubeStart = tube * this.radialSamples * sides;
      for (let radial = 0; radial < this.radialSamples - 1; radial++) {
        const ring = tubeStart + radial * sides;
        const nextRing = ring + sides;
        for (let side = 0; side < sides; side++) {
          const nextSide = (side + 1) % sides;
          indices.push(
            ring + side,
            nextRing + side,
            ring + nextSide,
            ring + nextSide,
            nextRing + side,
            nextRing + nextSide,
          );
        }
      }
    }

    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.BufferGeometry();
    this.mesh.geometry.setAttribute("position", positions);
    this.mesh.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 3),
    );
    this.mesh.geometry.setIndex(indices);
  }

  update(innerRadius, outerRadius, quaternionAt, crossSectionAspect = 1) {
    const quaternions = [];
    for (let radial = 0; radial < this.radialSamples; radial++) {
      const fraction = radial / (this.radialSamples - 1);
      quaternions.push({
        radius: innerRadius + (outerRadius - innerRadius) * fraction,
        quaternion: quaternionAt(1 - fraction),
      });
    }

    for (let tube = 0; tube < this.tubeCount; tube++) {
      const [x, y, z] = this.labels[tube];
      for (let radial = 0; radial < this.radialSamples; radial++) {
        const { radius, quaternion } = quaternions[radial];
        const offset = (tube * this.radialSamples + radial) * 3;
        if (!quaternion) {
          // The naïve interpolation has no orientation at this point.
          this.centerScratch[offset] = 0;
          this.centerScratch[offset + 1] = 0;
          this.centerScratch[offset + 2] = 0;
          continue;
        }
        const [qx, qy, qz] = quaternion.v;
        const qw = quaternion.w;
        const tx = 2 * (qy * z - qz * y);
        const ty = 2 * (qz * x - qx * z);
        const tz = 2 * (qx * y - qy * x);
        this.centerScratch[offset] =
          (x + qw * tx + qy * tz - qz * ty) * radius;
        this.centerScratch[offset + 1] =
          (y + qw * ty + qz * tx - qx * tz) * radius;
        this.centerScratch[offset + 2] =
          (z + qw * tz + qx * ty - qy * tx) * radius;
      }
    }

    const thickness = Math.max(
      0.008,
      Math.min(0.045, outerRadius * 0.14 / Math.sqrt(this.tubeCount)),
    );
    const normalHalfExtent = crossSectionAspect > 1
      ? thickness
      : thickness * Math.SQRT1_2;
    const binormalHalfExtent = crossSectionAspect > 1
      ? thickness / crossSectionAspect
      : thickness * Math.SQRT1_2;
    const positionAttribute = this.mesh.geometry.getAttribute("position");
    const positions = positionAttribute.array;
    const sides = 4;
    const cornerCoefficients = [
      normalHalfExtent, binormalHalfExtent,
      -normalHalfExtent, binormalHalfExtent,
      -normalHalfExtent, -binormalHalfExtent,
      normalHalfExtent, -binormalHalfExtent,
    ];
    for (let tube = 0; tube < this.tubeCount; tube++) {
      const tubeCenter = tube * this.radialSamples * 3;
      const [labelX, labelY, labelZ] = this.labels[tube];
      const referenceX = Math.abs(labelX) < 0.9 ? 1 : 0;
      const referenceY = referenceX === 1 ? 0 : 1;
      const referenceProjection =
        referenceX * labelX + referenceY * labelY;
      let materialNormalX = referenceX - referenceProjection * labelX;
      let materialNormalY = referenceY - referenceProjection * labelY;
      let materialNormalZ = -referenceProjection * labelZ;
      const materialNormalLength = Math.hypot(
        materialNormalX,
        materialNormalY,
        materialNormalZ,
      );
      materialNormalX /= materialNormalLength;
      materialNormalY /= materialNormalLength;
      materialNormalZ /= materialNormalLength;
      const materialBinormalX =
        labelY * materialNormalZ - labelZ * materialNormalY;
      const materialBinormalY =
        labelZ * materialNormalX - labelX * materialNormalZ;
      const materialBinormalZ =
        labelX * materialNormalY - labelY * materialNormalX;

      for (let radial = 0; radial < this.radialSamples; radial++) {
        const centerOffset = tubeCenter + radial * 3;
        const centerX = this.centerScratch[centerOffset];
        const centerY = this.centerScratch[centerOffset + 1];
        const centerZ = this.centerScratch[centerOffset + 2];
        let tangentX;
        let tangentY;
        let tangentZ;
        if (radial === 0 || radial === this.radialSamples - 1) {
          // The Gaussian profile is nearly flat at both ends. Use the exact
          // material radial direction there so Q=identity pins the complete
          // outer attachment frame, not only its center point.
          const radialLength = Math.hypot(centerX, centerY, centerZ) || 1;
          tangentX = centerX / radialLength;
          tangentY = centerY / radialLength;
          tangentZ = centerZ / radialLength;
        } else {
          const previousOffset = centerOffset - 3;
          const nextOffset = centerOffset + 3;
          tangentX = this.centerScratch[nextOffset] -
            this.centerScratch[previousOffset];
          tangentY = this.centerScratch[nextOffset + 1] -
            this.centerScratch[previousOffset + 1];
          tangentZ = this.centerScratch[nextOffset + 2] -
            this.centerScratch[previousOffset + 2];
        }
        const tangentLength = Math.hypot(tangentX, tangentY, tangentZ) || 1;
        tangentX /= tangentLength;
        tangentY /= tangentLength;
        tangentZ /= tangentLength;

        const quaternion = quaternions[radial].quaternion ??
          quaternions[Math.max(0, radial - 1)].quaternion ??
          quaternions[Math.min(this.radialSamples - 1, radial + 1)].quaternion ??
          { w: 1, v: [0, 0, 0] };
        const [qx, qy, qz] = quaternion.v;
        const qw = quaternion.w;
        const rotateMaterialVector = (vectorX, vectorY, vectorZ) => {
          const tx = 2 * (qy * vectorZ - qz * vectorY);
          const ty = 2 * (qz * vectorX - qx * vectorZ);
          const tz = 2 * (qx * vectorY - qy * vectorX);
          return [
            vectorX + qw * tx + qy * tz - qz * ty,
            vectorY + qw * ty + qz * tx - qx * tz,
            vectorZ + qw * tz + qx * ty - qy * tx,
          ];
        };
        let [normalX, normalY, normalZ] = rotateMaterialVector(
          materialNormalX,
          materialNormalY,
          materialNormalZ,
        );
        const tangentComponent =
          normalX * tangentX + normalY * tangentY + normalZ * tangentZ;
        normalX -= tangentComponent * tangentX;
        normalY -= tangentComponent * tangentY;
        normalZ -= tangentComponent * tangentZ;
        let normalLength = Math.hypot(normalX, normalY, normalZ);
        if (normalLength < 1e-8) {
          [normalX, normalY, normalZ] = rotateMaterialVector(
            materialBinormalX,
            materialBinormalY,
            materialBinormalZ,
          );
          const fallbackProjection =
            normalX * tangentX + normalY * tangentY + normalZ * tangentZ;
          normalX -= fallbackProjection * tangentX;
          normalY -= fallbackProjection * tangentY;
          normalZ -= fallbackProjection * tangentZ;
          normalLength = Math.hypot(normalX, normalY, normalZ);
        }
        if (normalLength < 1e-8) {
          const refX = Math.abs(tangentX) < 0.9 ? 1 : 0;
          const refY = refX === 1 ? 0 : 1;
          normalX = tangentY * 0 - tangentZ * refY;
          normalY = tangentZ * refX - tangentX * 0;
          normalZ = tangentX * refY - tangentY * refX;
          normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
        }
        normalX /= normalLength;
        normalY /= normalLength;
        normalZ /= normalLength;
        const binormalX = tangentY * normalZ - tangentZ * normalY;
        const binormalY = tangentZ * normalX - tangentX * normalZ;
        const binormalZ = tangentX * normalY - tangentY * normalX;
        const ringOffset =
          (tube * this.radialSamples * sides + radial * sides) * 3;
        for (let side = 0; side < sides; side++) {
          const vertexOffset = ringOffset + side * 3;
          const normalScale = cornerCoefficients[side * 2];
          const binormalScale = cornerCoefficients[side * 2 + 1];
          positions[vertexOffset] =
            centerX + normalX * normalScale + binormalX * binormalScale;
          positions[vertexOffset + 1] =
            centerY + normalY * normalScale + binormalY * binormalScale;
          positions[vertexOffset + 2] =
            centerZ + normalZ * normalScale + binormalZ * binormalScale;
        }
      }
    }
    positionAttribute.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}

function randomUnitQuaternionRecord() {
  const components = rotationQuaternionFromSpinor(randomSpinor());
  return {
    w: components[3],
    v: components.slice(0, 3),
  };
}

function randomGreatCircle() {
  const origin = randomUnitQuaternionRecord();
  let candidate = randomUnitQuaternionRecord();
  let dot = origin.w * candidate.w +
    origin.v.reduce(
      (sum, component, index) => sum + component * candidate.v[index],
      0,
    );
  let tangent = {
    w: candidate.w - dot * origin.w,
    v: candidate.v.map(
      (component, index) => component - dot * origin.v[index],
    ),
  };
  let length = Math.hypot(tangent.w, ...tangent.v);
  if (length < 1e-6) {
    candidate = { w: -origin.v[0], v: [origin.w, -origin.v[2], origin.v[1]] };
    dot = 0;
    tangent = candidate;
    length = Math.hypot(tangent.w, ...tangent.v);
  }
  tangent.w /= length;
  tangent.v = tangent.v.map((component) => component / length);
  // The pair (origin, tangent) fixes a great circle on S³. Multiplying the
  // tangent by inverse(origin) gives its constant space-fixed generator.
  const [ox, oy, oz] = origin.v;
  const [tx, ty, tz] = tangent.v;
  const spaceAxis = [
    -tangent.w * ox + origin.w * tx - (ty * oz - tz * oy),
    -tangent.w * oy + origin.w * ty - (tz * ox - tx * oz),
    -tangent.w * oz + origin.w * tz - (tx * oy - ty * ox),
  ];
  const bodyAxis = [
    origin.w * tx - tangent.w * ox - (oy * tz - oz * ty),
    origin.w * ty - tangent.w * oy - (oz * tx - ox * tz),
    origin.w * tz - tangent.w * oz - (ox * ty - oy * tx),
  ];
  const axisLength = Math.hypot(...spaceAxis);
  const bodyAxisLength = Math.hypot(...bodyAxis);
  return {
    origin,
    tangent,
    spaceAxis: spaceAxis.map((component) => component / axisLength),
    bodyAxis: bodyAxis.map((component) => component / bodyAxisLength),
  };
}

export class ConcentricShellView {
  constructor(options = {}) {
    this.group = new THREE.Group();
    this.options = {
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
      ...options,
    };
    this.randomCircle = randomGreatCircle();
    this.lastRenderedAngle = Number.NaN;

    this.bundle = new ShellWireBundle(this.options);
    this.group.add(this.bundle.group);
    this.tubeBundle = new ShellTubeBundle(this.options);
    this.group.add(this.tubeBundle.mesh);

    this.outerSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0x27322d,
        wireframe: true,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      }),
    );
    this.innerRotor = new THREE.Group();
    this.innerTexture = makeInnerSphereTexture();
    this.innerSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.innerTexture,
        wireframe: false,
        transparent: true,
        opacity: 0.62,
        roughness: 0.58,
      }),
    );
    this.innerFrame = new THREE.Group();
    this.innerFrame.add(
      new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1.25, 0xe9584f, 0.14, 0.08),
      new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1.25, 0x2da988, 0.14, 0.08),
      new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 1.25, 0x397bd1, 0.14, 0.08),
    );
    this.innerRotor.add(this.innerSphere, this.innerFrame);

    this.intermediateShells = new THREE.Group();
    for (let index = 1; index <= 4; index++) {
      this.intermediateShells.add(new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 10),
        new THREE.MeshBasicMaterial({
          color: 0x7c68c8,
          wireframe: true,
          transparent: true,
          opacity: 0.055,
          depthWrite: false,
        }),
      ));
    }
    this.axisArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -2.7),
      5.4,
      0x17211d,
      0.2,
      0.1,
    );
    this.group.add(
      this.outerSphere,
      this.innerRotor,
      this.intermediateShells,
      this.axisArrow,
    );
    this.setOptions(this.options, 0);
  }

  axisVector() {
    if (this.options.mode === "random") return this.randomCircle.spaceAxis;
    return {
      x: [1, 0, 0],
      y: [0, 1, 0],
      z: [0, 0, 1],
    }[this.options.axis] ?? [0, 0, 1];
  }

  textureAxisVector() {
    return this.options.mode === "random"
      ? this.randomCircle.bodyAxis
      : this.axisVector();
  }

  randomInnerQuaternion(time) {
    const cosine = Math.cos(time * 0.5);
    const sine = Math.sin(time * 0.5);
    return {
      w: this.randomCircle.origin.w * cosine +
        this.randomCircle.tangent.w * sine,
      v: this.randomCircle.origin.v.map((component, index) =>
        component * cosine + this.randomCircle.tangent.v[index] * sine),
    };
  }

  quaternionAt(shellCoordinate, time) {
    const profiledCoordinate = gaussianShellProfile(shellCoordinate);
    const spinAxis = this.axisVector();
    if (this.options.mode === "random") {
      return normalizedQuaternionBlendFromIdentity(
        profiledCoordinate,
        this.randomInnerQuaternion(time),
      );
    }
    if (this.options.mode === "naive") {
      return normalizedQuaternionBlendFromIdentity(
        profiledCoordinate,
        innerShellQuaternion(time, spinAxis),
      );
    }
    return nonsingularShellQuaternion(
      profiledCoordinate,
      time,
      spinAxis,
      choosePerpendicularDirection(spinAxis),
    );
  }

  setOptions(nextOptions, angle = 0) {
    const previousWireCount = this.options.wireCount;
    const previousSamples = this.options.radialSamples;
    Object.assign(this.options, nextOptions);
    if (
      this.options.wireCount !== previousWireCount ||
      this.options.radialSamples !== previousSamples
    ) {
      this.bundle.rebuild(
        this.options.wireCount,
        this.options.radialSamples,
      );
      this.tubeBundle.rebuild(
        this.options.wireCount,
        this.options.radialSamples,
      );
    }
    this.outerSphere.scale.setScalar(this.options.outerRadius);
    this.innerSphere.scale.setScalar(this.options.innerRadius);
    this.innerFrame.scale.setScalar(this.options.innerRadius * 0.78);
    this.innerSphere.material.wireframe = false;
    this.innerSphere.material.transparent = !this.options.innerOpaque;
    this.innerSphere.material.opacity = this.options.innerOpaque ? 1 : 0.62;
    this.innerSphere.material.depthWrite = this.options.innerOpaque;
    this.outerSphere.visible = this.options.showOuter;
    this.innerRotor.visible = this.options.showInner;
    this.intermediateShells.visible = this.options.showShells;
    this.bundle.endpoints.visible = this.options.showEndpoints;
    this.bundle.lines.visible = !this.options.sideTubes;
    this.tubeBundle.mesh.visible = this.options.sideTubes;

    this.updateAxisArrow();
    this.lastRenderedAngle = Number.NaN;
    this.update(angle);
  }

  updateAxisArrow() {
    const direction = new THREE.Vector3(...this.axisVector());
    this.axisArrow.position.copy(direction)
      .multiplyScalar(-this.options.outerRadius * 1.15);
    this.axisArrow.setDirection(direction);
    this.axisArrow.setLength(
      this.options.outerRadius * 2.3,
      0.2,
      0.1,
    );
    this.innerSphere.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(...this.textureAxisVector()),
    );
  }

  randomize(angle = 0) {
    this.randomCircle = randomGreatCircle();
    this.options.mode = "random";
    this.updateAxisArrow();
    this.lastRenderedAngle = Number.NaN;
    this.update(angle);
  }

  update(angle) {
    const updateThreshold = this.options.sideTubes ? 0.5 : 0.35;
    if (Math.abs(angle - this.lastRenderedAngle) < updateThreshold) return;
    this.lastRenderedAngle = angle;
    const time = angle * Math.PI / 180;
    const inner = this.options.mode === "random"
      ? this.randomInnerQuaternion(time)
      : innerShellQuaternion(time, this.axisVector());
    this.innerRotor.quaternion.set(...inner.v, inner.w);

    if (!this.options.sideTubes || this.options.showEndpoints) {
      this.bundle.update(
        this.options.innerRadius,
        this.options.outerRadius,
        (shellCoordinate) => this.quaternionAt(shellCoordinate, time),
      );
    }
    if (this.options.sideTubes) {
      this.tubeBundle.update(
        this.options.innerRadius,
        this.options.outerRadius,
        (shellCoordinate) => this.quaternionAt(shellCoordinate, time),
        this.options.flatTubes ? 6 : 1,
      );
    }
    this.intermediateShells.children.forEach((shell, index) => {
      const shellCoordinate = (index + 1) /
        (this.intermediateShells.children.length + 1);
      const radius = this.options.outerRadius -
        shellCoordinate *
          (this.options.outerRadius - this.options.innerRadius);
      const quaternion = this.quaternionAt(shellCoordinate, time);
      shell.scale.setScalar(radius);
      if (quaternion) shell.quaternion.set(...quaternion.v, quaternion.w);
    });
  }

  dispose() { disposeGroup(this.group); }
}

export const VIEW_CLASSES = {
  flags: FlagView,
  su2: SU2View,
  wires: WireFieldView,
  shells: ConcentricShellView,
};
