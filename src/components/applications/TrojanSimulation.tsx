import { useEffect, useRef, useState } from 'react';
const stages = [
  ['Suspicious link opened', 'The “free screensaver” disguises an executable download.'],
  ['Trojan detected', 'Simulation: a hidden process tries to launch behind the download.'],
  ['Connection blocked', 'Simulation: the firewall stops an unexpected outbound connection.'],
  ['File quarantined', 'Simulation: the pretend process is stopped and isolated.'],
  [
    'All clear',
    'Nothing was downloaded, executed or changed. Verify links and avoid unexpected executables.',
  ],
];
export default function TrojanSimulation({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (step >= stages.length - 1) return;
    const timer = setTimeout(() => setStep((s) => s + 1), 1800);
    return () => clearTimeout(timer);
  }, [step]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const buttons = Array.from(
          dialog.current?.querySelectorAll<HTMLButtonElement>('button') || [],
        );
        if (buttons.length) {
          e.preventDefault();
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[(index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
        }
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);
  return (
    <section
      ref={dialog}
      className="trojan-simulation"
      role="dialog"
      aria-modal="true"
      aria-label="Trojan attack simulation"
    >
      <header>
        <b>SECURITY LAB · SIMULATION</b>
        <button autoFocus onClick={onClose}>
          Close simulation
        </button>
      </header>
      <div className={`sim-shield ${step === 4 ? 'clear' : ''}`}>{step === 4 ? '✓' : '♞'}</div>
      <h2 aria-live="polite">{stages[step][0]}</h2>
      <p>{stages[step][1]}</p>
      <progress value={step + 1} max={5} />
      <ol>
        {stages.slice(0, step + 1).map(([title], i) => (
          <li key={title}>
            {String(i + 1).padStart(2, '0')} · {title}
          </li>
        ))}
      </ol>
      <footer>
        <span>Harmless visual demonstration · no files changed</span>
        {step === 4 && <button onClick={() => setStep(0)}>Replay sequence</button>}
      </footer>
    </section>
  );
}
