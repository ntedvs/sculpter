import * as THREE from "three";
import type { HandParams, TwoHandParams } from "./types";

const PARTICLE_COUNT = 2000;

const DEFAULT_HAND: HandParams = {
  index: 0,
  middle: 0,
  ring: 0,
  pinky: 0,
  detected: false,
};

export class Visualizer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private particles: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private basePositions: Float32Array;
  private params: TwoHandParams = {
    right: { ...DEFAULT_HAND },
    left: { ...DEFAULT_HAND },
  };

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    this.camera.position.z = 4;

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

    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
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

  update(params: TwoHandParams) {
    this.params = params;
  }

  render(time: number) {
    const { right, left } = this.params;
    const anyDetected = right.detected || left.detected;
    const positions = this.geometry.attributes.position.array as Float32Array;
    const colors = this.geometry.attributes.color.array as Float32Array;

    const mat = this.particles.material as THREE.PointsMaterial;
    const targetOpacity = anyDetected ? 0.9 : 0.4;
    mat.opacity += (targetOpacity - mat.opacity) * 0.05;

    // Size: right index (filter) + left middle (volume)
    const sizeR = right.detected ? right.index * 0.04 : 0;
    const sizeL = left.detected ? left.middle * 0.03 : 0;
    const targetSize = anyDetected ? 0.025 + sizeR + sizeL : 0.035;
    mat.size += (targetSize - mat.size) * 0.08;

    // Color: right hand sets hue/sat, left hand shifts hue + brightness
    const hueR = right.detected ? 0.55 + right.index * 0.35 : 0.6;
    const hueShift = left.detected ? left.index * 0.2 : 0;
    const hue = (hueR + hueShift) % 1.0;
    const sat = right.detected ? 0.4 + right.pinky * 0.5 : 0.3;
    const lightBase = right.detected ? 0.5 + right.middle * 0.15 : 0.45;
    const lightBoost = left.detected ? left.middle * 0.15 : 0;
    const lightness = Math.min(lightBase + lightBoost, 0.85);
    const color = new THREE.Color().setHSL(hue, sat, lightness);

    // Left ring -> tremolo pulsing of scale
    const tremoloAmt = left.detected ? left.ring * 0.15 : 0;
    const tremoloPulse = 1 + Math.sin(time * 12 * (left.detected ? left.ring : 0)) * tremoloAmt;

    // Left pinky -> rotation turbulence / spread wobble
    const turbulence = left.detected ? left.pinky * 0.4 : 0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const bx = this.basePositions[i * 3];
      const by = this.basePositions[i * 3 + 1];
      const bz = this.basePositions[i * 3 + 2];

      // Right middle -> sphere expansion (reverb)
      const spread = 1 + (right.detected ? right.middle * 1.5 : 0);

      // Right pinky -> jitter (distortion)
      const jitterAmt = right.detected ? right.pinky * 0.35 : 0;
      const jitterPhase = Math.sin(i * 12.9898 + time * 8.0) * 0.5 + 0.5;
      const jitter = jitterAmt * jitterPhase;

      // Right ring -> wave displacement (delay)
      const wave = right.detected ? Math.sin(time * 3 + i * 0.02) * right.ring * 0.25 : 0;

      // Left pinky -> turbulence offset per particle
      const turb =
        turbulence > 0
          ? Math.sin(i * 7.13 + time * 5) * Math.cos(i * 3.71 + time * 3.7) * turbulence
          : 0;

      const s = (spread + jitter) * tremoloPulse;
      positions[i * 3] = bx * s + wave * 0.5 + turb;
      positions[i * 3 + 1] = by * s + turb * 0.7;
      positions[i * 3 + 2] = bz * s + wave * 0.5 - turb * 0.5;

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    // Left index (pitch) affects rotation speed
    const rotSpeed = 0.12 + (left.detected ? left.index * 0.3 : 0);
    this.particles.rotation.y = time * rotSpeed;
    this.particles.rotation.x = Math.sin(time * 0.07) * 0.2;

    this.renderer.render(this.scene, this.camera);
  }
}
