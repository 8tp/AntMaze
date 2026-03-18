const STORAGE_KEY = "antmaze_audio";

// ---- Musical constants ----

const MELODY_NOTES = [
  261.63, 293.66, 329.63, 392.0, 440.0,
  523.25, 587.33, 659.25,
];

const BASS_NOTES = [
  130.81, 146.83, 164.81, 196.0,
  130.81, 196.0, 164.81, 146.83,
];

const BPM = 95;
const BEAT_SEC = 60 / BPM;

interface AudioPrefs {
  musicOn: boolean;
  sfxOn: boolean;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private _musicOn: boolean;
  private _sfxOn: boolean;

  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private beatIndex = 0;
  private melodyIndex = 0;
  private musicPlaying = false;

  private melodyPattern = [0, 2, 4, 3, 5, 4, 2, 1, 0, -1, 3, 4, 7, 6, 5, 3];

  constructor() {
    const prefs = this.loadPrefs();
    this._musicOn = prefs.musicOn;
    this._sfxOn = prefs.sfxOn;
  }

  get musicOn(): boolean { return this._musicOn; }
  get sfxOn(): boolean { return this._sfxOn; }
  get muted(): boolean { return !this._musicOn && !this._sfxOn; }

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this._musicOn ? 0.25 : 0;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this._sfxOn ? 0.5 : 0;
    this.sfxGain.connect(this.masterGain);
  }

  setMusicOn(on: boolean): void {
    this._musicOn = on;
    if (this.musicGain) {
      this.musicGain.gain.value = on ? 0.25 : 0;
    }
    this.savePrefs();
  }

  setSfxOn(on: boolean): void {
    this._sfxOn = on;
    if (this.sfxGain) {
      this.sfxGain.gain.value = on ? 0.5 : 0;
    }
    this.savePrefs();
  }

  /** Legacy toggle — flips both music and sfx together. */
  toggleMute(): boolean {
    const allOff = !this._musicOn && !this._sfxOn;
    this.setMusicOn(allOff);
    this.setSfxOn(allOff);
    return !allOff ? false : true; // returns new "muted" state (false = unmuted)
  }

  // ----------------------------------------------------------------
  // Music
  // ----------------------------------------------------------------

  startMusic(): void {
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this.beatIndex = 0;
    this.melodyIndex = 0;
    this.playBeat();
    this.musicTimer = setInterval(() => this.playBeat(), BEAT_SEC * 1000);
  }

  stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private playBeat(): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;

    const bassFreq = BASS_NOTES[this.beatIndex % BASS_NOTES.length];
    this.playTone(bassFreq, "sine", 0.3, BEAT_SEC * 0.8, now, this.musicGain);

    if (this.beatIndex % 2 === 0) {
      const noteIdx = this.melodyPattern[this.melodyIndex % this.melodyPattern.length];
      if (noteIdx >= 0) {
        this.playPluck(MELODY_NOTES[noteIdx], BEAT_SEC * 1.5, now, this.musicGain);
      }
      this.melodyIndex++;
    }

    this.playHiHat(now, this.musicGain);
    if (this.beatIndex % 4 === 0 || this.beatIndex % 4 === 2) {
      this.playKick(now, this.musicGain);
    }

    this.beatIndex++;
  }

  // ----------------------------------------------------------------
  // SFX
  // ----------------------------------------------------------------

  playWallHit(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);

    this.playNoiseBurst(0.06, 0.6, now, this.sfxGain);
  }

  playLevelComplete(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      this.playPluck(freq, 0.35, now + i * 0.12, this.sfxGain!, 0.5);
    });
  }

  playDirectionChange(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  // ----------------------------------------------------------------
  // Tone primitives
  // ----------------------------------------------------------------

  private playTone(
    freq: number, type: OscillatorType, vol: number,
    dur: number, startTime: number, dest: AudioNode
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    osc.connect(gain).connect(dest);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.05);
  }

  private playPluck(
    freq: number, dur: number, startTime: number,
    dest: AudioNode, vol = 0.3
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.setValueAtTime(vol, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    osc.connect(gain).connect(dest);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.05);
  }

  private playHiHat(startTime: number, dest: AudioNode): void {
    this.playNoiseBurst(0.04, 0.08, startTime, dest);
  }

  private playKick(startTime: number, dest: AudioNode): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, startTime);
    osc.frequency.exponentialRampToValueAtTime(30, startTime + 0.12);
    gain.gain.setValueAtTime(0.35, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
    osc.connect(gain).connect(dest);
    osc.start(startTime);
    osc.stop(startTime + 0.2);
  }

  private playNoiseBurst(
    dur: number, vol: number, startTime: number, dest: AudioNode
  ): void {
    if (!this.ctx) return;
    const bufferSize = Math.ceil(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7000;
    src.connect(filter).connect(gain).connect(dest);
    src.start(startTime);
  }

  // ----------------------------------------------------------------
  // Persistence
  // ----------------------------------------------------------------

  private loadPrefs(): AudioPrefs {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        return {
          musicOn: obj.musicOn !== false,
          sfxOn: obj.sfxOn !== false,
        };
      }
    } catch { /* ignore */ }
    return { musicOn: true, sfxOn: true };
  }

  private savePrefs(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ musicOn: this._musicOn, sfxOn: this._sfxOn })
      );
    } catch { /* ignore */ }
  }
}
