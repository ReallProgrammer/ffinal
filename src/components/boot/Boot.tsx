import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import Icon from '../Icon';
import { startBootAmbience } from '../../lib/sound';
const lines = [
  'PERSONAL COMPUTER BIOS v2.04',
  'Copyright (C) 2004. A little curiosity goes a long way.',
  '',
  'Main Processor : Curious Mind @ 2.40 GHz',
  'Memory Testing : 640K OK',
  '',
  'Detecting Primary Master ... CREATIVE DRIVE',
  'Detecting Primary Slave  ... NOT DETECTED',
  '',
  'Verifying DMI Pool Data ........ Success',
  'Loading a world of possibilities ...',
];
export default function Boot({
  onComplete,
  sound,
  toggleSound,
  reduced,
  volume,
  onTick,
}: {
  onComplete: () => void;
  sound: boolean;
  toggleSound: () => void;
  reduced: boolean;
  volume: number;
  onTick: (kind: 'type') => void;
}) {
  const [count, setCount] = useState(0);
  const [stage, setStage] = useState('bios');
  useEffect(() => {
    if (sound) return startBootAmbience(volume);
  }, [sound, volume]);
  useEffect(() => {
    if (count > 0 && count <= lines.length && lines[count - 1]) onTick('type');
  }, [count, onTick]);
  useEffect(() => {
    if (reduced) {
      const t = setTimeout(onComplete, 700);
      return () => clearTimeout(t);
    }
    const interval = setInterval(() => setCount((c) => c + 1), 260);
    const xp = setTimeout(() => setStage('xp'), 3700);
    const done = setTimeout(onComplete, 6500);
    return () => {
      clearInterval(interval);
      clearTimeout(xp);
      clearTimeout(done);
    };
  }, [onComplete, reduced]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        onComplete();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onComplete]);
  return (
    <div className="boot-screen">
      <div className="boot-scanlines" />
      {stage === 'bios' ? (
        <div className="bios">
          <div className="bios-brand">
            <span className="bios-mark">▥</span> PERSONAL COMPUTER
            <span>
              ENERGY STAR
              <br />
              COMPLIANT ✧
            </span>
          </div>
          {lines.slice(0, count).map((line, i) => (
            <div key={i} className="bios-line">
              {line || '\u00a0'}
            </div>
          ))}
          <span className="boot-cursor">_</span>
        </div>
      ) : (
        <div className="xp-boot">
          <Icon name="computer" size={96} />
          <div className="boot-wordmark">
            <small>Welcome to your</small>personal<span>computer</span>
            <sup>xp</sup>
          </div>
          <div className="loading-track">
            <i />
            <i />
            <i />
          </div>
          <p>Made for the curious.</p>
        </div>
      )}
      <footer>
        <button onClick={onComplete}>
          Press <kbd>ENTER</kbd> to skip startup <span>→</span>
        </button>
        <button aria-label={sound ? 'Mute sound' : 'Enable sound'} onClick={toggleSound}>
          {sound ? <Volume2 size={16} /> : <VolumeX size={16} />} Sound {sound ? 'on' : 'off'}
        </button>
      </footer>
    </div>
  );
}
