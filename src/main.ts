import { HandTracker } from "./hand-tracking";
import { analyzeHand } from "./hand-analysis";
import { AudioEngine } from "./audio";
import { Visualizer } from "./visualizer";
import type { HandParams, Landmark } from "./types";

const DEFAULT_PARAMS: HandParams = {
  index: 0,
  middle: 0,
  ring: 0,
  pinky: 0,
  detected: false,
};

// MediaPipe hand skeleton connections
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],           // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],           // index
  [5, 9], [9, 10], [10, 11], [11, 12],      // middle
  [9, 13], [13, 14], [14, 15], [15, 16],    // ring
  [13, 17], [17, 18], [18, 19], [19, 20],   // pinky
  [0, 17],                                    // wrist to pinky base
];

function drawHandWireframe(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  w: number,
  h: number
) {
  ctx.clearRect(0, 0, w, h);

  // Connections
  ctx.strokeStyle = "rgba(0, 255, 180, 0.6)";
  ctx.lineWidth = 2;
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
    ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
    ctx.stroke();
  }

  // Joints
  for (let i = 0; i < landmarks.length; i++) {
    const { x, y } = landmarks[i];
    ctx.beginPath();
    ctx.arc(x * w, y * h, 3, 0, Math.PI * 2);
    ctx.fillStyle = i === 8 || i === 12 || i === 16 || i === 20
      ? "rgba(255, 255, 255, 0.9)"  // fingertips bright
      : "rgba(0, 255, 180, 0.8)";
    ctx.fill();
  }
}

async function main() {
  const video = document.getElementById("video") as HTMLVideoElement;
  const canvas3d = document.getElementById("canvas3d") as HTMLCanvasElement;
  const overlay = document.getElementById("hand-overlay") as HTMLCanvasElement;
  const overlayCtx = overlay.getContext("2d")!;
  const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
  const statusEl = document.getElementById("status") as HTMLDivElement;
  const paramsEl = document.getElementById("params") as HTMLDivElement;

  // Start webcam
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: "user" },
  });
  video.srcObject = stream;
  await video.play();

  // Load hand tracking model
  statusEl.textContent = "Loading hand tracking model...";
  const tracker = new HandTracker(video);
  await tracker.init();

  const audio = new AudioEngine();
  const viz = new Visualizer(canvas3d);

  statusEl.textContent = "Ready -- click Start to begin";

  let running = false;
  let smoothed = { ...DEFAULT_PARAMS };
  const SMOOTH = 0.15;

  startBtn.addEventListener("click", async () => {
    if (!running) {
      await audio.start();
      running = true;
      startBtn.textContent = "Stop";
      statusEl.textContent = "Show your hand to the camera";
    } else {
      audio.stop();
      running = false;
      startBtn.textContent = "Start";
      statusEl.textContent = "Stopped";
      smoothed = { ...DEFAULT_PARAMS };
    }
  });

  function loop(timestamp: number) {
    const time = timestamp / 1000;

    if (running) {
      const landmarks = tracker.detect(performance.now());
      const raw = landmarks ? analyzeHand(landmarks) : { ...DEFAULT_PARAMS };

      // Exponential smoothing
      smoothed.index += (raw.index - smoothed.index) * SMOOTH;
      smoothed.middle += (raw.middle - smoothed.middle) * SMOOTH;
      smoothed.ring += (raw.ring - smoothed.ring) * SMOOTH;
      smoothed.pinky += (raw.pinky - smoothed.pinky) * SMOOTH;
      smoothed.detected = raw.detected;

      audio.update(smoothed);
      viz.update(smoothed);

      // Draw hand wireframe overlay
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
      if (landmarks) {
        drawHandWireframe(overlayCtx, landmarks, overlay.width, overlay.height);
      } else {
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
      }

      // HUD
      if (raw.detected) {
        paramsEl.textContent = [
          `Filter ${pct(smoothed.index)}`,
          `Reverb ${pct(smoothed.middle)}`,
          `Delay ${pct(smoothed.ring)}`,
          `Distort ${pct(smoothed.pinky)}`,
        ].join("  |  ");
      } else {
        paramsEl.textContent = "No hand detected";
      }
    }

    viz.render(time);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

function pct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

main().catch((err) => {
  const s = document.getElementById("status");
  if (s) s.textContent = `Error: ${err.message}`;
  console.error(err);
});
