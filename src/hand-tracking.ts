import {
  HandLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";
import type { Landmark } from "./types";

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement;
  private lastTimestamp = -1;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );
    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }

  detect(timestamp: number): Landmark[] | null {
    if (!this.handLandmarker) return null;
    if (this.video.readyState < 2) return null;

    // Ensure monotonically increasing timestamps
    const ts = Math.max(timestamp, this.lastTimestamp + 1);
    this.lastTimestamp = ts;

    const results = this.handLandmarker.detectForVideo(this.video, ts);
    if (results.landmarks && results.landmarks.length > 0) {
      return results.landmarks[0] as Landmark[];
    }
    return null;
  }
}
