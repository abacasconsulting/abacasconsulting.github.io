# How the Google Antigravity Effect Works (detailed)

This document explains exactly how the archived "Google Antigravity" effect is implemented, what to look for in the minified bundle, and how to reproduce the same technique reliably. The implementation in the bundle uses Three.js and an efficient GPU-driven particle pipeline (GPGPU) rather than per-particle CPU loops.

**Quick summary**: the effect is produced by storing particle state (position, scale, velocity) in an RGBA float texture, updating that state every frame with a fullscreen fragment shader (the "simulation pass"), then rendering particles as GL_POINTS where each vertex samples the state texture to get its position and appearance (the "render pass"). The sim pass is influenced by mouse/ring interaction and multi-scale noise.

**Primary file of interest**: `Google Antigravity_files/main-VSHXX3F7.js` — it contains the Three.js setup, Poisson sampling code for initial placement, DataTexture creation, sim & render GLSL, and the ping-pong render-target logic.

**Why this approach**
- Performance: the heavy per-particle math runs inside shaders on the GPU, enabling tens or hundreds of thousands of particles.
- Simplicity of rendering: the render pass only needs to sample a texture per-vertex; there is no per-particle CPU update loop.

**High-level architecture**
- Initialization
    - Generate a set of 2D points (Poisson-disk sampling) for initial positions.
    - Pack those points into a Float32Array sized `size * size * 4` and create a `THREE.DataTexture` (`posTex`) with `RGBA`/`FloatType`.
    - Create two `THREE.WebGLRenderTarget` objects (float RGBA) `rt1` and `rt2` to ping-pong simulation outputs.
- Per-frame update
    1. Bind `rt2` as the render target and render the sim scene (fullscreen quad) using `simMaterial` which reads `uPosition` (current pos texture) and computes the next state, outputting vec4(x, y, scale, velocity).
    2. Unbind the render target; set the render-material's `uPosition` to the texture written to `rt2` and render the visible points mesh which samples `uPosition` in the vertex shader to position each particle and set `gl_PointSize`.
    3. Swap `rt1` and `rt2` for the next frame.

**Data layout (exact)**
- Each particle corresponds to one texel (RGBA) in a float texture arranged as a square grid of side `size` (choose `size` s.t. `size*size >= particleCount`).
- Texel channels: R = x (normalized), G = y (normalized), B = scale, A = velocity.
- Unused texels (if any) are left zeroed.

Detailed breakdown

**1) Initialization — Poisson sampling → DataTexture**
- The bundle uses a Poisson-disk sampler to distribute initial particle positions with a minimum distance constraint. The sampler is invoked like `new Poisson({ shape:[500,500], ... }).fill()` (minified forms differ).
- The sampler returns 2D sample coordinates in a [0..500] range in the bundle; the code recenters and normalizes these values (bundle divides by 250 after subtracting 250 in some spots) before packing them into the Float32Array.
- Pseudocode used to create the DataTexture:

```js
const size = chooseSize(particleCount); // e.g. 256, 512
const data = new Float32Array(size * size * 4);
for (let i = 0; i < particleCount; i++) {
    const px = (points[i*2 + 0] - 250) / 250; // normalize if points in 0..500
    const py = (points[i*2 + 1] - 250) / 250;
    const r = i * 4;
    data[r + 0] = px;
    data[r + 1] = py;
    data[r + 2] = initialScale; // often 0
    data[r + 3] = 0.0; // initial velocity
}
const posTex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
posTex.needsUpdate = true;
```

**2) Simulation pass — fragment shader (core ideas and annotated pseudocode)**
- The sim pass runs as a fullscreen fragment shader. For each fragment (corresponding to a texel for one particle) it:
    - Reads current state: `vec4 p = texture(uPosition, uv);` where `p.xy` is position, `p.z` is scale, `p.w` is velocity.
    - Samples a reference position texture if available (morph targets) — `uPosRefs`.
    - Computes several multi-scale noise contributions (snoise/perlin) and small periodic offsets to add organic motion.
    - Computes ring/mouse interaction: measures distance to `uRingPos` and computes ring-shaped influence using `smoothstep` and power functions.
    - Applies displacement to `pos` based on interaction strength, noise, and internal inertia terms.
    - Updates `scale` and `velocity` with damping and contributions from the interaction.
    - Outputs `vec4(finalPos.x, finalPos.y, scale, velocity)` into the fragment color.

