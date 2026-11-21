// Procedural WebAudio sound system (no external assets): engine, footsteps, UI, rain, wind, horn
class AudioSys {
  ctx: AudioContext | null = null;
  master!: GainNode; sfx!: GainNode; amb!: GainNode;
  engOsc?: OscillatorNode; engOsc2?: OscillatorNode; engGain?: GainNode; engFilter?: BiquadFilterNode;
  rainGain?: GainNode; windGain?: GainNode;
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = (window.AudioContext || (window as any).webkitAudioContext);
    if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.amb = ctx.createGain(); this.amb.connect(this.master);
    // engine
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 600;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engOsc = ctx.createOscillator(); this.engOsc.type = 'sawtooth';
    this.engOsc2 = ctx.createOscillator(); this.engOsc2.type = 'square';
    this.engOsc.connect(this.engFilter); this.engOsc2.connect(this.engFilter);
    this.engFilter.connect(this.engGain); this.engGain.connect(this.sfx);
    this.engOsc.start(); this.engOsc2.start();
    // noise beds
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const mk = (freq: number, type: BiquadFilterType) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.amb); s.start(); return g; };
    this.rainGain = mk(3000, 'highpass'); this.windGain = mk(400, 'lowpass');
  }
  setVolumes(sfx: number, amb: number) { if (!this.ctx) return; this.sfx.gain.value = sfx; this.amb.gain.value = amb; }
  engine(on: boolean, rpm: number, heavy = false) {
    if (!this.ctx || !this.engOsc) return;
    const t = this.ctx.currentTime; const base = heavy ? 30 : 45;
    this.engOsc.frequency.setTargetAtTime(base + rpm * (heavy ? 60 : 120), t, 0.05);
    this.engOsc2!.frequency.setTargetAtTime((base + rpm * (heavy ? 60 : 120)) * 0.5, t, 0.05);
    this.engFilter!.frequency.setTargetAtTime(400 + rpm * 1600, t, 0.05);
    this.engGain!.gain.setTargetAtTime(on ? 0.08 + rpm * 0.08 : 0, t, 0.1);
  }
  ambience(rain: number, wind: number) { if (!this.ctx) return; const t = this.ctx.currentTime; this.rainGain!.gain.setTargetAtTime(rain * 0.25, t, 0.5); this.windGain!.gain.setTargetAtTime(wind * 0.15, t, 0.5); }
  blip(freq: number, dur = 0.08, type: OscillatorType = 'sine', vol = 0.15) {
    if (!this.ctx) return; const ctx = this.ctx; const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(this.sfx); o.start(); o.stop(ctx.currentTime + dur);
  }
  click() { this.blip(880, 0.06, 'triangle', 0.12); }
  step() { this.blip(90 + Math.random() * 30, 0.05, 'triangle', 0.08); }
  crash() { this.blip(70, 0.35, 'sawtooth', 0.3); this.blip(140, 0.2, 'square', 0.15); }
  horn() { this.blip(420, 0.35, 'square', 0.12); this.blip(520, 0.35, 'square', 0.1); }
  reward() { [660, 880, 1320].forEach((f, i) => setTimeout(() => this.blip(f, 0.15, 'triangle', 0.15), i * 110)); }
  door() { this.blip(200, 0.1, 'square', 0.1); }
}
export const audio = new AudioSys();
