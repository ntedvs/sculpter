import * as THREE from "three";
import type { HandParams } from "./types";

const PARTICLE_COUNT = 2000;

export class Visualizer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private particles: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private basePositions: Float32Array;
  private params: HandParams = {
    index: 0,
    middle: 0,
    ring: 0,
    pinky: 0,
    detected: false,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    this.camera.position.z = 4;
    this.camera.position.x = 1.2;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Build particle sphere
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    this.basePositions = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = 0.9 + Math.random() * 0.4;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      this.basePositions[i * 3] = x;
      this.basePositions[i * 3 + 1] = y;
      this.basePositions[i * 3 + 2] = z;

      colors[i * 3] = 0.3;
      colors[i * 3 + 1] = 0.4;
      colors[i * 3 + 2] = 1.0;
    }

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particles = new THREE.Points(this.geometry, material);
    this.scene.add(this.particles);

    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  update(params: HandParams) {
    this.params = params;
  }

  render(time: number) {
    const { index, middle, ring, pinky, detected } = this.params;
    const positions = this.geometry.attributes.position
      .array as Float32Array;
    const colors = this.geometry.attributes.color.array as Float32Array;

    const mat = this.particles.material as THREE.PointsMaterial;
    const targetOpacity = detected ? 0.9 : 0.4;
    mat.opacity += (targetOpacity - mat.opacity) * 0.05;

    // Size responds to filter (index finger)
    const targetSize = detected ? 0.025 + index * 0.04 : 0.035;
    mat.size += (targetSize - mat.size) * 0.08;

    // Color: hue from filter (index), saturation from distortion (pinky)
    const hue = detected ? 0.55 + index * 0.35 : 0.6;
    const sat = detected ? 0.4 + pinky * 0.5 : 0.3;
    const lightness = detected ? 0.5 + middle * 0.15 : 0.45;
    const color = new THREE.Color().setHSL(hue, sat, lightness);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const bx = this.basePositions[i * 3];
      const by = this.basePositions[i * 3 + 1];
      const bz = this.basePositions[i * 3 + 2];

      // Sphere expands with reverb (middle finger)
      const spread = 1 + (detected ? middle * 1.5 : 0);

      // Distortion jitter (pinky finger)
      const jitterAmt = detected ? pinky * 0.35 : 0;
      const jitterPhase = Math.sin(i * 12.9898 + time * 8.0) * 0.5 + 0.5;
      const jitter = jitterAmt * jitterPhase;

      // Delay wave displacement (ring finger)
      const wave = detected
        ? Math.sin(time * 3 + i * 0.02) * ring * 0.25
        : 0;

      positions[i * 3] = bx * (spread + jitter) + wave * 0.5;
      positions[i * 3 + 1] = by * (spread + jitter);
      positions[i * 3 + 2] = bz * (spread + jitter) + wave * 0.5;

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    this.particles.rotation.y = time * 0.12;
    this.particles.rotation.x = Math.sin(time * 0.07) * 0.2;

    this.renderer.render(this.scene, this.camera);
  }
}
