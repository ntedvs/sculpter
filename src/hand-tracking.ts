import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { Landmark, TrackedHands } from "./types";

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement;
  private lastTimestamp = -1;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
    );
    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }

  detect(timestamp: number): TrackedHands {
    const result: TrackedHands = { right: null, left: null };
    if (!this.handLandmarker) return result;
    if (this.video.readyState < 2) return result;

    const ts = Math.max(timestamp, this.lastTimestamp + 1);
    this.lastTimestamp = ts;

    const results = this.handLandmarker.detectForVideo(this.video, ts);
    if (!results.landmarks || !results.handednesses) return result;

    for (let i = 0; i < results.landmarks.length; i++) {
      const label = results.handednesses[i]?.[0]?.categoryName;
      if (label === "Right") {
        result.right = results.landmarks[i] as Landmark[];
      } else if (label === "Left") {
        result.left = results.landmarks[i] as Landmark[];
      }
    }
    return result;
  }
}
