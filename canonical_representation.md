# Canonical six-belt representation

This preset reconstructs the described geometry: six outer attachments along
±X, ±Y and ±Z, world +Y as up, and the top attachment connected to the bottom
of the inner sphere throughout its rotation. It is not a verified reproduction
of a particular historical animation.

The tube-count slider controls the attachments in every rotation pattern:
its minimum of six uses ±X, ±Y and ±Z; larger counts use the existing
Fibonacci-sphere distribution. Canonical mode keeps the selected count.

With Hamilton quaternion units i, j, k along X, Y, Z, start with a half-turn
about X, q₀ = i, then rotate about world Y:

    q(θ) = exp(jθ/2)i = i cos(θ/2) − k sin(θ/2).

This is the great circle S³ ∩ span(i,k), with coordinates
(w,x,y,z) = (0,cos(θ/2),0,−sin(θ/2)). It contains neither +1 nor −1.
It sends +Y to −Y, changes sign at θ + 2π, and repeats at θ + 4π.
The reversed order of multiplication would reverse the world rotation sense.
Choosing another horizontal initial half-turn only shifts the phase of this
same circle, so the description does not determine a unique starting phase.

At shell coordinate s (0 outer, 1 inner), use the existing Gaussian radial
profile u(s), then normalize (1−u) + u q(θ). Its squared norm is
(1−u)² + u² ≥ 1/2, so this interpolation never becomes singular.
Each radius receives one rigid rotation. Radius is preserved and distinct
directions remain distinct: ideal material curves cannot intersect. Finite
rendered tube widths are a separate geometric constraint.

Historical context: Holroyd's paper discusses Jason Hise's six-direction belt
animation, but does not establish that this exact parameterization was used:
https://arxiv.org/abs/2107.01681

The checks in tests/canonical-spinor.mjs cover the vertical spin, pole swap,
fixed boundary, nonsingularity, belt separation and 720° periodicity.
