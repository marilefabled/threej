import { Howl, Howler } from 'howler';

// Audio via Howler — a named sound registry + master volume. Includes a tiny
// procedural WAV generator so a project can ship without audio files (synthesize
// blips/thuds), while still using Howler for playback/pooling/volume.
//
//   const audio = createAudio();
//   audio.tone('blip', { freq: 660, dur: 0.08 });
//   audio.tone('thud', { type: 'noise', freq: 120, dur: 0.18, decay: 22 });
//   audio.play('blip');                 // on a user gesture
//   audio.load('music', 'song.mp3', { loop: true, volume: 0.4 });

// Build a one-shot PCM WAV (mono, 16-bit) as a data URI.
export function toneWav({ freq = 440, dur = 0.12, type = 'sine', decay = 8, volume = 0.6, sampleRate = 44100 }: any = {}) {
  const n = Math.floor(sampleRate * dur);
  const samples = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const wave = type === 'noise' ? Math.random() * 2 - 1
      : type === 'square' ? (Math.sin(2 * Math.PI * freq * t) >= 0 ? 1 : -1)
      : Math.sin(2 * Math.PI * freq * t);
    const env = Math.exp(-decay * t);                 // percussive decay
    samples[i] = Math.max(-1, Math.min(1, wave * env * volume)) * 32767;
  }

  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const str = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, 'data'); view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) view.setInt16(44 + i * 2, samples[i], true);

  let bin = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}

export function createAudio({ volume = 0.6 }: any = {}) {
  Howler.volume(volume);
  const sounds: Record<string, Howl> = {};

  const load = (name: string, src: string, opts: any = {}) => (sounds[name] = new Howl({ src: [src], ...opts }));
  const tone = (name: string, params: any = {}) => load(name, toneWav(params), { format: ['wav'] });
  const play = (name: string, opts: any = {}) => {
    const s = sounds[name];
    if (!s) return undefined;
    const id = s.play();
    if (opts.rate) s.rate(opts.rate, id);
    if (opts.volume != null) s.volume(opts.volume, id);
    return id;
  };
  const setVolume = (v: number) => Howler.volume(v);
  const mute = (m: boolean) => Howler.mute(m);

  // Update the Web Audio listener position and orientation. Call every frame after
  // positioning the camera so 3D sounds pan/attenuate from the right point.
  //   audio.setListener(camera.position, forwardVec, upVec)
  const setListener = (
    pos:      { x: number; y: number; z: number },
    forward?: { x: number; y: number; z: number },
    up?:      { x: number; y: number; z: number },
  ) => {
    Howler.pos(pos.x, pos.y, pos.z);
    if (forward && up) Howler.orientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
  };

  // Play a named sound at a world-space position. Attenuates with distance from the
  // listener set via setListener(). Raise refDistance for room-scale scenes.
  //   audio.play3D('thud', mesh.position, { rate: 0.9, refDistance: 4 })
  const play3D = (
    name: string,
    pos:  { x: number; y: number; z: number },
    opts: { rate?: number; volume?: number; refDistance?: number; rolloffFactor?: number } = {},
  ): number | undefined => {
    const s = sounds[name];
    if (!s) return undefined;
    const id = s.play();
    if (id !== undefined) {
      s.pos(pos.x, pos.y, pos.z, id);
      if (opts.rate != null)        s.rate(opts.rate, id);
      if (opts.volume != null)      s.volume(opts.volume, id);
      if (opts.refDistance != null || opts.rolloffFactor != null) {
        s.pannerAttr({ refDistance: opts.refDistance ?? 1, rolloffFactor: opts.rolloffFactor ?? 1 }, id);
      }
    }
    return id;
  };

  return { Howler, sounds, load, tone, play, play3D, setListener, setVolume, mute, toneWav };
}