Annotated sim shader pseudocode:

```glsl
// for fragment at texel (i)
vec4 state = texture2D(uPosition, uv); // x,y,scale,velocity
vec2 ref = texture2D(uPosRefs, uv).xy; // optional morph target
float t = computeRingInfluence(ref, uRingPos, uRingRadius, uRingWidth);
vec2 noiseDisp = multiScaleNoise(ref, uTime);
vec2 newPos = ref + noiseDisp + inertiaTerm(state.xy);
newPos -= (uRingPos - (ref + noiseDisp)) * ringForce(t);
float newScale = smoothScale(state.z, t);
float newVel = damp(state.w) + newScale * 0.25;
gl_FragColor = vec4(newPos, newScale, newVel);
```

Key points to look for in the bundle's sim fragment shader:
- multiple `snoise` calls with different frequency multipliers (e.g. `pos * 0.2`, `pos * 20.`) for multi-scale motion
- `smoothstep` ranges and `pow` to shape ring influence
- writing `vec4(pos, scale, velocity)` to `gl_FragColor`

**3) Render pass — vertex & fragment shaders**
- Vertex shader responsibilities
    - Each vertex has an attribute `uv` that indexes into the `uPosition` texture.
    - The vertex shader samples `uPosition` (the latest sim texture) at `uv` to get position, scale, and velocity.
    - It computes clip-space position using `modelViewMatrix` and `projectionMatrix` and sets `gl_PointSize` based on `scale`, `uPixelRatio`, and `uParticleScale`.

- Fragment shader responsibilities
    - Draws a disc-shaped point sprite using `gl_PointCoord` (often with an `sdRoundBox` or circular alpha mask), discards low-alpha fragments.
    - Mixes several uniform colors (e.g. `uColor1/2/3`) based on `vVelocity` and procedurally generated noise for color variation.

Render vertex pseudocode:

```glsl
vec4 s = texture2D(uPosition, uv);
vVelocity = s.w; vScale = s.z;
vec4 mvPos = modelViewMatrix * vec4(s.xy, 0.0, 1.0);
gl_Position = projectionMatrix * mvPos;
gl_PointSize = vScale * someScaleFactor * uPixelRatio;
```

**4) Ping-pong lifecycle (JS wiring)**
- The typical flow in JS is:

```js
// before frame
simMaterial.uniforms.uPosition.value = rt1.texture; // or initial DataTexture on first frame
renderer.setRenderTarget(rt2);
renderer.render(simScene, simCamera); // writes next state into rt2

renderer.setRenderTarget(null);
renderMaterial.uniforms.uPosition.value = rt2.texture; // render using updated state
renderer.render(scene, camera);

// swap targets
const tmp = rt1; rt1 = rt2; rt2 = tmp;
```

**5) Interaction: ring / mouse mapping**
- The bundle uses a raycaster or a 2D mapping to compute `uRingPos` (world-space coordinate) from pointer/mouse position. The sim shader reads `uRingPos` and computes distance-based forces.
- Interaction parameters commonly exposed as uniforms: `uRingPos`, `uRingRadius`, `uRingWidth`, `uRingDisplacement` (force magnitude/time decay).

How to extract exact shader code from a minified bundle
- Search `main-VSHXX3F7.js` for `fragmentShader` or common glsl identifiers like `gl_FragColor`, `gl_PointCoord`, `snoise`, or `uPosition`.
- The bundle often stores shader strings inline inside `new ShaderMaterial({ fragmentShader: '...' })`. Copy the string and reformat it in a separate file for easier reading.

