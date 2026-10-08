import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import Icon from '../Icon';
import { useDesktop } from '../../lib/DesktopContext';
import type { MachineEvent, MachineState } from '../../lib/machine';
import type { Settings } from '../../types';
import { startBootAmbience } from '../../lib/sound';
const diagnostics = [
  'Initializing system firmware…',
  'CPU: Curious Core 2.40 GHz ................ PASS',
  'L1 / L2 cache ............................ PASS',
  'Checking conventional memory…',
  '640K Base Memory .......................... OK',
  'Extended Memory: 262144K .................. OK',
  'Primary Master: CREATIVE DRIVE ........... READY',
  'Keyboard / PS/2 mouse .................... FOUND',
  'VGA display controller ..................... OK',
  'Checking boot records ...................... OK',
  'Verifying DMI Pool Data ............... SUCCESS',
  'Boot device selected. Starting operating system…',
];
const bootOptions = ['Normal OS', 'Linux Terminal', 'Recovery', 'BIOS Setup'];
export default function SystemScreens({
  machine,
  dispatch,
  onLoaded,
  restart,
  clearTemporary,
  resetDesktop,
  unlocked,
}: {
  machine: MachineState;
  dispatch: (e: MachineEvent) => void;
  onLoaded: () => void;
  restart: () => void;
  clearTemporary: () => void;
  resetDesktop: () => void;
  unlocked: boolean;
}) {
  const { settings, setSettings, beep } = useDesktop();
  const [count, setCount] = useState(0);
  const [bootIndex, setBootIndex] = useState(0);
  const phase = machine.phase;
  const [clock, setClock] = useState(new Date());
  const soundStarted = useRef(-1);
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (
      !unlocked ||
      !settings.sound ||
      !settings.bootSound ||
      machine.safeMode ||
      !['BOOT', 'BIOS', 'OS_LOADING'].includes(phase)
    )
      return;
    if (soundStarted.current !== machine.epoch) {
      soundStarted.current = machine.epoch;
      beep('post');
    }
  }, [unlocked, settings.sound, settings.bootSound, machine.epoch, machine.safeMode, phase, beep]);
  useEffect(() => {
    if (
      settings.sound &&
      settings.ambient &&
      unlocked &&
      !machine.safeMode &&
      ['BOOT', 'BIOS', 'OS_LOADING'].includes(phase)
    )
      return startBootAmbience(settings.volume);
  }, [settings.sound, settings.ambient, settings.volume, unlocked, machine.safeMode, phase]);
  useEffect(() => {
    setCount(0);
    if (phase === 'BOOT') {
      const t = setTimeout(() => dispatch({ type: 'GO', phase: 'BIOS' }), 2200);
      return () => clearTimeout(t);
    }
    if (phase === 'BIOS') {
      const timer = setInterval(() => setCount((c) => Math.min(c + 1, diagnostics.length)), 780);
      const done = setTimeout(() => dispatch({ type: 'GO', phase: 'OS_LOADING' }), 11200);
      return () => {
        clearInterval(timer);
        clearTimeout(done);
      };
    }
    if (phase === 'OS_LOADING') {
      beep('boot');
      const timer = setTimeout(onLoaded, 4300);
      return () => clearTimeout(timer);
    }
  }, [phase, machine.epoch, dispatch, onLoaded, beep]);
  useEffect(() => {
    if (phase === 'BIOS' && count > 0 && settings.bootSound) beep(count === 6 ? 'post' : 'disk');
  }, [count, phase, settings.bootSound, beep]);
  function choose(index: number) {
    if (index === 2) dispatch({ type: 'GO', phase: 'RECOVERY' });
    else if (index === 3) dispatch({ type: 'GO', phase: 'BIOS_SETUP' });
    else dispatch({ type: 'CHOOSE', target: index === 1 ? 'linux' : 'windows' });
  }
  useEffect(() => {
    if (phase === 'BIOS_SETUP' || phase === 'RECOVERY') return;
    const key = (e: KeyboardEvent) => {
      if (
        e.ctrlKey &&
        e.altKey &&
        e.code === 'KeyT' &&
        ['BOOT', 'BIOS', 'OS_LOADING'].includes(phase)
      ) {
        e.preventDefault();
        dispatch({ type: 'GO', phase: 'LINUX_TERMINAL' });
        return;
      }
      if (phase === 'BOOT_MENU') {
        if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) e.preventDefault();
        if (e.key === 'ArrowUp') setBootIndex((i) => (i + 3) % 4);
        if (e.key === 'ArrowDown') setBootIndex((i) => (i + 1) % 4);
        if (e.key === 'Enter') choose(bootIndex);
        if (e.key === 'Escape') dispatch({ type: 'GO', phase: 'BIOS' });
        return;
      }
      if (['BOOT', 'BIOS', 'OS_LOADING'].includes(phase)) {
        if (e.key === 'Escape' || e.key === 'Delete') {
          e.preventDefault();
          dispatch({ type: 'GO', phase: 'BIOS_SETUP' });
        }
        if (e.key === 'F12') {
          e.preventDefault();
          dispatch({ type: 'GO', phase: 'BOOT_MENU' });
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          onLoaded();
        }
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [phase, bootIndex, dispatch, onLoaded]);
  if (phase === 'BIOS_SETUP')
    return (
      <BiosSetup settings={settings} setSettings={setSettings} dispatch={dispatch} clock={clock} />
    );
  if (phase === 'RECOVERY')
    return (
      <Recovery
        clearTemporary={clearTemporary}
        resetDesktop={resetDesktop}
        restart={restart}
        dispatch={dispatch}
      />
    );
  return (
    <div
      className={`boot-screen post-screen phase-${phase.toLowerCase()}`}
      data-system-mode={phase}
    >
      {settings.crt && <div className="boot-scanlines" />}
      {phase === 'BIOS' && (
        <div className="bios authentic-post">
          <div className="post-brand">
            <span className="post-logo">▥</span>
            <div>
              <b>PERSONAL MICRO SYSTEMS</b>
              <span>Modular BIOS v2.04 · Curiosity Technologies</span>
            </div>
          </div>
          <p>
            BIOS Date: 10/08/2004 14:26:02 Ver: 02.04.01
            <br />
            Copyright (C) 2004–{clock.getFullYear()} Personal Computer
          </p>
          <div className="post-diagnostics">
            {diagnostics.slice(0, count).map((line, i) => (
              <div className="bios-line" key={i}>
                {line}
              </div>
            ))}
            <span className="boot-cursor">_</span>
          </div>
          <div className="post-instructions">
            Press <b>DEL</b> or <b>ESC</b> to enter SETUP
            <br />
            Press <b>F12</b> for Boot Menu
          </div>
          <div className="post-memory">{Math.min(count * 24576, 262144)}K OK</div>
        </div>
      )}
      {phase === 'OS_LOADING' && (
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
          <p>{machine.safeMode ? 'Starting in Safe Mode…' : 'Starting your personal computer…'}</p>
        </div>
      )}
      {phase === 'BOOT_MENU' && (
        <div className="firmware-screen boot-menu-screen">
          <h1>PLEASE SELECT BOOT DEVICE</h1>
          <div className="firmware-box">
            {bootOptions.map((option, i) => (
              <button
                key={option}
                className={bootIndex === i ? 'current' : ''}
                onMouseEnter={() => setBootIndex(i)}
                onClick={() => choose(i)}
              >
                <span>{bootIndex === i ? '►' : ' '}</span>
                {option}
              </button>
            ))}
          </div>
          <footer>↑ ↓ Select device · ENTER Boot · ESC Cancel</footer>
        </div>
      )}
      {phase !== 'BOOT' && phase !== 'BOOT_MENU' && (
        <footer>
          <button onClick={onLoaded}>
            Press <kbd>ENTER</kbd> to continue
          </button>
          <button
            aria-label={settings.sound ? 'Mute sound' : 'Enable sound'}
            onClick={() => setSettings({ sound: !settings.sound })}
          >
            {settings.sound ? <Volume2 size={16} /> : <VolumeX size={16} />} Sound{' '}
            {settings.sound ? 'on' : 'off'}
          </button>
        </footer>
      )}
      {phase === 'BOOT' && (
        <span className="black-power-cursor" aria-hidden="true">
          _
        </span>
      )}
    </div>
  );
}
function BiosSetup({
  settings,
  setSettings,
  dispatch,
  clock,
}: {
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
  dispatch: (e: MachineEvent) => void;
  clock: Date;
}) {
  const [draft, setDraft] = useState({ ...settings });
  const [tab, setTab] = useState(0);
  const [row, setRow] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [yes, setYes] = useState(true);
  const tabs = ['Main', 'Advanced', 'Boot', 'Security', 'Power', 'Exit'];
  const rows = [
    ['System information', 'System date', 'System time'],
    ['CRT display effects', 'Reduced motion'],
    ['First boot device', 'Skip POST on next visit'],
    ['Setup access', 'Shelf storage'],
    ['System sound', 'Boot sound', 'Ambient hum', 'Volume'],
    ['Save configuration and reboot', 'Discard changes and continue', 'Boot menu'],
  ][tab];
  const select = (i = row) => {
    if (tab === 1) {
      setDraft((d) => ({
        ...d,
        [i === 0 ? 'crt' : 'reducedMotion']: !d[i === 0 ? 'crt' : 'reducedMotion'],
      }));
    }
    if (tab === 2) {
      if (i === 0)
        setDraft((d) => ({ ...d, bootTarget: d.bootTarget === 'windows' ? 'linux' : 'windows' }));
      else setDraft((d) => ({ ...d, skipBoot: !d.skipBoot }));
    }
    if (tab === 4) {
      const key = (['sound', 'bootSound', 'ambient'] as const)[i];
      if (i < 3) setDraft((d) => ({ ...d, [key]: !d[key] }));
      else
        setDraft((d) => ({
          ...d,
          volume: Math.round((d.volume >= 1 ? 0 : d.volume + 0.1) * 10) / 10,
        }));
    }
    if (tab === 5) {
      if (i === 0) {
        setConfirm(true);
        setYes(true);
      }
      if (i === 1) dispatch({ type: 'GO', phase: 'BIOS' });
      if (i === 2) dispatch({ type: 'GO', phase: 'BOOT_MENU' });
    }
  };
  const save = () => {
    setSettings(draft);
    setConfirm(false);
    dispatch({ type: 'REBOOT', target: draft.bootTarget });
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'F10'].includes(
          e.key,
        )
      )
        return;
      e.preventDefault();
      if (confirm) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') setYes((v) => !v);
        if (e.key === 'Escape') setConfirm(false);
        if (e.key === 'Enter') {
          if (yes) save();
          else setConfirm(false);
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        setTab((t) => (t + 5) % 6);
        setRow(0);
      }
      if (e.key === 'ArrowRight') {
        setTab((t) => (t + 1) % 6);
        setRow(0);
      }
      if (e.key === 'ArrowUp') setRow((r) => (r + rows.length - 1) % rows.length);
      if (e.key === 'ArrowDown') setRow((r) => (r + 1) % rows.length);
      if (e.key === 'Enter') select();
      if (e.key === 'Escape') dispatch({ type: 'GO', phase: 'BIOS' });
      if (e.key === 'F10') {
        setConfirm(true);
        setYes(true);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [confirm, yes, tab, row, rows.length, draft]);
  function value(i: number) {
    if (tab === 0)
      return i === 0
        ? 'Curious Core / 256 MB'
        : i === 1
          ? clock.toLocaleDateString()
          : clock.toLocaleTimeString();
    if (tab === 1) return (i === 0 ? draft.crt : draft.reducedMotion) ? '[Enabled]' : '[Disabled]';
    if (tab === 2)
      return i === 0
        ? `[${draft.bootTarget === 'windows' ? 'Normal OS' : 'Linux Terminal'}]`
        : draft.skipBoot
          ? '[Enabled]'
          : '[Disabled]';
    if (tab === 3) return i === 0 ? '[Guest access]' : '[Local IndexedDB]';
    if (tab === 4)
      return i === 3
        ? `[${Math.round(draft.volume * 100)}%]`
        : draft[(['sound', 'bootSound', 'ambient'] as const)[i]]
          ? '[Enabled]'
          : '[Disabled]';
    return '↵';
  }
  return (
    <div className="firmware-screen bios-setup" data-system-mode="BIOS_SETUP">
      <header>
        <span>Personal Micro Systems</span>
        <b>BIOS SETUP UTILITY</b>
        <span>v2.04</span>
      </header>
      <nav>
        {tabs.map((t, i) => (
          <button
            key={t}
            className={tab === i ? 'current' : ''}
            onClick={() => {
              setTab(i);
              setRow(0);
            }}
          >
            {t}
          </button>
        ))}
      </nav>
      <div className="bios-columns">
        <main>
          <h2>{tabs[tab]} Configuration</h2>
          {rows.map((label, i) => (
            <button
              key={label}
              className={row === i ? 'selected' : ''}
              onFocus={() => setRow(i)}
              onClick={() => {
                setRow(i);
                select(i);
              }}
            >
              <span>{label}</span>
              <b>{value(i)}</b>
            </button>
          ))}
        </main>
        <aside>
          <h3>Item Specific Help</h3>
          <p>
            Use the arrow keys to select an item.
            <br />
            <br />
            ENTER changes the selected value.
            <br />
            <br />
            F10 saves configuration and restarts the machine.
          </p>
          {tab === 0 && <p>The system clock follows your device’s local date and time.</p>}
          {tab === 3 && (
            <p>
              Local editing affects this browser only. This simulated firmware does not manage real
              passwords.
            </p>
          )}
        </aside>
      </div>
      <footer>
        <span>← → Select menu</span>
        <span>↑ ↓ Select item</span>
        <span>ENTER Change</span>
        <button onClick={() => dispatch({ type: 'GO', phase: 'BIOS' })}>ESC Exit</button>
        <button onClick={() => setConfirm(true)}>F10 Save & reboot</button>
      </footer>
      {confirm && (
        <div className="firmware-modal">
          <div>
            <h2>Save configuration and reboot?</h2>
            <p>Changes will be saved to this computer.</p>
            <div>
              <button className={yes ? 'selected' : ''} onClick={save}>
                YES
              </button>
              <button className={!yes ? 'selected' : ''} onClick={() => setConfirm(false)}>
                NO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Recovery({
  clearTemporary,
  resetDesktop,
  restart,
  dispatch,
}: {
  clearTemporary: () => void;
  resetDesktop: () => void;
  restart: () => void;
  dispatch: (e: MachineEvent) => void;
}) {
  const [message, setMessage] = useState('');
  return (
    <div className="firmware-screen recovery-screen" data-system-mode="RECOVERY">
      <span>PERSONAL COMPUTER / RECOVERY ENVIRONMENT</span>
      <h1>Let’s get things working again.</h1>
      <p>Your saved notes and Shelf objects are kept intact.</p>
      <div>
        <button onClick={restart}>Restart</button>
        <button
          onClick={() => {
            clearTemporary();
            setMessage('Temporary files and transient UI state cleared.');
          }}
        >
          Clear Temporary Data
        </button>
        <button
          onClick={() => {
            resetDesktop();
            setMessage('Desktop icon names, positions, and selection have been reset.');
          }}
        >
          Reset Desktop
        </button>
        <button onClick={() => dispatch({ type: 'CHOOSE', target: 'windows', safe: true })}>
          Safe Mode
        </button>
        <button onClick={() => dispatch({ type: 'GO', phase: 'BOOT_MENU' })}>
          Back to Boot Menu
        </button>
      </div>
      <p role="status">{message}</p>
      <small>
        Safe Mode starts the desktop with audio, CRT effects, and decorative motion disabled.
      </small>
    </div>
  );
}
