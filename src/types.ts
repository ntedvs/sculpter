export interface HandParams {
  /** 0-1, index finger extension -> filter cutoff */
  index: number;
  /** 0-1, middle finger extension -> reverb wet */
  middle: number;
  /** 0-1, ring finger extension -> delay */
  ring: number;
  /** 0-1, pinky finger extension -> distortion */
  pinky: number;
  /** whether a hand is currently detected */
  detected: boolean;
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
}
