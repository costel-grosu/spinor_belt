# Explore spinor representations

A no-build Three.js visualization of spinors ,just C2 spinors that transform with SU(2).

## What It Shows

Switch between multiple views.

View 1: represent spinors as flags.
Take the Bloch sphere, and add spinors for all axis. Then rotate the sphere on a plane, show how the spinors / flags transform.
Use different colors for each spinor/flag.

View 2: take the same Bloch sphere and spinors, and slowly rotate with random SU2 matrix. Button to generate a new SU2 matrix.

View 3: Dirac belt. Interpolate from one fixed spinor to another rotating spinor. Both spinors have fixed R3 position, and the curve need to interpolate both the orientation given by the spinors and the R3 position.

View 4: trace three colored families of RK4 integral curves through a compact
SU(2) quaternion field. The central frame completes a 4π spin while the field
stays fixed outside its active radius; an off-axis escape term keeps the
intermediate field nonsingular.

View 5: concentric spherical shells carry fixed angular labels between a
rotating inner sphere and a stationary outer sphere. Material wires use the
explicit nonsingular quaternion filling, with controls for the naïve
interpolation and a random great-circle trajectory on S³.

## Runtime Controls

- `Pause simulation`: freezes simulation time, keeps rendering active.
- `Stop rendering`: stops the animation loop.
- `Enter VR`: starts an immersive WebXR session on compatible headsets such as Quest 3.
- `Space`: shortcut for pause/resume simulation.
- Mouse (OrbitControls): inspect scene manually.

## HUD

- Five view tabs switch between the flag, SU(2), belt-trick, quaternion-field,
  and concentric-shell scenes.
- The angle slider scrubs the full 0–720° spinor cycle.
- The speed slider controls automatic rotation from 0–900 degrees per second in every view.
- The flag-count slider switches between 6, 12, 24, and 48 flags in the flag-based views.
- The shell settings control 6–500 wires, radial-sample counts, both radii, X/Y/Z
  spin axes, boundary and endpoint visibility, inner-sphere opacity,
  quaternion-filling mode, and a square-cross-section tube alternative using
  the same configurable count as the wire bundle.
- Pause, rendering, reset, random-generator, and WebXR controls are available
  contextually.

## Current Default Configuration (`src/config.js`)

- Perspective camera: 38° field of view, position `(5.8, 3.8, 7.8)`.
- Bloch sphere radius: `1.62` scene units.
- Flag sample count: `12`.
- Automatic rotation speed: `22` degrees per second.

## Rendering Notes

- The app uses ES modules and local vendored Three.js files through an import map.
- The page uses a white background with light HUD chrome for better contrast
  against saturated section colors.


## Project Structure

- `index.html`: canvas, HUD, import map, and app entry point.
- `https_server.py`: local HTTPS static server for Quest 3 / WebXR testing.
- `styles/main.css`: responsive fullscreen layout and controls.
- `src/config.js`: camera and visualization defaults.
- `src/spinor-math.js`: rendering-independent spinor and geometry calculations.
- `src/main.js`: renderer, lifecycle, UI, and WebXR session handling.
- `src/visualizations.js`: flag, SU(2), belt, quaternion-field, and
  concentric-shell scene implementations.

The sphere views keep their states as explicit normalized C² spinor arrays.
`src/spinor-math.js` constructs 2×2 complex SU(2) matrices and applies them
with `multiplySU2Spinor`; Three.js only renders the resulting Bloch directions
and full orientation frames. Each frame is converted directly from its spinor
to a quaternion, avoiding the antipodal-vector singularity of reconstructing
an orientation from the Bloch direction alone.

For the flag representation, each transformed spinor is decomposed as
`exp(i * gamma) * canonicalSpinor(blochDirection)`. The Bloch direction places
the pole, while `gamma` alone rotates the cloth hinge. No animation angle is
passed separately into the flag mapping.

The belt view exposes its fixed and rotating endpoint spinors as flags. Belt
cross-sections are generated from spinors along the same SU(2) path, ensuring
that both ends match the corresponding flag orientations.

Its regenerate control creates two new random normalized spinors and a random
rotation axis. The belt centerline is a Hermite curve whose endpoint tangents
follow the outward flagpole directions, allowing outward-facing flags to pull
the belt into a detour before it returns to the opposite endpoint.

The wire view implements a smooth compact radial profile, composes its initial
texture with the 4π spin loop in space-fixed order, and integrates the induced
local frame directions in both directions from a 3×3 seed grid. Its contextual
button toggles between the identity and an initial π flip about the x-axis.

The concentric-shell view instead keeps one angular label fixed along each
material wire. A merged, dynamically updated line-segment buffer maps every
label through the same rigid rotation on each radius, so distinct wires cannot
intersect. The nonsingular filling escapes through a stable perpendicular
quaternion axis at the naïve interpolation's identity-to-minus-identity
singularity. The random S³ mode generates an orthonormal point and tangent in
four dimensions, then follows their great circle. A normalized Gaussian-CDF
shell profile makes the quaternion interpolation nearly stationary next to
both boundary spheres and concentrates the visible change between them.

## Run (no npm required)
First stage of development (fast), just use a http server and a browser on same machine.
Second stage (slow), use a https server and quest3 for 3d visualization.

```bash
python -m http.server 8000
```

Then open:
- `http://localhost:8000`

> If you have Python 2 (not recommended): `python -m SimpleHTTPServer 8000`


## Quest 3 / WebXR

Open the app in Meta Quest Browser and press `Enter VR`.

WebXR requires a secure origin. `localhost` is allowed on the same machine, but
Quest 3 connects from another device, so `http://<your-pc-ip>:8000` usually will
not be accepted for immersive VR. Use HTTPS for headset testing.

This repo includes a small HTTPS static server:

```bash
python https_server.py
```

It serves the project at:

- `https://<your-pc-ip>:4444/`

The helper expects `cert.pem` and `key.pem` in the project directory. Those cert
files are local machine material and are intentionally not committed. If the
Quest browser warns about a self-signed certificate, accept/trust it before
pressing `Enter VR`.

In VR, the scene starts in front of you at a smaller scale. Hold either trigger
or grip and move/rotate your controller to rotate the visualization. Use the
right thumbstick up/down to zoom. Press the right-side secondary button such as
`B` to exit VR. If the browser maps Quest face buttons differently, either
right-side face button will request exit. WebXR foveation is set to `0` for
full-resolution rendering.

## Tests

No automated tests currently. Smoke check with:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` and verify the scene renders.
