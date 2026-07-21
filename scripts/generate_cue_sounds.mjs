/**
 * Generates the guided-player cue sounds as small mono WAV files.
 *
 * Tones follow the design handoff: a 880 Hz tick for the 3-2-1 countdown, a
 * rising two-note "go" when a drill starts, and a rising "done" when a set is
 * logged. Each note gets an exponential decay so it reads as a soft blip rather
 * than a click. Regenerate with: node scripts/generate_cue_sounds.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const SAMPLE_RATE = 44100;
const OUTPUT_DIR = path.resolve(process.cwd(), 'assets/sounds');

/** One note: sine at `freq` for `durationSec`, decaying to silence. */
function renderNote(freq, durationSec, peak = 0.32) {
  const count = Math.round(SAMPLE_RATE * durationSec);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const t = i / SAMPLE_RATE;
    // Exponential decay (matches the prototype's gain ramp to 0.001).
    const envelope = peak * Math.exp((-5.5 * t) / durationSec);
    // Short fade-in kills the initial click.
    const attack = Math.min(1, t / 0.004);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * envelope * attack;
  }
  return samples;
}

function concat(parts) {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function silence(durationSec) {
  return new Float32Array(Math.round(SAMPLE_RATE * durationSec));
}

/** 16-bit PCM mono WAV. */
function toWav(samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

const CUES = {
  // 3-2-1 countdown tick.
  tick: () => renderNote(880, 0.09),
  // Drill/interval starts.
  go: () => concat([renderNote(1175, 0.11), silence(0.01), renderNote(1568, 0.18)]),
  // Set logged / rep confirmed.
  done: () => concat([renderNote(660, 0.09), silence(0.01), renderNote(988, 0.16)]),
  // Rest is over — a touch lower and softer than "go".
  rest: () => concat([renderNote(784, 0.1), silence(0.01), renderNote(1046, 0.2)]),
  // Whole session finished: three rising notes.
  finish: () =>
    concat([
      renderNote(784, 0.11),
      silence(0.02),
      renderNote(988, 0.11),
      silence(0.02),
      renderNote(1318, 0.28),
    ]),
};

await fs.mkdir(OUTPUT_DIR, { recursive: true });
for (const [name, render] of Object.entries(CUES)) {
  const wav = toWav(render());
  const file = path.join(OUTPUT_DIR, `${name}.wav`);
  await fs.writeFile(file, wav);
  console.log(`${name}.wav  ${(wav.length / 1024).toFixed(1)} kB`);
}
console.log(`\nWrote ${Object.keys(CUES).length} cue sounds to ${OUTPUT_DIR}`);
