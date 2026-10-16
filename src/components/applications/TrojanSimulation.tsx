import { useEffect, useRef, useState } from 'react';
const stages = [
  ['Connecting…', 'Preparing Aurora Screensaver'],
  ['Receiving package…', 'aurora-screensaver.scr'],
  ['Unexpected startup task', 'A background process requested permission to run.'],
  ['Connection interrupted', 'An unfamiliar process attempted an outbound connection.'],
  [
    'All clear',
    'This was a security awareness exercise. Nothing was downloaded, executed, or changed.',
  ],
];
const commands = [
  '> requesting aurora-screensaver.scr',
  '> receiving package … 24%',
  '> receiving package … 68%',
  '> receiving package … 100%',
  '> verifying publisher … not recognized',
  '> unexpected background task detected',
  '> outbound connection requested',
  '> execution stopped',
];
export default function TrojanSimulation({ onClose }: { onClose: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [run, setRun] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const step = Math.min(4, Math.floor(elapsed / 1800));
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    const started = performance.now();
    const timer = setInterval(() => {
      const time = Math.min(7200, performance.now() - started);
      setElapsed(time);
      if (time >= 7200) clearInterval(timer);
    }, 300);
    return () => clearInterval(timer);
  }, [run]);
  return (
    <dialog
      ref={dialog}
      className={'trojan-simulation ' + (step === 4 ? 'exercise-complete' : 'exercise-running')}
      aria-label="Security awareness exercise"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <b>{step === 4 ? 'SECURITY AWARENESS' : 'AURORA · PACKAGE SESSION'}</b>
        <button autoFocus onClick={onClose}>
          {step === 4 ? 'Close exercise' : 'Exit sequence'}
        </button>
      </header>
      <div className={'sim-shield ' + (step === 4 ? 'clear' : '')} aria-hidden="true">
        {step === 4 ? '✓' : '▥'}
      </div>
      <h2 aria-live="polite">{stages[step][0]}</h2>
      <p>{stages[step][1]}</p>
      {step !== 4 ? (
        <>
          <progress aria-label="Package sequence progress" value={elapsed} max={7200} />
          <pre className="exercise-console" aria-hidden="true">
            {commands.slice(0, Math.min(commands.length, Math.floor(elapsed / 800) + 1)).join('\n')}
            <span className="exercise-cursor">▌</span>
          </pre>
        </>
      ) : (
        <div className="exercise-lesson">
          <h3>Pause before you download.</h3>
          <p>
            A familiar name can hide an untrusted file. Check the sender and destination, verify the
            publisher, and avoid unexpected executables. If a download looks wrong, stop and check
            it before opening.
          </p>
          <button
            onClick={() => {
              setElapsed(0);
              setRun((n) => n + 1);
            }}
          >
            Replay sequence
          </button>
        </div>
      )}
      <footer>
        <span>
          {step === 4 ? 'Your computer and files are safe.' : 'Escape exits this sequence.'}
        </span>
      </footer>
    </dialog>
  );
}
