Implement an interactive 3D visualization of the Dirac belt trick / spin-(\tfrac12) rotation using concentric spherical shells and quaternion interpolation.

## Goal

Create a visualization of a spherical shell bounded by:

* an inner sphere of radius `innerRadius`
* an outer sphere of radius `outerRadius`

The outer sphere remains fixed.

The inner sphere undergoes a continuous (4\pi) rotation.

Between them, define concentric shells. Each shell has an orientation represented by a unit quaternion interpolating between:

[
Q(0,t)=1
]

at the outer sphere and

[
Q(1,t)=q_{\text{inner}}(t)
]

at the inner sphere.

Points with the same angular label (\omega\in S^2) are matched across all shells. For each fixed label (\omega), the points across the shells form a material wire:

[
\gamma_{\omega,t}(r)
====================

r,Q(s(r),t),\omega,Q(s(r),t)^{-1}.
]

The wires must remain continuous and nonintersecting, and after a (4\pi) rotation they must return to their initial straight radial state.


## Coordinate definitions

Let:

```ts
innerRadius = a
outerRadius = R
```

Define a normalized shell coordinate:

```ts
s(r) = (R - r) / (R - a)
```

Therefore:

```ts
s(innerRadius) = 1
s(outerRadius) = 0
```

The outer boundary corresponds to the identity quaternion, and the inner boundary corresponds to the rotating quaternion.

## Central quaternion trajectory

Let the physical rotation angle be:

```ts
rotationAngle = t
```

with:

```ts
0 <= t <= 4 * Math.PI
```

For a fixed spin axis `n`, the inner quaternion is:

[
q_{\text{inner}}(t)
===================

\cos\frac t2
+
\hat n\sin\frac t2.
]

In code, use a normalized `THREE.Vector3` for the axis.

The corresponding visible inner sphere rotation is the ordinary SO(3) rotation induced by this quaternion.

At:

```ts
t = 0
```

the quaternion is (+1).

At:

```ts
t = 2 * Math.PI
```

the quaternion is (-1), although the visible SO(3) orientation is again the identity.

At:

```ts
t = 4 * Math.PI
```

the quaternion returns to (+1).

## Nonsingular quaternion filling

Do not use ordinary quaternion slerp directly between the identity and the inner quaternion, because the interpolation becomes ambiguous when the inner quaternion reaches (-1).

Instead, use the following explicit nonsingular filling.

Let:

[
\alpha=\frac t2.
]

Choose:

* `n`: the spin-axis unit vector
* `p`: another unit vector perpendicular to `n`

For shell parameter (s\in[0,1]), define:

[
A=1-s+s\cos\alpha,
]

[
B=s\sin\alpha,
]

[
D=A^2+B^2.
]

Then define the unit quaternion:

[
Q(s,\alpha)
===========

\frac{
2A
+
2B,\hat n
+
(D-1)\hat p
}{
D+1
}.
]

Interpret this as a quaternion with:

```ts
scalar part:
    w = 2 * A / (D + 1)

vector part:
    v = (
        2 * B * n
        + (D - 1) * p
    ) / (D + 1)
```

Map the vector part into Three.js quaternion components:

```ts
new THREE.Quaternion(v.x, v.y, v.z, w)
```

Normalize defensively after construction.

This filling must satisfy numerically:

```ts
Q(0, t) = identity
Q(1, t) = qInner(t)
Q(s, 0) = identity
Q(s, 4 * Math.PI) = identity
```

At the former singular point:

```ts
s = 0.5
t = 2 * Math.PI
```

the quaternion should equal approximately `-p`, rather than becoming undefined.

## Wire construction

Create a set of angular labels:

```ts
omega_i in S^2
```

Use a visually useful distribution, such as:

* Fibonacci sphere sampling, or
* several latitude-longitude rings

Prefer Fibonacci sphere sampling for an even distribution.

For every label `omega`, create one wire.

At a fixed animation time `t`, sample radii:

```ts
r_j from innerRadius to outerRadius
```

For each radius:

1. compute `s = shellParameter(r)`
2. compute `Q = quaternionField(s, t)`
3. rotate `omega` by `Q`
4. multiply by `r`

