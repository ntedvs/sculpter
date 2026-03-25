import type { Landmark, HandParams } from "./types";

function dist(a: Landmark, b: Landmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// MediaPipe hand landmark indices
//  MCP = base knuckle, TIP = fingertip
const WRIST = 0;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_TIP = 20;

/** Measure how extended a finger is (0 = curled, 1 = straight) */
function fingerExtension(
  landmarks: Landmark[],
  tipIdx: number,
  mcpIdx: number,
  handSize: number,
): number {
  const d = dist(landmarks[tipIdx], landmarks[mcpIdx]);
  // Typical range: ~0.25*handSize (curled) to ~0.9*handSize (extended)
  return clamp01((d / handSize - 0.25) / 0.55);
}

export function analyzeHand(landmarks: Landmark[]): HandParams {
  // Hand size = wrist to middle finger MCP (stable reference)
  const handSize = dist(landmarks[WRIST], landmarks[MIDDLE_MCP]);

  const index = fingerExtension(landmarks, INDEX_TIP, INDEX_MCP, handSize);
  const middle = fingerExtension(landmarks, MIDDLE_TIP, MIDDLE_MCP, handSize);
  const ring = fingerExtension(landmarks, RING_TIP, RING_MCP, handSize);
  const pinky = fingerExtension(landmarks, PINKY_TIP, PINKY_MCP, handSize);

  return { index, middle, ring, pinky, detected: true };
}
