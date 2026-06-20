import * as THREE from 'three';

// A GPU-friendly particle system: ONE THREE.Points pool (one draw call) drawn as
// soft round sprites *procedurally* in the fragment shader (no texture file). The
// CPU integrates position/velocity/life each frame and recycles dead slots from a
// ring buffer. Make one system per "look" (gravity/blend differ); burst() or
// stream() into it. Colour and size are per-particle, so one system covers many
// effects (warm dust, bright sparks…) by varying the burst options.
//
//   const vfx = createParticles(scene, { max: 600, gravity: new THREE.Vector3(0,-2.5,0) });
//   vfx.burst(feet, 14, { speed: 1.6, spread: 0.7, up: 0.4, life: 0.5, size: 0.16, color: 0xcdd8ff });
//   loop.onFrame((t, dt) => vfx.update(dt));
export function createParticles(scene: any, {
  max = 500,
  gravity = new THREE.Vector3(0, -3, 0),
  drag = 0.2,
  blending = THREE.AdditiveBlending,
  sizeScale = 320,        // screen-space size factor (≈ pixels per world-unit at z=1)
}: any = {}) {
  const positions = new Float32Array(max * 3);
  const colors = new Float32Array(max * 3);
  const aLife = new Float32Array(max);    // 0..1 remaining → alpha (and shrink)
  const aSize = new Float32Array(max);
  const vel = new Float32Array(max * 3);  // CPU-only
  const life = new Float32Array(max);     // seconds remaining
  const maxLife = new Float32Array(max);
  const size0 = new Float32Array(max);
  let cursor = 0, alive = 0, acc = 0;

  const geo = new THREE.BufferGeometry();
  const dyn = (a: Float32Array, n: number) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', dyn(positions, 3));
  geo.setAttribute('aColor', dyn(colors, 3));
  geo.setAttribute('aLife', dyn(aLife, 1));
  geo.setAttribute('aSize', dyn(aSize, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: sizeScale } },
    transparent: true, depthWrite: false, blending,
    vertexShader: `
      attribute vec3 aColor; attribute float aLife; attribute float aSize;
      uniform float uScale; varying vec3 vColor; varying float vAlpha;
      void main() {
        vColor = aColor; vAlpha = aLife;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / max(-mv.z, 0.001);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || vAlpha <= 0.0) discard;          // round sprite, skip dead
        gl_FragColor = vec4(vColor, smoothstep(0.5, 0.0, d) * vAlpha);
      }`,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;        // particles roam past the mesh bounds
  scene.add(points);

  const _c = new THREE.Color();
  function spawnOne(ox: number, oy: number, oz: number, vx: number, vy: number, vz: number, lifeSec: number, sz: number, color: any) {
    const i = cursor; cursor = (cursor + 1) % max;     // ring buffer (overwrites oldest)
    positions[i*3]=ox; positions[i*3+1]=oy; positions[i*3+2]=oz;
    vel[i*3]=vx; vel[i*3+1]=vy; vel[i*3+2]=vz;
    life[i]=lifeSec; maxLife[i]=lifeSec; size0[i]=sz; aSize[i]=sz; aLife[i]=1;
    _c.set(color); colors[i*3]=_c.r; colors[i*3+1]=_c.g; colors[i*3+2]=_c.b;
  }

  // Spit `count` particles from `origin` with randomized velocity in an upward cone.
  function burst(origin: any, count = 10, {
    speed = 1.5, spread = 1.0, up = 0.5, life: lf = 0.6, lifeVar = 0.3,
    size = 0.15, sizeVar = 0.4, color = 0xffffff,
  }: any = {}) {
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      const s = speed * (0.5 + Math.random());
      spawnOne(
        origin.x, origin.y, origin.z,
        Math.cos(a) * r * s, (up + Math.random() * up) * s, Math.sin(a) * r * s,
        lf * (1 - lifeVar + Math.random() * lifeVar * 2),
        size * (1 - sizeVar + Math.random() * sizeVar * 2),
        color,
      );
    }
  }

  // Continuous emission at `rate` particles/sec (one accumulator → one source).
  function stream(origin: any, dt: number, rate: number, opts: any = {}) {
    acc += rate * dt;
    const n = Math.floor(acc);
    if (n > 0) { acc -= n; burst(origin, n, opts); }
  }

  function update(dt: number) {
    alive = 0;
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) { aLife[i] = 0; continue; }
      life[i] -= dt;
      if (life[i] <= 0) { aLife[i] = 0; continue; }
      vel[i*3] += gravity.x*dt; vel[i*3+1] += gravity.y*dt; vel[i*3+2] += gravity.z*dt;
      const k = Math.max(0, 1 - drag*dt);
      vel[i*3]*=k; vel[i*3+1]*=k; vel[i*3+2]*=k;
      positions[i*3] += vel[i*3]*dt; positions[i*3+1] += vel[i*3+1]*dt; positions[i*3+2] += vel[i*3+2]*dt;
      const f = life[i] / maxLife[i];        // 1 → 0 over the lifetime
      aLife[i] = f;
      aSize[i] = size0[i] * (0.4 + 0.6 * f); // shrink as it dies
      alive++;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    geo.attributes.aLife.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
  }

  function dispose() { scene.remove(points); geo.dispose(); mat.dispose(); }

  return { burst, stream, update, dispose, points, get count() { return alive; } };
}
