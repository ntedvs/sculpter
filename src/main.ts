import { HandTracker } from "./hand-tracking";
import { analyzeHand } from "./hand-analysis";
import { AudioEngine } from "./audio";
import { Visualizer } from "./visualizer";
import type { HandParams, Landmark, TwoHandParams } from "./types";

const DEFAULT_PARAMS: HandParams = {
  index: 0,
  middle: 0,
  ring: 0,
  pinky: 0,
  detected: false,
};

// MediaPipe hand skeleton connections
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4], // thumb
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8], // index
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12], // middle
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16], // ring
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20], // pinky
  [0, 17], // wrist to pinky base
];

function drawHandWireframe(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  w: number,
  h: number,
  strokeColor: string,
  jointColor: string,
) {
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
    ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
    ctx.stroke();
  }

  for (let i = 0; i < landmarks.length; i++) {
    const { x, y } = landmarks[i];
    ctx.beginPath();
    ctx.arc(x * w, y * h, 3, 0, Math.PI * 2);
    ctx.fillStyle =
      i === 8 || i === 12 || i === 16 || i === 20 ? "rgba(255, 255, 255, 0.9)" : jointColor;
    ctx.fill();
  }
}

function smoothHand(smoothed: HandParams, raw: HandParams, alpha: number) {
  smoothed.index += (raw.index - smoothed.index) * alpha;
  smoothed.middle += (raw.middle - smoothed.middle) * alpha;
  smoothed.ring += (raw.ring - smoothed.ring) * alpha;
  smoothed.pinky += (raw.pinky - smoothed.pinky) * alpha;
  smoothed.detected = raw.detected;
}

async function main() {
  const video = document.getElementById("video") as HTMLVideoElement;
  const canvas3d = document.getElementById("canvas3d") as HTMLCanvasElement;
  const overlay = document.getElementById("hand-overlay") as HTMLCanvasElement;
  const overlayCtx = overlay.getContext("2d")!;
  const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
  const statusEl = document.getElementById("status") as HTMLDivElement;
  const paramsEl = document.getElementById("params") as HTMLDivElement;

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: "user" },
  });
  video.srcObject = stream;
  await video.play();

  statusEl.textContent = "Loading hand tracking model...";
  const tracker = new HandTracker(video);
  await tracker.init();

  const audio = new AudioEngine();
  const viz = new Visualizer(canvas3d);
  const songInput = document.getElementById("song-input") as HTMLInputElement;
  const songName = document.getElementById("song-name") as HTMLDivElement;

  songInput.addEventListener("change", async () => {
    const file = songInput.files?.[0];
    if (!file) return;
    songName.textContent = file.name;
    statusEl.textContent = "Loading song...";
    await audio.loadSong(file);
    statusEl.textContent = "Song loaded -- click Start to begin";
  });

  statusEl.textContent = "Ready -- click Start to begin";

  let running = false;
  let smoothedRight = { ...DEFAULT_PARAMS };
  let smoothedLeft = { ...DEFAULT_PARAMS };
  const SMOOTH = 0.15;

  startBtn.addEventListener("click", async () => {
    if (!running) {
      await audio.start();
      running = true;
      startBtn.textContent = "Stop";
      statusEl.textContent = "Show your hands to the camera";
    } else {
      audio.stop();
      running = false;
      startBtn.textContent = "Start";
      statusEl.textContent = "Stopped";
      smoothedRight = { ...DEFAULT_PARAMS };
      smoothedLeft = { ...DEFAULT_PARAMS };
    }
  });

  function loop(timestamp: number) {
    const time = timestamp / 1000;

    if (running) {
      const hands = tracker.detect(performance.now());
      const rawRight = hands.right ? analyzeHand(hands.right) : { ...DEFAULT_PARAMS };
      const rawLeft = hands.left ? analyzeHand(hands.left) : { ...DEFAULT_PARAMS };

      smoothHand(smoothedRight, rawRight, SMOOTH);
      smoothHand(smoothedLeft, rawLeft, SMOOTH);

      const twoHands: TwoHandParams = { right: smoothedRight, left: smoothedLeft };
      audio.update(twoHands);
      viz.update(twoHands);

      // Draw hand wireframes
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
      overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
      if (hands.right) {
        drawHandWireframe(
          overlayCtx,
          hands.right,
          overlay.width,
          overlay.height,
          "rgba(0, 255, 180, 0.6)",
          "rgba(0, 255, 180, 0.8)",
        );
      }
      if (hands.left) {
        drawHandWireframe(
          overlayCtx,
          hands.left,
          overlay.width,
          overlay.height,
          "rgba(255, 140, 50, 0.6)",
          "rgba(255, 140, 50, 0.8)",
        );
      }

      // HUD
      const lines: string[] = [];
      if (rawRight.detected) {
        lines.push(
          `R: Filter ${pct(smoothedRight.index)}  Reverb ${pct(smoothedRight.middle)}  Delay ${pct(smoothedRight.ring)}  Distort ${pct(smoothedRight.pinky)}`,
        );
      }
      if (rawLeft.detected) {
        lines.push(
          `L: Pitch ${pct(smoothedLeft.index)}  Volume ${pct(smoothedLeft.middle)}  Tremolo ${pct(smoothedLeft.ring)}  Spread ${pct(smoothedLeft.pinky)}`,
        );
      }
      paramsEl.textContent = lines.length > 0 ? lines.join("\n") : "No hands detected";
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
