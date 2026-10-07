import { useCallback, useEffect, useState } from 'react';
import MenuBar from '../MenuBar';
import { useDesktop } from '../../lib/DesktopContext';
export function calculate(a: number, b: number, op: string): number {
  if (op === '+') return a + b;
  if (op === '−') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return b === 0 ? NaN : a / b;
  return b;
}
export default function Calculator({ active }: { active: boolean }) {
  const [value, setValue] = useState('0');
  const [previous, setPrevious] = useState<number | null>(null);
  const [operator, setOperator] = useState('');
  const [fresh, setFresh] = useState(false);
  const [memory, setMemory] = useState(0);
  const { notify } = useDesktop();
  const press = useCallback(
    (key: string) => {
      if (key === 'C') {
        setValue('0');
        setPrevious(null);
        setOperator('');
        setFresh(false);
        return;
      }
      if (key === 'CE') {
        setValue('0');
        setFresh(false);
        return;
      }
      if (key === '⌫') {
        setValue((v) => (v.length > 1 ? v.slice(0, -1) : '0'));
        return;
      }
      if (key === '±') {
        setValue((v) => (v === '0' ? v : String(-Number(v))));
        return;
      }
      if (key === '√') {
        setValue((v) => (Number(v) < 0 ? 'Error' : String(Math.sqrt(Number(v)))));
        setFresh(true);
        return;
      }
      if (key === '%') {
        setValue((v) => String(Number(v) / 100));
        return;
      }
      if (key === '1/x') {
        setValue((v) => (Number(v) === 0 ? 'Error' : String(1 / Number(v))));
        setFresh(true);
        return;
      }
      if (['MC', 'MR', 'MS', 'M+'].includes(key)) {
        if (key === 'MC') setMemory(0);
        if (key === 'MR') {
          setValue(String(memory));
          setFresh(true);
        }
        if (key === 'MS') setMemory(Number(value) || 0);
        if (key === 'M+') setMemory((m) => m + (Number(value) || 0));
        return;
      }
      if (['+', '−', '×', '÷', '='].includes(key)) {
        const current = Number(value);
        if (!Number.isFinite(current)) return;
        let result = current;
        if (previous !== null && operator && !fresh)
          result = calculate(previous, current, operator);
        const display = Number.isFinite(result) ? String(Number(result.toPrecision(12))) : 'Error';
        setValue(display);
        setPrevious(key === '=' ? null : result);
        setOperator(key === '=' ? '' : key);
        setFresh(true);
        return;
      }
      if (key === '.') {
        if (fresh || value === 'Error') {
          setValue('0.');
          setFresh(false);
        } else if (!value.includes('.')) setValue(value + '.');
        return;
      }
      if (/^\d$/.test(key)) {
        setValue((v) => (fresh || v === '0' || v === 'Error' ? key : v.length < 15 ? v + key : v));
        setFresh(false);
      }
    },
    [fresh, value, previous, operator, memory],
  );
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      const mapping: Record<string, string> = {
        Enter: '=',
        Escape: 'C',
        Backspace: '⌫',
        '*': '×',
        '/': '÷',
        '-': '−',
      };
      const v = mapping[e.key] || e.key;
      if (/^[0-9.+%=]$/.test(v) || Object.values(mapping).includes(v)) {
        e.preventDefault();
        press(v);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [active, press]);
  return (
    <div className="calculator app-column">
      <MenuBar
        menus={[
          {
            label: 'Edit',
            items: [
              {
                label: 'Copy result',
                action: () => {
                  void navigator.clipboard
                    .writeText(value)
                    .catch(() => notify('Select the display to copy the result.'));
                },
              },
            ],
          },
          { label: 'View', items: [{ label: 'Standard', checked: true }] },
          {
            label: 'Help',
            items: [
              {
                label: 'Keyboard shortcuts',
                action: () =>
                  notify(
                    'Type numbers and + − * /. Enter calculates, Escape clears, Backspace deletes.',
                  ),
              },
            ],
          },
        ]}
      />
      <div className="calculator-body">
        <div className="calc-expression">{previous !== null ? `${previous} ${operator}` : ' '}</div>
        <output className="calc-display" aria-live="polite">
          {value}
        </output>
        <div className="calc-clear">
          <span>{memory !== 0 ? 'M' : ''}</span>
          {['⌫', 'CE', 'C'].map((k) => (
            <button key={k} onClick={() => press(k)}>
              {k}
            </button>
          ))}
        </div>
        <div className="calc-keys">
          {[
            'MC',
            '7',
            '8',
            '9',
            '÷',
            '√',
            'MR',
            '4',
            '5',
            '6',
            '×',
            '%',
            'MS',
            '1',
            '2',
            '3',
            '−',
            '1/x',
            'M+',
            '0',
            '±',
            '.',
            '+',
            '=',
          ].map((k) => (
            <button
              className={`${/[0-9.]/.test(k) ? 'number' : ''} ${k === '=' ? 'equals' : ''}`}
              onClick={() => press(k)}
              key={k}
            >
              {k}
            </button>
          ))}
        </div>
        <p>Little calculations. Big ideas.</p>
      </div>
    </div>
  );
}
