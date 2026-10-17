/**
 * Placeholder audio generator for YatriKripya.
 *
 * Synthesizes small, audible WAV files (22.05 kHz, 16-bit) so the lo-fi
 * carriage actually plays sound before real field recordings exist. These are
 * intentionally simple tones/noise, NOT authentic recordings — replace the
 * files in public/audio and public/audio/sfx with real .wav/.mp3 assets when
 * available (the app references these exact paths).
 *
 * Run with:  node scripts/generate-audio.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SR = 22050;
const ROOT = join(process.cwd(), "public", "audio");
const SFX = join(ROOT, "sfx");

const T = (sec) => Math.floor(sec * SR);

/* ----------------------------- WAV encoding ----------------------------- */
function toWav(channels) {
  const n = channels[0].length;
  const numCh = channels.length;
  const blockAlign = numCh * 2;
  const dataSize = n * blockAlign;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(numCh, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * blockAlign, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  let off = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      buf.writeInt16LE((s * 32767) | 0, off);
      off += 2;
    }
  }
  return buf;
}

function save(file, channels) {
  // Normalize each channel to a healthy peak (~0.85) so quiet synths (like the
  // low-level sleeper rumble) are clearly audible on laptop/phone speakers
  // instead of playing silently.
  const target = 0.85;
  const norm = channels.map((c) => {
    let p = 0;
    for (let i = 0; i < c.length; i++) p = Math.max(p, Math.abs(c[i]));
    return p > 0 ? scale(c, target / p) : c;
  });
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, toWav(norm));
  console.log("wrote", file.replace(process.cwd() + "\\", ""));
}

/* ------------------------------ primitives ------------------------------ */
const zeros = (d) => new Float32Array(d);

