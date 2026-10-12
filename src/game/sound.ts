// Efectos de sonido sintetizados con Web Audio: no hacen falta archivos de audio.

type Wave = OscillatorType;

const MUTE_KEY = 'market-street-muted';

class Sfx {
  private ctx: AudioContext | null = null;
  muted = readMuted();

  /** Los navegadores solo dejan sonar audio tras una interacción del usuario. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) this.ctx = new Ctor();
  }

  toggle() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // Sin almacenamiento: la preferencia dura lo que la pestaña.
    }
    return this.muted;
  }

  private tone(freq: number, start: number, duration: number, wave: Wave = 'sine', volume = 0.15, slideTo?: number) {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== 'running') return;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  coin() {
    this.tone(988, 0, 0.08, 'square', 0.06);
    this.tone(1319, 0.07, 0.25, 'square', 0.06);
  }

  tip() {
    this.tone(1568, 0, 0.12, 'triangle', 0.08);
    this.tone(2093, 0.08, 0.2, 'triangle', 0.08);
  }

  pop() {
    this.tone(500, 0, 0.09, 'sine', 0.12, 900);
  }

  place() {
    this.tone(180, 0, 0.12, 'triangle', 0.2, 90);
    this.tone(660, 0.05, 0.08, 'sine', 0.06);
  }

  truck() {
    this.tone(90, 0, 0.35, 'sawtooth', 0.04, 70);
    this.tone(660, 0.3, 0.1, 'square', 0.04);
    this.tone(660, 0.45, 0.1, 'square', 0.04);
  }

  angry() {
    this.tone(220, 0, 0.25, 'sawtooth', 0.05, 140);
  }

  error() {
    this.tone(160, 0, 0.15, 'square', 0.05);
    this.tone(120, 0.12, 0.2, 'square', 0.05);
  }

  vip() {
    [784, 988, 1175].forEach((f, i) => this.tone(f, i * 0.07, 0.18, 'triangle', 0.08));
  }

  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.1, 0.3, 'triangle', 0.1));
  }

  claim() {
    [880, 1109, 1319].forEach((f, i) => this.tone(f, i * 0.06, 0.2, 'sine', 0.1));
  }

  click() {
    this.tone(700, 0, 0.04, 'sine', 0.05);
  }
}

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export const sfx = new Sfx();