Reproduction recipe (step-by-step)
---------------------------------
Follow these steps to implement the same effect in a clean, readable project.

1) Project setup
     - npm init + install `three`.
     - Create a simple app with a canvas and Three.js renderer.

2) Create DataTexture
     - Decide `particleCount` and `size = ceil(sqrt(particleCount))`.
     - Fill a Float32Array `size*size*4` with normalized x,y (e.g. in range [-1,1] or [0,1] depending on conventions) and zeros for scale/velocity.
     - Create `posTex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType); posTex.needsUpdate = true;`

3) Build ping-pong render targets
     - `rt1 = new THREE.WebGLRenderTarget(size, size, { type: THREE.FloatType, format: THREE.RGBAFormat });`
     - `rt2 = rt1.clone();`

4) Create simScene
     - Fullscreen quad with `simMaterial` that takes `uPosition`, `uTime`, `uDeltaTime`, `uRingPos`, etc.
     - The fragment shader implements the sim logic described above and writes `vec4(newX, newY, newScale, newVel)`.

5) Create render geometry
     - Create a `BufferGeometry` with `particleCount` points. Add an `uv` attribute where each particle maps to its texel coordinate: `uv.x = (i % size + 0.5) / size`, `uv.y = (floor(i/size) + 0.5) / size`.
     - Create a `Points` mesh with `renderMaterial` which samples `uPosition` in the vertex shader.

6) Animation loop
     - On each frame: update `simMaterial` uniforms, render simScene to `rt2`, set `renderMaterial.uniforms.uPosition = rt2.texture`, render main scene to screen, swap `rt1/rt2`.

7) Interaction
     - Raycast into a plane at z=0 (or convert screen coords to world space) to get `uRingPos`; update uniforms when pointer moves.

Minimal code hints (exact snippets)
- UV packing for the particle geometry (JS)

```js
const uvs = new Float32Array(particleCount * 2);
for (let i = 0; i < particleCount; i++) {
    const x = (i % size) + 0.5;
    const y = Math.floor(i / size) + 0.5;
    uvs[i*2 + 0] = x / size;
    uvs[i*2 + 1] = y / size;
}
geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
```

Debugging tips
- If you get a black/white/noisy state texture:
    - Confirm `FloatType` is supported. Use `renderer.extensions.get('EXT_color_buffer_float')` or run under WebGL2.
    - On WebGL1 check for extension availability or fall back to packing floats into RGBA8 (more complex).
    - Visualize the state by rendering the RT texture to a quad and mapping channels to colors.
- Use `renderer.readRenderTargetPixels` on small RTs to inspect numerical values.

Performance & portability
- GPU sim requires float render targets. Test on target devices for `EXT_color_buffer_float` support.
- Use `size` as small as possible while keeping `size*size >= particleCount`.
- Lower noise frequency or offload some effects to fragment-level coloring if compute-bound.

Alternatives / simpler implementations
- CPU fallback: update positions on CPU arrays and upload into a DataTexture each frame — easier but much slower and limited to fewer particles.
- Instanced rendering with CPU-updated transforms is another alternative for moderate particle counts.

Appendix: exact vocabulary to search for in the minified bundle
- `DataTexture(..., FloatType)`, `WebGLRenderTarget`, `setRenderTarget`, `gl_FragColor`, `gl_PointCoord`, `snoise`, `uRingPos`, `uPosRefs`, `uPosition`, `texture2D(uPosition`, `ping-pong` (often swap or `tmp` variable).

If you want, I can now:
- Extract the exact shader source strings from `main-VSHXX3F7.js` and paste them (verbatim) into this doc, or
- Scaffold a minimal runnable reproduction under `reference/antigravity-repro/` (complete with `package.json`, `index.html`, `src` files and run instructions).

I made this document intentionally prescriptive so you can both understand the archived implementation and reproduce it with a modern, readable codebase. Tell me whether you want verbatim shader extraction or a runnable scaffold next.