function sine(d, freq, amp = 1) {
  const a = zeros(d);
  for (let i = 0; i < d; i++) a[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return a;
}

// Vibrato sine: instantaneous freq modulated by an LFO.
function vibratoSine(d, freq, amp, rate, depth) {
  const a = zeros(d);
  let phase = 0;
  for (let i = 0; i < d; i++) {
    const f = freq + depth * Math.sin((2 * Math.PI * rate * i) / SR);
    phase += (2 * Math.PI * f) / SR;
    a[i] = amp * Math.sin(phase);
  }
  return a;
}

function white(d) {
  const a = zeros(d);
  for (let i = 0; i < d; i++) a[i] = Math.random() * 2 - 1;
  return a;
}

function brown(d) {
  const a = zeros(d);
  let last = 0;
  for (let i = 0; i < d; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    a[i] = last * 3.5;
  }
  return a;
}

function lowpass(sig, coef) {
  const out = zeros(sig.length);
  let y = 0;
  for (let i = 0; i < sig.length; i++) {
    y += coef * (sig[i] - y);
    out[i] = y;
  }
  return out;
}

function mul(dst, src) {
  for (let i = 0; i < dst.length; i++) dst[i] *= src[i];
  return dst;
}
function add(dst, src) {
  for (let i = 0; i < dst.length; i++) dst[i] += src[i];
  return dst;
}
function scale(a, k) {
  for (let i = 0; i < a.length; i++) a[i] *= k;
  return a;
}

// Percussive exponential decay envelope.
function decay(d, tau) {
  const a = zeros(d);
  for (let i = 0; i < d; i++) a[i] = Math.exp(-i / (tau * SR));
  return a;
}

// Attack/hold/release envelope (seconds).
function adsr(d, atk, rel) {
  const a = zeros(d);
  const na = Math.max(1, T(atk));
  const nr = Math.max(1, T(rel));
  for (let i = 0; i < d; i++) {
    if (i < na) a[i] = i / na;
    else if (i > d - nr) a[i] = Math.max(0, (d - i) / nr);
    else a[i] = 1;
  }
  return a;
}

// Place a short buffer into a destination at a sample offset.
function place(dst, src, at) {
  for (let i = 0; i < src.length && at + i < dst.length; i++) dst[at + i] += src[i];
  return dst;
}

/* ------------------------------- sounds --------------------------------- */

// 6s looping sleeper-car rumble: brown noise + slow LFO + rail clacks.
function loopSleeper() {
  const d = T(6);
  // Gentler low-pass so the rumble keeps mid content small speakers can play.
  const rumble = lowpass(brown(d), 0.2);
  const lfo = zeros(d);
  for (let i = 0; i < d; i++) lfo[i] = 0.7 + 0.3 * Math.sin((2 * Math.PI * (1 / 6) * i) / SR);
  mul(rumble, lfo);
  const out = scale(rumble, 0.6);
  // faint steady hiss bed for presence
  add(out, scale(lowpass(white(d), 0.5), 0.05));
  // prominent wheel-on-joint clacks, 8 evenly spaced so the loop is seamless
  const clack = mul(scale(lowpass(white(T(0.04)), 0.4), 0.6), decay(T(0.04), 0.015));
  for (let k = 0; k < 8; k++) place(out, clack, Math.floor((d / 8) * k));
  return [out];
}

// Two-tone diesel loco horn with a slow swell.
function trainHorn() {
  const d = T(2.6);
  const env = adsr(d, 0.25, 0.6);
  let a = add(sine(d, 311, 0.5), sine(d, 466, 0.4));
  a = add(a, scale(sine(d, 622, 0.12), 1)); // slight brightness
  mul(a, env);
  return [scale(a, 0.7)];
}

// Guard's steam whistle: high vibrato tone with a downward tail.
function whistle() {
  const d = T(1.8);
  const env = adsr(d, 0.08, 0.5);
  let a = vibratoSine(d, 950, 0.5, 6, 25);
  a = add(a, vibratoSine(d, 1400, 0.18, 6, 30));
  mul(a, env);
  return [scale(a, 0.6)];
}

// Wheel-on-joint clack: two filtered noise transients.
function wheelClack() {
  const d = T(1.2);
  const out = zeros(d);
  const click = mul(scale(lowpass(white(T(0.06)), 0.35), 0.9), decay(T(0.06), 0.02));
  place(out, click, 0);
  place(out, click, T(0.5));
  return [scale(out, 0.8)];
}

// Chai-vendor's cycle bell: a bright "ting-ting" bell motif.
function chaiVendor() {
  const d = T(2.4);
  const out = zeros(d);
  const bell = (freq) => {
    const n = T(0.5);
    let a = add(sine(n, freq, 0.6), sine(n, freq * 2.76, 0.25));
    return mul(a, decay(n, 0.12));
  };
  place(out, bell(1320), 0);
  place(out, bell(1320), T(0.35));
  place(out, bell(1760), T(0.9));
  place(out, bell(1320), T(1.4));
  return [scale(out, 0.6)];
}

// Station announcement chime: the classic two-tone "attention" jingle.
function announcer() {
  const d = T(3.0);
  const out = zeros(d);
  const note = (freq, at, dur, amp = 0.5) => {
    const n = T(dur);
    let a = add(sine(n, freq, amp), sine(n, freq * 2, amp * 0.3));
    place(out, mul(a, adsr(n, 0.02, 0.08)), at);
  };
  note(659, 0, 0.4); // E
  note(784, T(0.45), 0.5); // G
  note(587, T(1.1), 0.7); // D
  note(880, T(1.9), 0.9); // A (resolve)
  return [scale(out, 0.6)];
}

// Emergency chain pull: metallic rattle + descending squeal.
function chainPull() {
  const d = T(1.5);
  const rattle = mul(scale(white(d), 0.5), decay(d, 0.18));
  let squeal = zeros(d);
  let phase = 0;
  for (let i = 0; i < d; i++) {
    const f = 1600 - (1200 * i) / d; // sweep down
    phase += (2 * Math.PI * f) / SR;
    squeal[i] = 0.3 * Math.sin(phase);
  }
  mul(squeal, decay(d, 0.4));
  const out = add(rattle, squeal);
  return [scale(out, 0.7)];
}

// Lo-fi pad loop for the hidden "streams": soft detuned chord, seamless.
function pad(freqs, seconds = 8) {
  const d = T(seconds);
  const out = zeros(d);
  for (const f of freqs) {
    const a1 = sine(d, f, 0.18);
    const a2 = sine(d, f * 1.005, 0.14); // slight detune chorus
    add(out, a1);
    add(out, a2);
  }
  // gentle tremolo at an integer number of cycles so the loop is seamless
  const cycles = 4;
  for (let i = 0; i < d; i++) {
    const t = 0.8 + 0.2 * Math.sin((2 * Math.PI * cycles * i) / d);
    out[i] *= t;
  }
  return [scale(out, 0.5)];
}

/* -------------------------------- emit ---------------------------------- */
save(join(ROOT, "loop-sleeper.wav"), loopSleeper());
save(join(SFX, "train-horn.wav"), trainHorn());
save(join(SFX, "whistle.wav"), whistle());
save(join(SFX, "wheel-clack.wav"), wheelClack());
save(join(SFX, "chai-vendor.wav"), chaiVendor());
save(join(SFX, "announcer.wav"), announcer());
save(join(SFX, "chain-pull.wav"), chainPull());
save(join(ROOT, "stream-sleeper.wav"), pad([220, 277.18, 329.63])); // A minor
save(join(ROOT, "stream-panoramix.wav"), pad([196, 246.94, 293.66])); // G
save(join(ROOT, "stream-general.wav"), pad([174.61, 220, 261.63])); // F

console.log("\nDone. Placeholder audio written to public/audio.");
