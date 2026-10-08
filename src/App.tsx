import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Volume2, VolumeX, Wifi, X, Info, Monitor, RotateCw } from 'lucide-react';
import type { AppId, FileEntry, IconName, Settings, WindowData } from './types';
import { DesktopContext } from './lib/DesktopContext';
import { playSound, setAudioVolume, startBootAmbience, unlockAudio } from './lib/sound';
import { readStorage, writeStorage } from './lib/storage';
import { machineReducer } from './lib/machine';
import type { MachineState } from './lib/machine';
import { LinuxFilesystem } from './lib/linux';
import SystemScreens from './components/system/SystemScreens';
import LinuxTerminal from './components/system/LinuxTerminal';
import Wallpaper from './components/desktop/Wallpaper';
import DesktopIcons from './components/desktop/DesktopIcons';
import Window from './components/desktop/Window';
import StartMenu from './components/desktop/StartMenu';
import Icon from './components/Icon';
import ContextMenu from './components/ContextMenu';
import Explorer from './components/applications/Explorer';
import Notepad from './components/applications/Notepad';
import Calculator from './components/applications/Calculator';
import Browser from './components/applications/Browser';
import Terminal from './components/applications/Terminal';
import SettingsApp from './components/applications/Settings';
import Shelf from './components/applications/Shelf';
import Games from './components/games/Games';
import Snake from './components/games/Snake';
import Pong from './components/games/Pong';
import Minesweeper from './components/games/Minesweeper';
import TaskManager, { HelpCenter } from './components/applications/TaskManager';
import { DialogApp, Game, RunApp, SearchApp } from './components/applications/Utilities';
import { getFile, createFile, children, fileClipboard, pasteFiles } from './data/filesystem';
import { shelfRepository, isSafeImage } from './lib/shelf/repository';
const defaults: Settings = {
  sound: true,
  volume: 0.55,
  crt: true,
  wallpaper: 'bliss',
  skipBoot: false,
  clickSound: true,
  ambient: true,
  bootSound: true,
  reducedMotion: false,
  bootTarget: 'windows',
};
const meta: Record<AppId, { title: string; icon: IconName; width: number; height: number }> = {
  explorer: { title: 'My Computer', icon: 'computer', width: 850, height: 690 },
  notepad: { title: 'Untitled.txt - Notepad', icon: 'notepad', width: 550, height: 430 },
  browser: { title: 'Internet Explorer', icon: 'globe', width: 850, height: 610 },
  calculator: { title: 'Calculator', icon: 'calculator', width: 342, height: 420 },
  terminal: { title: 'Command Prompt', icon: 'terminal', width: 700, height: 450 },
  settings: { title: 'Control Panel', icon: 'settings', width: 570, height: 590 },
  search: { title: 'Search Results', icon: 'search', width: 560, height: 490 },
  run: { title: 'Run', icon: 'computer', width: 420, height: 225 },
  game: { title: 'Memory Lane', icon: 'game', width: 430, height: 585 },
  dialog: { title: 'Personal Computer', icon: 'computer', width: 440, height: 255 },
  shelf: { title: 'My Shelf', icon: 'certificate', width: 790, height: 625 },
  games: { title: 'Games', icon: 'game', width: 650, height: 565 },
  snake: { title: 'Snake', icon: 'game', width: 520, height: 570 },
  pong: { title: 'Pong', icon: 'game', width: 690, height: 535 },
  minesweeper: { title: 'Minesweeper', icon: 'game', width: 385, height: 540 },
  taskmanager: { title: 'Task Manager', icon: 'settings', width: 535, height: 440 },
  help: { title: 'Help and Support', icon: 'computer', width: 570, height: 545 },
};
function initialWindow(
  app: AppId,
  id: string,
  z: number,
  params: Record<string, string> = {},
): WindowData {
  const m = meta[app],
    width = Math.min(m.width, innerWidth - 40),
    height = Math.min(m.height, innerHeight - 90);
  return {
    id,
    app,
    ...m,
    title: params.folder ? getFile(params.folder)?.name || m.title : m.title,
    width,
    height,
    x: Math.max(18, (innerWidth - width) / 2 + Math.min(z * 14, 65)),
    y: Math.max(16, (innerHeight - height - 45) / 2 - 14 + Math.min(z * 8, 35)),
    minimized: false,
    maximized: false,
    z,
    params,
  };
}
function firstWindows() {
  const main = initialWindow('explorer', 'welcome', 3);
  main.x = Math.max(125, (innerWidth - 850) / 2 - 5);
  main.y = Math.max(28, (innerHeight - main.height) / 2 - 25);
  if (innerWidth < 900) main.x = 20;
  const note = initialWindow('notepad', 'readme', 2, { file: 'readme' });
  note.width = 310;
  note.height = 253;
  note.x = innerWidth - 347;
  note.y = innerHeight - 338;
  return innerWidth > 1200 ? [main, note] : [main];
}
function UserWallpaper({ id }: { id?: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let current = '',
      alive = true;
    const load = async () => {
      const item = id ? await shelfRepository.get(id) : null;
      if (current) URL.revokeObjectURL(current);
      if (alive) {
        current = item && isSafeImage(item.type) ? URL.createObjectURL(item.blob) : '';
        setUrl(current);
      }
    };
    void load().catch(() => {});
    window.addEventListener('pc-shelf-change', load);
    return () => {
      alive = false;
      if (current) URL.revokeObjectURL(current);
      window.removeEventListener('pc-shelf-change', load);
    };
  }, [id]);
  return url ? <div className="user-wallpaper" style={{ backgroundImage: `url(${url})` }} /> : null;
}
export default function App() {
  const [settings, setSettingsState] = useState<Settings>(() => ({
    ...defaults,
    ...readStorage<Partial<Settings>>('pc-settings', {}),
  }));
  const [machine, dispatch] = useReducer(machineReducer, undefined, (): MachineState => ({
    phase: settings.skipBoot
      ? settings.bootTarget === 'linux'
        ? 'LINUX_TERMINAL'
        : 'WINDOWS_DESKTOP'
      : 'BOOT',
    target: settings.bootTarget,
    epoch: 0,
    safeMode: false,
    turnOff: false,
  }));
  const stage = machine.phase;
  const machineRef = useRef(machine);
  machineRef.current = machine;
  const [windows, setWindows] = useState<WindowData[]>(firstWindows);
  const zCounter = useRef(4),
    idCounter = useRef(0);
  const [start, setStart] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [desktopFocused, setDesktopFocused] = useState(false);
  const [context, setContext] = useState<{ x: number; y: number } | null>(null);
  const [arrange, setArrange] = useState(0);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clock, setClock] = useState(new Date());
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [power, setPower] = useState(false);
  const [showDesktop, setShowDesktop] = useState(false);
  const desktopHiddenIds = useRef<Set<string>>(new Set());
  const [unlocked, setUnlocked] = useState(false);
  const audioUnlocked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [standby, setStandby] = useState(false);
  const [switcher, setSwitcher] = useState<{ ids: string[]; index: number } | null>(null);
  const switcherRef = useRef(switcher);
  switcherRef.current = switcher;
  const metaOnly = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const reduced =
    settings.reducedMotion ||
    machine.safeMode ||
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 5500);
  }, []);
  const beep = useCallback((kind: Parameters<typeof playSound>[0]) => {
    const s = settingsRef.current;
    if (!audioUnlocked.current || !s.sound || machineRef.current.safeMode) return;
    if (['click', 'type'].includes(kind) && !s.clickSound) return;
    if (['boot', 'post', 'disk', 'shutdown'].includes(kind) && !s.bootSound) return;
    playSound(kind, s.volume);
  }, []);
  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((old) => {
      const next = { ...old, ...patch };
      settingsRef.current = next;
      writeStorage('pc-settings', next);
      return next;
    });
  }, []);
  useEffect(() => {
    setAudioVolume(settings.sound && !machine.safeMode ? settings.volume : 0);
  }, [settings.sound, settings.volume, machine.safeMode]);
  useEffect(() => {
    if (
      stage === 'WINDOWS_DESKTOP' &&
      settings.sound &&
      settings.ambient &&
      unlocked &&
      !machine.safeMode &&
      !standby
    )
      return startBootAmbience(settings.volume);
  }, [
    stage,
    settings.sound,
    settings.ambient,
    settings.volume,
    unlocked,
    machine.safeMode,
    standby,
  ]);
  const launch = useCallback(
    (app: AppId, params: Record<string, string> = {}) => {
      const id = `window-${++idCounter.current}`,
        z = ++zCounter.current;
      setWindows((old) => [...old, initialWindow(app, id, z, params)]);
      setDesktopFocused(false);
      setStart(false);
      setContext(null);
      setBusy(true);
      setTimeout(() => setBusy(false), 180);
      beep('open');
    },
    [beep],
  );
  const openFile = useCallback(
    (file: FileEntry) => {
      if (file.kind === 'folder') launch('explorer', { folder: file.id });
      if (file.kind === 'text') launch('notepad', { file: file.id });
      if (file.kind === 'app') launch(file.app || 'game', file.params);
      if (file.kind === 'link') {
        if (file.target?.startsWith('portfolio://'))
          launch('browser', { page: file.target.split('://')[1] });
        else if (file.target && /^https?:\/\//i.test(file.target))
          window.open(file.target, '_blank', 'noopener,noreferrer');
      }
    },
    [launch],
  );
  const updateWindow = useCallback(
    (id: string, patch: Partial<WindowData>) =>
      setWindows((old) => old.map((w) => (w.id === id ? { ...w, ...patch } : w))),
    [],
  );
  const close = useCallback(
    (id: string) => {
      const w = windows.find((w) => w.id === id);
      if (
        w?.app === 'notepad' &&
        w.title.startsWith('*') &&
        !window.confirm('Discard unsaved changes? Use File → Save to keep this note.')
      )
        return;
      setWindows((old) => old.filter((w) => w.id !== id));
      beep('close');
    },
    [windows, beep],
  );
  const focus = useCallback((id: string) => {
    setDesktopFocused(false);
    const z = ++zCounter.current;
    setWindows((old) => old.map((w) => (w.id === id ? { ...w, z, minimized: false } : w)));
  }, []);
  const bootComplete = useCallback(() => {
    dispatch({ type: 'LOADED' });
    setWindows(firstWindows());
    setDesktopFocused(false);
    writeStorage('pc-visited', true);
  }, []);
  const reboot = useCallback(
    (turnOff = false) => {
      if (
        windows.some((w) => w.app === 'notepad' && w.title.startsWith('*')) &&
        !window.confirm(
          'Discard unsaved notes and restart? Saved files and Shelf objects are kept.',
        )
      )
        return;
      dispatch({
        type: 'REBOOT',
        target: turnOff ? 'windows' : settingsRef.current.bootTarget,
        turnOff,
      });
    },
    [windows],
  );
  const restart = useCallback(() => reboot(false), [reboot]);
  const shutdown = useCallback(() => reboot(true), [reboot]);
  const linuxReboot = useCallback(() => dispatch({ type: 'REBOOT', target: 'windows' }), []);
  useEffect(() => {
    if (stage !== 'SHUTDOWN') return;
    setWindows([]);
    setPower(false);
    setStart(false);
    setContext(null);
    setVolumeOpen(false);
    setSwitcher(null);
    setSelected([]);
    setStandby(false);
    setShowDesktop(false);
    setToast('');
    desktopHiddenIds.current.clear();
    zCounter.current = 4;
    beep('shutdown');
    const timer = setTimeout(() => dispatch({ type: 'POWERED_DOWN' }), 1800);
    return () => clearTimeout(timer);
  }, [stage, beep]);
  const resetDesktop = useCallback(() => {
    ['pc-icon-labels', 'pc-icon-positions', 'pc-desktop-hidden'].forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        /* Best effort when storage is disabled. */
      }
    });
    setSelected([]);
    setArrange((a) => a + 1);
    notify('Desktop icons restored. Notes and Shelf objects are unchanged.');
  }, [notify]);
  const clearTemporary = useCallback(() => {
    try {
      new LinuxFilesystem().clearTemporary();
    } catch (e) {
      notify((e as Error).message);
      return;
    }
    setContext(null);
    setStart(false);
    setSelected([]);
    setSwitcher(null);
    setToast('');
    window.dispatchEvent(new Event('pc-clear-temporary'));
    notify('Temporary files and transient UI state cleared. Saved files are kept.');
  }, [notify]);
  const bsod = useCallback(() => {
    dispatch({ type: 'GO', phase: 'BSOD' });
    setStart(false);
    beep('error');
  }, [beep]);
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => {
      clearInterval(timer);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  const activeId = useMemo(
    () =>
      desktopFocused
        ? undefined
        : [...windows].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]?.id,
    [windows, desktopFocused],
  );
  useEffect(() => {
    let code: string[] = [];
    const sequence = [
      'ArrowUp',
      'ArrowUp',
      'ArrowDown',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowLeft',
      'ArrowRight',
      'b',
      'a',
    ];
    const key = (e: KeyboardEvent) => {
      if (!e.isTrusted) return;
      unlockAudio();
      audioUnlocked.current = true;
      setUnlocked(true);
      if (stage === 'BSOD' && e.key === 'Escape') {
        dispatch({ type: 'GO', phase: 'WINDOWS_DESKTOP' });
        return;
      }
      if (stage !== 'WINDOWS_DESKTOP') return;
      if (standby) {
        setStandby(false);
        return;
      }
      if (e.key === 'Meta') {
        metaOnly.current = true;
        return;
      }
      if (e.metaKey) metaOnly.current = false;
      const typing = (e.target as HTMLElement).matches(
        'input,textarea,select,[contenteditable="true"]',
      );
      if (typing && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) beep('type');
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        const current = switcherRef.current;
        const ids = current?.ids || [...windows].sort((a, b) => b.z - a.z).map((w) => w.id);
        if (!ids.length) return;
        const index = current ? current.index : Math.max(0, ids.indexOf(activeId || ''));
        const next = { ids, index: (index + (e.shiftKey ? -1 : 1) + ids.length) % ids.length };
        switcherRef.current = next;
        setSwitcher(next);
        return;
      }
      if (e.altKey && e.key === 'F4' && activeId) {
        e.preventDefault();
        close(activeId);
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'Escape') {
        e.preventDefault();
        launch('taskmanager');
        return;
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'Escape') {
        e.preventDefault();
        setStart((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setStart(false);
        setContext(null);
        setVolumeOpen(false);
        setPower(false);
        setSwitcher(null);
        switcherRef.current = null;
        return;
      }
      if (e.key === 'Enter' && switcherRef.current) {
        e.preventDefault();
        const s = switcherRef.current;
        focus(s.ids[s.index]);
        setSwitcher(null);
        switcherRef.current = null;
        return;
      }
      if (e.key === 'F1' && !typing) {
        e.preventDefault();
        launch('help');
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('pc-refresh', { detail: { id: activeId } }));
        setBusy(true);
        setTimeout(() => setBusy(false), 220);
        notify(activeId ? 'View refreshed. Unsaved work is kept.' : 'Desktop refreshed.');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l' && !typing) {
        e.preventDefault();
        launch('terminal');
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      code = [...code, e.key].slice(-10);
      if (code.join(',') === sequence.join(',')) {
        launch('game');
        notify('Achievement unlocked: old-school explorer.');
        code = [];
      }
    };
    const up = (e: KeyboardEvent) => {
      if (stage !== 'WINDOWS_DESKTOP') return;
      if (e.key === 'Meta' && metaOnly.current) {
        setStart((v) => !v);
        metaOnly.current = false;
      }
      if (e.key === 'Alt' && switcherRef.current) {
        const s = switcherRef.current;
        focus(s.ids[s.index]);
        setSwitcher(null);
        switcherRef.current = null;
      }
    };
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', up);
    };
  }, [stage, windows, activeId, close, focus, launch, notify, standby]);
  const desktopContext = useMemo(
    () => ({
      launch,
      openFile,
      close,
      updateWindow,
      settings,
      setSettings,
      beep,
      bsod,
      restart,
      notify,
      windows,
      focusWindow: focus,
      clearTemporary,
      resetDesktop,
    }),
    [
      launch,
      openFile,
      close,
      updateWindow,
      settings,
      setSettings,
      beep,
      bsod,
      restart,
      notify,
      windows,
      focus,
      clearTemporary,
      resetDesktop,
    ],
  );
  const handleDesktop = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest(
        '.os-window,.desktop-icon,.taskbar,.start-menu,.context-menu',
      )
    )
      return;
    setDesktopFocused(true);
    setStart(false);
    setContext(null);
    setVolumeOpen(false);
  };
  const desktopToggle = () => {
    if (!showDesktop) {
      desktopHiddenIds.current = new Set(windows.filter((w) => !w.minimized).map((w) => w.id));
      setWindows((ws) => ws.map((w) => ({ ...w, minimized: true })));
      setDesktopFocused(true);
    } else {
      setWindows((ws) =>
        ws.map((w) => (desktopHiddenIds.current.has(w.id) ? { ...w, minimized: false } : w)),
      );
      desktopHiddenIds.current.clear();
      setDesktopFocused(false);
    }
    setShowDesktop(!showDesktop);
  };
  const makeDesktopFile = (kind: 'folder' | 'text') => {
    let name = kind === 'folder' ? 'New Folder' : 'New Document.txt',
      n = 2;
    const base = name;
    while (children('desktop').some((f) => f.name === name)) name = `${base} (${n++})`;
    try {
      const file = createFile('desktop', name, kind);
      setSelected([file.id]);
      setDesktopFocused(true);
      setContext(null);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const content = (w: WindowData) => {
    switch (w.app) {
      case 'explorer':
        return <Explorer window={w} active={activeId === w.id} />;
      case 'notepad':
        return <Notepad window={w} active={activeId === w.id} />;
      case 'browser':
        return <Browser window={w} />;
      case 'calculator':
        return <Calculator active={activeId === w.id} />;
      case 'terminal':
        return <Terminal window={w} active={activeId === w.id} />;
      case 'settings':
        return <SettingsApp />;
      case 'search':
        return <SearchApp />;
      case 'run':
        return <RunApp window={w} />;
      case 'game':
        return <Game />;
      case 'dialog':
        return <DialogApp window={w} />;
      case 'shelf':
        return <Shelf />;
      case 'games':
        return <Games />;
      case 'snake':
        return <Snake active={activeId === w.id} />;
      case 'pong':
        return <Pong active={activeId === w.id} />;
      case 'minesweeper':
        return <Minesweeper />;
      case 'taskmanager':
        return <TaskManager />;
      case 'help':
        return <HelpCenter />;
    }
  };
  return (
    <DesktopContext.Provider value={desktopContext}>
      <div
        className={`computer-screen ${settings.crt && !machine.safeMode ? 'crt-enabled' : ''} ${reduced ? 'reduce-motion' : ''} ${busy ? 'system-busy' : ''}`}
        onPointerDownCapture={(e) => {
          unlockAudio();
          audioUnlocked.current = true;
          setUnlocked(true);
          if (stage === 'WINDOWS_DESKTOP') {
            if ((e.target as HTMLElement).closest('.desktop-icon')) setDesktopFocused(true);
            if ((e.target as HTMLElement).closest('button') && settings.clickSound) beep('click');
            if (standby) setStandby(false);
          }
        }}
      >
        {['BOOT', 'BIOS', 'OS_LOADING', 'BOOT_MENU', 'BIOS_SETUP', 'RECOVERY'].includes(stage) && (
          <SystemScreens
            key={machine.epoch}
            machine={machine}
            dispatch={dispatch}
            onLoaded={bootComplete}
            restart={restart}
            clearTemporary={clearTemporary}
            resetDesktop={resetDesktop}
            unlocked={unlocked}
          />
        )}
        {stage === 'LINUX_TERMINAL' && <LinuxTerminal reboot={linuxReboot} shutdown={shutdown} />}
        {stage === 'SHUTDOWN' && (
          <div className="shutdown-screen" data-system-mode="SHUTDOWN">
            <Icon name="computer" size={70} />
            <h1>
              {machine.turnOff ? 'Your computer is shutting down…' : 'Your computer is restarting…'}
            </h1>
            <p>Saving your settings. Closing this session.</p>
          </div>
        )}
        {stage === 'WINDOWS_DESKTOP' && (
          <div
            className="desktop"
            onClick={handleDesktop}
            onContextMenu={(e) => {
              if (
                (e.target as HTMLElement).closest('.os-window,.desktop-icon,.taskbar,.start-menu')
              )
                return;
              e.preventDefault();
              setContext({
                x: Math.min(e.clientX, innerWidth - 218),
                y: Math.min(e.clientY, innerHeight - 260),
              });
              setStart(false);
            }}
          >
            <Wallpaper night={settings.wallpaper === 'night'} />
            {settings.wallpaper === 'slate' && <div className="slate-wallpaper" />}
            {settings.wallpaper === 'custom' && <UserWallpaper id={settings.customWallpaper} />}
            {machine.safeMode && <div className="safe-mode-label">Safe Mode</div>}
            <div className="desktop-brand">
              <span>THE PERSONAL COMPUTER</span>
              <b>
                A familiar place.
                <br />A new perspective.
              </b>
              <small>EST. 2004 · STILL CURIOUS</small>
            </div>
            <DesktopIcons
              selected={selected}
              setSelected={setSelected}
              arrange={arrange}
              focused={desktopFocused}
            />
            <div className="desktop-caption">
              <span>✳</span>
              <p>
                A little space on the internet.
                <br />
                An open invitation to explore.
              </p>
            </div>
            {windows.map((w) => (
              <Window
                key={w.id}
                window={w}
                active={activeId === w.id}
                focus={() => {
                  if (activeId !== w.id) focus(w.id);
                }}
                update={(patch) => updateWindow(w.id, patch)}
                close={() => close(w.id)}
              >
                {content(w)}
              </Window>
            ))}
            {start && (
              <>
                <div className="menu-dismiss start-dismiss" onPointerDown={() => setStart(false)} />
                <StartMenu onClose={() => setStart(false)} onPower={() => setPower(true)} />
              </>
            )}
            {context && (
              <ContextMenu
                x={context.x}
                y={context.y}
                onClose={() => setContext(null)}
                items={[
                  {
                    label: 'Arrange Icons By',
                    children: [
                      { label: 'Name / Reset layout', action: () => setArrange((a) => a + 1) },
                    ],
                  },
                  {
                    label: 'Refresh',
                    action: () => {
                      window.dispatchEvent(new CustomEvent('pc-refresh'));
                      notify('Desktop refreshed. Everything is right where you left it.');
                    },
                  },
                  {
                    label: 'Paste',
                    action: () => {
                      if (fileClipboard) {
                        try {
                          pasteFiles('desktop');
                        } catch (error) {
                          notify((error as Error).message);
                        }
                      } else {
                        navigator.clipboard
                          .readText()
                          .then((content) => launch('notepad', { content }))
                          .catch(() => notify('Open Notepad and use Ctrl+V or ⌘V to paste text.'));
                      }
                    },
                  },
                  {
                    label: 'New',
                    children: [
                      { label: 'Text Document', action: () => makeDesktopFile('text') },
                      { label: 'Folder', action: () => makeDesktopFile('folder') },
                    ],
                  },
                  { label: 'Properties', action: () => launch('settings') },
                ]}
              />
            )}
            {toast && (
              <div className="notification" role="status">
                <Icon name="computer" size={27} />
                <div>
                  <b>Personal Computer</b>
                  <p>{toast}</p>
                </div>
                <button aria-label="Dismiss notification" onClick={() => setToast('')}>
                  <X size={14} />
                </button>
              </div>
            )}
            {volumeOpen && (
              <div className="volume-popup">
                <b>Volume</b>
                <label>
                  <Volume2 size={18} />
                  <input
                    aria-label="System volume"
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    value={settings.volume}
                    onChange={(e) => setSettings({ volume: Number(e.target.value) })}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!settings.sound}
                    onChange={(e) => setSettings({ sound: !e.target.checked })}
                  />{' '}
                  Mute
                </label>
              </div>
            )}
            <footer className="taskbar">
              <button
                className={`start-button ${start ? 'pressed' : ''}`}
                aria-label="Start"
                aria-expanded={start}
                onClick={() => {
                  setStart(!start);
                  setContext(null);
                  setVolumeOpen(false);
                  beep('click');
                }}
              >
                <span className="start-logo">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span>start</span>
              </button>
              <div className="quick-launch">
                <button aria-label="Show desktop" title="Show desktop" onClick={desktopToggle}>
                  <Icon name="computer" size={22} />
                </button>
                <button
                  aria-label="Launch Internet"
                  title="Internet"
                  onClick={() => launch('browser')}
                >
                  <Icon name="globe" size={22} />
                </button>
              </div>
              <div className="task-buttons">
                {windows.map((w) => (
                  <button
                    key={w.id}
                    className={`task-button ${activeId === w.id && !w.minimized ? 'active' : ''}`}
                    title={w.title}
                    aria-label={`Taskbar: ${w.title}`}
                    onClick={() => {
                      if (activeId === w.id && !w.minimized)
                        updateWindow(w.id, { minimized: true });
                      else {
                        updateWindow(w.id, { minimized: false });
                        focus(w.id);
                      }
                    }}
                  >
                    <Icon name={w.icon} size={19} />
                    <span>{w.title}</span>
                  </button>
                ))}
              </div>
              <div className="system-tray">
                <button
                  title={settings.sound ? 'Sound settings' : 'Sound is muted'}
                  aria-label="Volume settings"
                  onClick={() => setVolumeOpen(!volumeOpen)}
                >
                  {settings.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
                </button>
                <button
                  aria-label="Connection status"
                  title="Connection status"
                  onClick={() =>
                    notify(
                      'Connected to your imagination.\nLocal apps are ready; external links need an internet connection.',
                    )
                  }
                >
                  <Wifi size={16} />
                </button>
                <button
                  className="tray-clock"
                  title={clock.toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  onClick={() =>
                    notify(
                      clock.toLocaleString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }),
                    )
                  }
                >
                  {clock.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </button>
              </div>
            </footer>
            {power && (
              <div className="power-backdrop">
                <div className="power-dialog">
                  <header>
                    Turn off computer <Icon name="computer" size={35} />
                  </header>
                  <div>
                    <button
                      onClick={() => {
                        setPower(false);
                        shutdown();
                      }}
                    >
                      <Icon name="power" size={48} />
                      Turn Off
                    </button>
                    <button onClick={restart}>
                      <span className="restart-icon">
                        <RotateCw size={27} />
                      </span>
                      Restart
                    </button>
                    <button
                      onClick={() => {
                        setPower(false);
                        setStandby(true);
                      }}
                    >
                      <span className="standby-icon">
                        <Monitor size={27} />
                      </span>
                      Stand By
                    </button>
                  </div>
                  <footer>
                    <button className="xp-button" onClick={() => setPower(false)}>
                      Cancel
                    </button>
                  </footer>
                </div>
              </div>
            )}
          </div>
        )}
        {stage === 'BSOD' && (
          <div className="bsod">
            <h1>:(</h1>
            <h2>
              A problem has been detected.
              <br />
              Your curiosity has exceeded the recommended limit.
            </h2>
            <p>CURIOUS_MIND_EXCEPTION</p>
            <p>
              If this is the first time you’ve seen this screen, congratulations.
              <br />
              You found an Easter egg. Your files are completely safe.
            </p>
            <p>
              Technical information:
              <br />
              *** STOP: 0x00000042 (0xCURIOSITY, 0xKEEPGOING, 0xHELLOWORLD)
            </p>
            <div className="bsod-progress">Collecting good memories... 100%</div>
            <button onClick={() => dispatch({ type: 'GO', phase: 'WINDOWS_DESKTOP' })}>
              Press ESC or click here to return to your desktop →
            </button>
            <small>This is a simulation. Nothing has crashed.</small>
          </div>
        )}
        {stage === 'OFF' && (
          <div className="off-screen">
            <Icon name="computer" size={70} />
            <h1>It’s now safe to turn off your computer.</h1>
            <p>Thanks for stopping by. Stay curious.</p>
            <button onClick={restart}>
              <Icon name="power" size={25} /> Power on
            </button>
          </div>
        )}
        {stage === 'WINDOWS_DESKTOP' && switcher && (
          <div className="app-switcher" role="dialog" aria-label="Application switcher">
            <h2>Switch applications</h2>
            <div>
              {switcher.ids.map((id, i) => {
                const w = windows.find((w) => w.id === id);
                return w ? (
                  <button
                    className={i === switcher.index ? 'selected' : ''}
                    key={id}
                    onClick={() => {
                      focus(id);
                      setSwitcher(null);
                      switcherRef.current = null;
                    }}
                  >
                    <Icon name={w.icon} size={37} />
                    <span>{w.title}</span>
                  </button>
                ) : null;
              })}
            </div>
            <p>{windows.find((w) => w.id === switcher.ids[switcher.index])?.title}</p>
            <small>Release Alt to switch</small>
          </div>
        )}
        {standby && stage === 'WINDOWS_DESKTOP' && (
          <div
            className="standby-screen"
            role="button"
            tabIndex={0}
            aria-label="Wake computer"
            onClick={() => setStandby(false)}
            onKeyDown={() => setStandby(false)}
          >
            <span className="standby-led" />
            Stand by · press a key to wake
          </div>
        )}
        <div className="crt-overlay" aria-hidden="true" />
        <div className="screen-edge" aria-hidden="true" />
      </div>
      <span className="sr-only">
        <Info />
        Interactive portfolio. Press Enter to skip startup. Use Tab and Enter to navigate
        applications. Press Control Escape to open Start.
      </span>
    </DesktopContext.Provider>
  );
}
