let audio: AudioContext | undefined;
export function playSound(
  kind: 'click' | 'open' | 'close' | 'boot' | 'error' | 'type',
  volume: number,
) {
  try {
    if (volume <= 0) return;
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
    const notes =
      kind === 'boot'
        ? [392, 523, 659, 784]
        : kind === 'open'
          ? [523, 659]
          : kind === 'error'
            ? [220, 165]
            : kind === 'close'
              ? [440, 330]
              : [kind === 'type' ? 110 : 700];
    notes.forEach((frequency, i) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      const start = audio!.currentTime + i * 0.13;
      const duration = kind === 'boot' ? 0.55 : kind === 'type' ? 0.015 : 0.1;
      osc.type = kind === 'type' ? 'square' : 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume * 0.12, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(audio!.destination);
      osc.start(start);
      osc.stop(start + duration);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  } catch {
    /* Sound is optional and never blocks the desktop. */
  }
}

/** A quiet, bounded CRT hum/static bed. It only starts after audio was user-unlocked. */
export function startBootAmbience(volume: number): () => void {
  if (!audio || audio.state !== 'running' || volume <= 0) return () => {};
  const context = audio;
  const hum = context.createOscillator();
  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = (Math.random() * 2 - 1) * 0.08;
  noise.buffer = buffer;
  noise.loop = true;
  hum.frequency.value = 60;
  filter.type = 'lowpass';
  filter.frequency.value = 380;
  gain.gain.setValueAtTime(0, context.currentTime);
  gain.gain.linearRampToValueAtTime(volume * 0.012, context.currentTime + 0.2);
  hum.connect(filter);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  hum.start();
  noise.start();
  return () => {
    const end = context.currentTime + 0.12;
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
