/**
 * `ParticlePool` — the particle bridge. The engine runs headless (`render: 'none'`) and exposes its
 * swarm through `FieldHandle.readParticles(buf)` (stride 4: `x, y, heat, size`). This pool pulls
 * that buffer each frame and writes it onto a `THREE.Points` geometry via the `FieldProjection` —
 * position from `(x, y)`, an `aHeat`/`aSize` attribute per vertex for the material. Zero per-frame
 * allocation: the typed buffers are sized once to `capacity`.
 *
 * The conversion (`write`) is a pure function of the packed buffer + projection, so it is unit-
 * testable without a WebGL context; only the live `sync` needs a running field.
 */

import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { FieldProjection } from './project.ts';

const _v = new Vector3();

export interface ParticleStyle {
  /** color of cool (heat 0) matter (default a dim slate). */
  base?: string;
  /** color matter blends toward as it heats (default the field accent blue). */
  accent?: string;
  /** overall point-size multiplier (default 1). */
  size?: number;
  /** perspective focal term — larger = points shrink less with distance (default 300). */
  focal?: number;
}

export interface ParticlePoolOptions {
  /** maximum particles the buffers hold; the engine's live count is clamped to this. */
  capacity: number;
  /** the 2D↔3D mapping. */
  projection: FieldProjection;
  /** appearance. */
  style?: ParticleStyle;
}

/** The shader: color by `aHeat` (base→accent), size by `aSize` with perspective attenuation. */
function particleMaterial(style: ParticleStyle): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uBase: { value: new Color(style.base ?? '#3a4a63') },
      uAccent: { value: new Color(style.accent ?? '#4da3ff') },
      uSize: { value: style.size ?? 1 },
      uFocal: { value: style.focal ?? 300 },
    },
    vertexShader: /* glsl */ `
      attribute float aHeat;
      attribute float aSize;
      varying float vHeat;
      uniform float uSize;
      uniform float uFocal;
      void main() {
        vHeat = aHeat;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float s = aSize * uSize * (uFocal / max(0.0001, -mv.z));
        gl_PointSize = clamp(s, 1.0, 48.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vHeat;
      uniform vec3 uBase;
      uniform vec3 uAccent;
      void main() {
        float r = length(gl_PointCoord - vec2(0.5));
        if (r > 0.5) discard;
        float glow = smoothstep(0.5, 0.0, r);
        vec3 c = mix(uBase, uAccent, clamp(vHeat, 0.0, 1.0));
        gl_FragColor = vec4(c, glow);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

export class ParticlePool {
  readonly points: Points;
  readonly geometry: BufferGeometry;
  readonly material: ShaderMaterial;
  readonly capacity: number;
  private readonly projection: FieldProjection;
  /** stride-4 staging buffer `readParticles` fills: `[x, y, heat, size, …]`. */
  private readonly packed: Float32Array;
  private readonly position: Float32BufferAttribute;
  private readonly aHeat: Float32BufferAttribute;
  private readonly aSize: Float32BufferAttribute;
  private count = 0;

  constructor(opts: ParticlePoolOptions) {
    this.capacity = Math.max(1, opts.capacity | 0);
    this.projection = opts.projection;
    this.packed = new Float32Array(this.capacity * 4);

    this.geometry = new BufferGeometry();
    this.position = new Float32BufferAttribute(new Float32Array(this.capacity * 3), 3);
    this.aHeat = new Float32BufferAttribute(new Float32Array(this.capacity), 1);
    this.aSize = new Float32BufferAttribute(new Float32Array(this.capacity), 1);
    this.position.setUsage(35048 /* DynamicDrawUsage */);
    this.aHeat.setUsage(35048);
    this.aSize.setUsage(35048);
    this.geometry.setAttribute('position', this.position);
    this.geometry.setAttribute('aHeat', this.aHeat);
    this.geometry.setAttribute('aSize', this.aSize);
    this.geometry.setDrawRange(0, 0);

    this.material = particleMaterial(opts.style ?? {});
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false; // positions live in the attribute, not a static bound
  }

  /** the live particle count written by the last `sync`/`write`. */
  get size(): number {
    return this.count;
  }

  /** pull from a `readParticles`-shaped reader and push onto the geometry; returns the count. */
  sync(read: (out: Float32Array) => number): number {
    return this.write(read(this.packed));
  }

  /**
   * Convert the first `n` particles in the staging buffer into geometry attributes. Pure given the
   * projection — call directly in a test with a pre-filled `packed` buffer (via `staging`).
   */
  write(n: number): number {
    const count = Math.min(n, this.capacity);
    const pos = this.position.array as Float32Array;
    const heat = this.aHeat.array as Float32Array;
    const sz = this.aSize.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const o = i * 4;
      this.projection.toWorld(this.packed[o]!, this.packed[o + 1]!, this.packed[o + 2]!, this.packed[o + 3]!, _v);
      pos[i * 3] = _v.x;
      pos[i * 3 + 1] = _v.y;
      pos[i * 3 + 2] = _v.z;
      heat[i] = this.packed[o + 2]!;
      sz[i] = this.packed[o + 3]!;
    }
    this.count = count;
    this.geometry.setDrawRange(0, count);
    this.position.needsUpdate = true;
    this.aHeat.needsUpdate = true;
    this.aSize.needsUpdate = true;
    return count;
  }

  /** the stride-4 staging buffer — exposed for tests to fill before calling `write`. */
  get staging(): Float32Array {
    return this.packed;
  }

  /** release GPU resources. */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
