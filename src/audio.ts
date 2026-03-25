import * as Tone from "tone";
import type { TwoHandParams } from "./types";

export class AudioEngine {
  private osc: Tone.FatOscillator;
  private filter: Tone.Filter;
  private reverb: Tone.Reverb;
  private delay: Tone.FeedbackDelay;
  private distortion: Tone.Distortion;
  private gain: Tone.Gain;
  private lfo: Tone.LFO;
  private lfoGain: Tone.Gain;
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

    // LFO for tremolo (left ring)
    this.lfoGain = new Tone.Gain(1);
    this.lfo = new Tone.LFO({ frequency: 0, min: 0.3, max: 1, type: "sine" });
    this.lfo.connect(this.lfoGain.gain);

    this.osc.chain(
      this.filter,
      this.distortion,
      this.delay,
      this.reverb,
      this.lfoGain,
      this.gain,
      Tone.getDestination()
    );
  }

  async start() {
    if (this.started) return;
    await Tone.start();
    await this.reverb.ready;
    this.osc.start();
    this.lfo.start();
    this.started = true;
  }

  update(params: TwoHandParams) {
    if (!this.started) return;
    const { right, left } = params;

    // --- Right hand: effects ---
    if (!right.detected) {
      this.filter.frequency.rampTo(400, 0.3);
      this.reverb.wet.rampTo(0, 0.3);
      this.delay.wet.rampTo(0, 0.3);
      this.distortion.wet.rampTo(0, 0.3);
    } else {
      // Index -> filter cutoff (80 - 8000 Hz)
      const freq = 80 * Math.pow(100, right.index);
      this.filter.frequency.rampTo(freq, 0.08);

      // Middle -> reverb wet
      this.reverb.wet.rampTo(right.middle * 0.85, 0.08);

      // Ring -> delay time + mix
      this.delay.delayTime.rampTo(0.05 + right.ring * 0.45, 0.08);
      this.delay.wet.rampTo(right.ring * 0.6, 0.08);

      // Pinky -> distortion
      this.distortion.distortion = right.pinky * 0.8;
      this.distortion.wet.rampTo(right.pinky * 0.7, 0.08);
    }

    // --- Left hand: tone shaping ---
    if (!left.detected) {
      this.osc.frequency.rampTo(110, 0.3);
      this.gain.gain.rampTo(0.25, 0.3);
      this.lfo.frequency.rampTo(0, 0.3);
      this.osc.spread = 20;
    } else {
      // Index -> pitch (55 Hz to 440 Hz, 3 octaves)
      const pitch = 55 * Math.pow(8, left.index);
      this.osc.frequency.rampTo(pitch, 0.08);

      // Middle -> volume (0.05 to 0.5)
      const vol = 0.05 + left.middle * 0.45;
      this.gain.gain.rampTo(vol, 0.08);

      // Ring -> tremolo rate (0 to 12 Hz)
      this.lfo.frequency.rampTo(left.ring * 12, 0.08);

      // Pinky -> oscillator spread/detune (5 to 80)
      this.osc.spread = 5 + left.pinky * 75;
    }
  }

  stop() {
    if (!this.started) return;
    this.osc.stop();
    this.lfo.stop();
    this.started = false;
  }
}