Mathematically:

[
x(r)=r,R(Q(s,t))\omega.
]

In Three.js:

```ts
const point = omega.clone()
    .applyQuaternion(Q)
    .multiplyScalar(r)
```

Use these points to update a `THREE.BufferGeometry`.

Render the wire using either:

* `THREE.Line`
* `THREE.Line2` from Three.js examples for adjustable line width
* or tube geometry for a smaller number of wires

Start with `THREE.Line` or `Line2` for performance.

The same `omega` must be reused for that wire at every radius and every animation frame. Do not recompute wires as independent vector-field integral curves.

## Important topological property

The mapping is:

[
F_t(\omega,r)
=============

r,R(Q(s(r),t))\omega.
]

This is injective because:

* quaternion rotations preserve radius
* different radii remain on different shells
* each shell map is a rigid rotation and therefore one-to-one

Do not add arbitrary noise or displacement that could cause wire intersections.

## Scene contents

Render:

1. the inner sphere
2. the outer sphere, preferably transparent or wireframe
3. the connecting wires
4. optionally several faint intermediate concentric shells
5. a visible axis indicator for the spin axis
6. optional local coordinate axes attached to the inner sphere

The inner sphere should visibly rotate using the same `qInner(t)` quaternion.

The outer sphere must remain fixed.

## Controls

Add UI controls for:

* play / pause
* reset
* animation time slider from `0` to `4π`
* animation speed
* number of wires
* radial samples per wire
* inner radius
* outer radius
* spin axis, at least presets for X, Y, and Z
* toggle inner sphere
* toggle outer sphere
* toggle intermediate shells
* toggle wire labels or endpoints
* toggle between the nonsingular filling and the naive interpolation for comparison


```ts
interface FieldParameters {
  spinAxis: THREE.Vector3
  escapeAxis: THREE.Vector3
  time: number
}

function shellParameter(
  radius: number,
  innerRadius: number,
  outerRadius: number
): number

function innerQuaternion(
  time: number,
  spinAxis: THREE.Vector3
): THREE.Quaternion

function nonsingularQuaternionField(
  s: number,
  time: number,
  spinAxis: THREE.Vector3,
  escapeAxis: THREE.Vector3
): THREE.Quaternion

function naiveQuaternionField(
  s: number,
  time: number,
  spinAxis: THREE.Vector3
): THREE.Quaternion
```

Create a `WireBundle` class that:

* stores fixed angular labels
* owns one geometry per wire or an efficient merged representation
* updates point positions in place
* does not recreate all Three.js objects every frame
* marks position buffers as needing update
* supports changing wire count by rebuilding only when necessary

## Escape-axis selection

Given normalized spin axis `n`, select a stable perpendicular vector.

For example:

```ts
function choosePerpendicularAxis(n: THREE.Vector3): THREE.Vector3 {
  const reference =
    Math.abs(n.x) < 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0)

  return new THREE.Vector3()
    .crossVectors(n, reference)
    .normalize()
}
```

Keep `p` stable while the spin axis remains unchanged.

## Numerical tests

Add tests with tolerances around `1e-6`.

Test:

```ts
Q(0, t) approximately identity
Q(1, t) approximately qInner(t)
Q(s, 0) approximately identity
Q(s, 4π) approximately identity
norm(Q) approximately 1
Q(0.5, 2π) approximately quaternion with vector part -p
```

Remember that quaternions `q` and `-q` represent the same SO(3) rotation, but for these field-boundary tests compare the intended SU(2) values, not only their induced rotations.

Also test the wire mapping:

```ts
length(F(omega, r, t)) approximately r
```

For randomly chosen distinct samples on the same shell, verify that rotation preserves angular separation.

## Performance

Target smooth interaction with approximately:

```text
100–500 wires
50–150 radial samples per wire
```

Avoid allocating new vectors and quaternions in inner animation loops.

Reuse temporary `THREE.Vector3` and `THREE.Quaternion` objects.

Update geometry buffers directly.


Important: add mode where the central quartenion is a random point on S3. And the direction of big circle on S3 is also chosen at random. This mode is not affected by the singularity of -1.
