export interface HandParams {
  /** 0-1, finger extension values */
  index: number;
  middle: number;
  ring: number;
  pinky: number;
  /** whether a hand is currently detected */
  detected: boolean;
}

export interface TwoHandParams {
  right: HandParams;
  left: HandParams;
}

export interface TrackedHands {
  right: Landmark[] | null;
  left: Landmark[] | null;
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
}
