import * as Tone from "tone";
import type { HandParams } from "./types";

export class AudioEngine {
  private osc: Tone.FatOscillator;
  private filter: Tone.Filter;
  private reverb: Tone.Reverb;
  private delay: Tone.FeedbackDelay;
  private distortion: Tone.Distortion;
  private gain: Tone.Gain;
  private started = false;

  constructor() {
    this.osc = new Tone.FatOscillator({
      type: "sawtooth",
      frequency: 110,
      spread: 20,
      count: 3,
    });

    this.filter = new Tone.Filter({
      frequency: 800,
      type: "lowpass",
      rolloff: -24,
      Q: 2,
    });

    this.reverb = new Tone.Reverb({ decay: 4, wet: 0 });

    this.delay = new Tone.FeedbackDelay({
      delayTime: 0.25,
      feedback: 0.4,
      wet: 0,
    });

    this.distortion = new Tone.Distortion({
      distortion: 0,
      wet: 0,
      oversample: "4x",
    });

    this.gain = new Tone.Gain(0.25);

    this.osc.chain(
      this.filter,
      this.distortion,
      this.delay,
      this.reverb,
      this.gain,
      Tone.getDestination()
    );
  }

  async start() {
    if (this.started) return;
    await Tone.start();
    await this.reverb.ready;
    this.osc.start();
    this.started = true;
  }

  update(params: HandParams) {
    if (!this.started) return;

    if (!params.detected) {
      this.filter.frequency.rampTo(400, 0.3);
      this.reverb.wet.rampTo(0, 0.3);
      this.delay.wet.rampTo(0, 0.3);
      this.distortion.wet.rampTo(0, 0.3);
      return;
    }

    // Index finger -> filter cutoff (80 - 8000 Hz exponential)
    const freq = 80 * Math.pow(100, params.index);
    this.filter.frequency.rampTo(freq, 0.08);

    // Middle finger -> reverb wet
    this.reverb.wet.rampTo(params.middle * 0.85, 0.08);

    // Ring finger -> delay time + mix
    this.delay.delayTime.rampTo(0.05 + params.ring * 0.45, 0.08);
    this.delay.wet.rampTo(params.ring * 0.6, 0.08);

    // Pinky finger -> distortion
    this.distortion.distortion = params.pinky * 0.8;
    this.distortion.wet.rampTo(params.pinky * 0.7, 0.08);
  }

  stop() {
    if (!this.started) return;
    this.osc.stop();
    this.started = false;
  }
}
