export type SoundKind =
  'click' | 'open' | 'close' | 'boot' | 'shutdown' | 'post' | 'disk' | 'error' | 'type';
let audio: AudioContext | undefined;
let master: GainNode | undefined;
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (!master) {
      master = audio.createGain();
      const limiter = audio.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.15;
      master.connect(limiter);
      limiter.connect(audio.destination);
    }
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
  } catch {
    /* Audio never blocks the computer. */
  }
}
export function setAudioVolume(volume: number) {
  if (master && audio)
    master.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), audio.currentTime, 0.02);
}
export function playSound(kind: SoundKind, volume: number) {
  try {
    if (volume <= 0) return;
    unlockAudio();
    if (!audio || !master) return;
    setAudioVolume(volume);
    const context = audio;
    const output = master;
    if (kind === 'disk' || kind === 'type' || kind === 'click') {
      const duration = kind === 'disk' ? 0.13 : kind === 'type' ? 0.026 : 0.018;
      const source = context.createBufferSource();
      const buffer = context.createBuffer(
        1,
        Math.ceil(context.sampleRate * duration),
        context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.exp((-i / data.length) * 8);
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = kind === 'disk' ? 760 : 1800;
      const gain = context.createGain();
      gain.gain.value = kind === 'disk' ? 0.3 : 0.24;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(output);
      source.start();
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      return;
    }
    const notes =
      kind === 'boot'
        ? [261.63, 392, 523.25, 329.63, 493.88, 659.25, 392, 523.25]
        : kind === 'shutdown'
          ? [523.25, 392, 329.63, 261.63]
          : kind === 'post'
            ? [880]
            : kind === 'open'
              ? [523, 659]
              : kind === 'error'
                ? [220, 165]
                : [440, 330];
    notes.forEach((frequency, i) => {
      const osc = context.createOscillator(),
        gain = context.createGain();
      const long = kind === 'boot' || kind === 'shutdown';
      const start = context.currentTime + i * (long ? 0.34 : 0.14),
        duration =
          kind === 'boot' ? 1.5 : kind === 'shutdown' ? 1.05 : kind === 'post' ? 0.24 : 0.13;
      osc.type = kind === 'post' ? 'square' : 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(kind === 'post' ? 0.1 : long ? 0.24 : 0.2, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(output);
      osc.start(start);
      osc.stop(start + duration);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  } catch {
    /* Synthesized sounds are optional. */
  }
}
export function startBootAmbience(volume: number): () => void {
  if (!audio || audio.state !== 'running' || !master || volume <= 0) return () => {};
  const context = audio;
  const hum = context.createOscillator(),
    noise = context.createBufferSource(),
    filter = context.createBiquadFilter(),
    gain = context.createGain();
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate),
    channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = (Math.random() * 2 - 1) * 0.7;
  noise.buffer = buffer;
  noise.loop = true;
  hum.frequency.value = 60;
  filter.type = 'lowpass';
  filter.frequency.value = 460;
  gain.gain.setValueAtTime(0, context.currentTime);
  gain.gain.linearRampToValueAtTime(0.055, context.currentTime + 0.5);
  hum.connect(filter);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  hum.start();
  noise.start();
  return () => {
    const end = context.currentTime + 0.13;
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setTargetAtTime(0, context.currentTime, 0.025);
    hum.stop(end);
    noise.stop(end);
    hum.onended = () => {
      hum.disconnect();
      noise.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  };
}
