// Minimal Fundamental × Three.js example.
//
// `createFieldLayer` runs the reciprocal field engine headless (render: 'none')
// and exposes its particle swarm as a THREE.Points object you add to your own
// scene. We add the layer, tick it each frame, and render. No DOM physics — the
// engine self-steps; layer.tick() just pulls the latest swarm onto the geometry.
import * as THREE from 'three';
import { createFieldLayer, PlaneProjection } from '@fundamental-engine/three';

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(app.clientWidth, app.clientHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, app.clientWidth / app.clientHeight, 0.1, 1000);
camera.position.set(0, 0, 14);
camera.lookAt(0, 0, 0);

// The field: a flat 1000×600 px field projected onto a quad. `relief` lifts each
// particle's z from its heat for a little dimensionality.
const layer = createFieldLayer({
  projection: new PlaneProjection({ relief: 2 }),
  renderer,
  // swarm appearance lives under `style` (accent is a ParticleStyle field).
  style: { accent: '#4da3ff' },
});
scene.add(layer.object);

// A body bends the field; the swarm reciprocates. A gentle attractor at center.
layer.addBody(new THREE.Object3D(), { tokens: 'attract', strength: 0.6, range: 280 });

const countEl = document.getElementById('count');

renderer.setAnimationLoop(() => {
  layer.tick(); // pull the latest engine swarm onto the Points geometry
  layer.object.rotation.z += 0.0008; // slow drift so the field reads as 3D
  renderer.render(scene, camera);
  countEl.textContent = String(layer.particleCount());
});

addEventListener('resize', () => {
  renderer.setSize(app.clientWidth, app.clientHeight);
  camera.aspect = app.clientWidth / app.clientHeight;
  camera.updateProjectionMatrix();
});

// Expose the layer so a smoke test (and curious devs) can read live state.
window.__fieldLayer = layer;
