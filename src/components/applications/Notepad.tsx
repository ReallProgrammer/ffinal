import { useCallback, useEffect, useRef, useState } from 'react';
import { getFile, files } from '../../data/filesystem';
import { useDesktop } from '../../lib/DesktopContext';
import { downloadText, readStorage, writeStorage } from '../../lib/storage';
import type { WindowData } from '../../types';
import MenuBar from '../MenuBar';
export default function Notepad({ window: w, active }: { window: WindowData; active: boolean }) {
  const initial = getFile(w.params.file || '');
  const stored = readStorage<Record<string, string>>('pc-notes', {});
  const [text, setText] = useState(
    w.params.content ?? stored[initial?.name || 'Untitled.txt'] ?? initial?.content ?? '',
  );
  const [name, setName] = useState(initial?.name || 'Untitled.txt');
  const [saved, setSaved] = useState(w.params.content !== undefined ? '' : text);
  const [wrap, setWrap] = useState(true);
  const [dialog, setDialog] = useState<'open' | 'save' | null>(null);
  const [saveName, setSaveName] = useState(name);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { updateWindow, close, notify } = useDesktop();
  const dirty = text !== saved;
  useEffect(() => {
    updateWindow(w.id, { title: `${dirty ? '*' : ''}${name} - Notepad` });
  }, [name, dirty, w.id, updateWindow]);
  const save = useCallback(() => {
    const notes = readStorage<Record<string, string>>('pc-notes', {});
    if (writeStorage('pc-notes', { ...notes, [name]: text })) {
      setSaved(text);
      notify(`“${name}” saved on this computer.`);
    } else {
      downloadText(name, text);
      notify('Browser storage is unavailable. Your text was downloaded instead.');
    }
  }, [name, text, notify]);
  const newFile = () => {
    if (dirty && !window.confirm('Discard unsaved changes and create a new document?')) return;
    setText('');
    setSaved('');
    setName('Untitled.txt');
  };
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (['s', 'o', 'n'].includes(k)) {
        e.preventDefault();
        if (k === 's') {
          if (e.shiftKey) {
            setSaveName(name);
            setDialog('save');
          } else save();
        }
        if (k === 'o') setDialog('open');
        if (k === 'n') {
          if (text !== saved && !window.confirm('Discard unsaved changes?')) return;
          setName('Untitled.txt');
          setText('');
          setSaved('');
        }
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [active, save, name, text, saved]);
  const insertClipboard = async () => {
    try {
      const value = await navigator.clipboard.readText();
      const el = input.current!;
      const next = text.slice(0, el.selectionStart) + value + text.slice(el.selectionEnd);
      setText(next);
    } catch {
      notify('Use Ctrl+V (or ⌘V) to paste into the document.');
    }
  };
  const copy = async (cut = false) => {
    const el = input.current!;
    try {
      await navigator.clipboard.writeText(text.slice(el.selectionStart, el.selectionEnd));
      if (cut) setText(text.slice(0, el.selectionStart) + text.slice(el.selectionEnd));
    } catch {
      notify('Use your keyboard’s Copy or Cut shortcut.');
    }
  };
  const load = (nextName: string, value: string) => {
    if (dirty && !window.confirm('Discard unsaved changes and open another document?')) return;
    setName(nextName);
    setText(value);
    setSaved(value);
    setDialog(null);
  };
  return (
    <div className="notepad app-column">
      <MenuBar
        menus={[
          {
            label: 'File',
            items: [
              { label: 'New', shortcut: 'Ctrl+N', action: newFile },
              { label: 'Open…', shortcut: 'Ctrl+O', action: () => setDialog('open') },
              { label: 'Save', shortcut: 'Ctrl+S', action: save },
              {
                label: 'Save As…',
                shortcut: 'Ctrl+Shift+S',
                action: () => {
                  setSaveName(name);
                  setDialog('save');
                },
              },
              { label: '', separator: true },
              {
                label: 'Exit',
                action: () => {
                  if (!dirty || window.confirm('Discard unsaved changes?')) close(w.id);
                },
              },
            ],
          },
          {
            label: 'Edit',
            items: [
              { label: 'Cut', shortcut: 'Ctrl+X', action: () => void copy(true) },
              { label: 'Copy', shortcut: 'Ctrl+C', action: () => void copy() },
              { label: 'Paste', shortcut: 'Ctrl+V', action: () => void insertClipboard() },
              {
                label: 'Select All',
                shortcut: 'Ctrl+A',
                action: () => {
                  input.current?.focus();
                  input.current?.select();
                },
              },
              { label: 'Time/Date', action: () => setText((t) => t + new Date().toLocaleString()) },
            ],
          },
          {
            label: 'Format',
            items: [{ label: 'Word Wrap', checked: wrap, action: () => setWrap(!wrap) }],
          },
          {
            label: 'Help',
            items: [
              {
                label: 'About Notepad',
                action: () =>
                  notify(
                    'Notepad — A little space for big ideas. Save keeps notes in this browser; Save As also downloads a copy.',
                  ),
              },
            ],
          },
        ]}
      />
      <textarea
        ref={input}
        aria-label="Notepad document"
        className={`notepad-editor ${wrap ? 'wrap' : ''}`}
        value={text}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onSelect={(e) => setCursor(e.currentTarget.selectionStart)}
        wrap={wrap ? 'soft' : 'off'}
      />
      <footer className="status-bar">
        <span>{dirty ? 'Unsaved changes' : 'Plain text, endless possibilities.'}</span>
        <span>
          Ln {text.slice(0, cursor).split('\n').length}, Col{' '}
          {(text.slice(0, cursor).split('\n').pop()?.length || 0) + 1}
        </span>
        <span>UTF-8</span>
      </footer>
      <input
        ref={fileInput}
        hidden
        type="file"
        accept=".txt,.md,.log,.csv"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) load(f.name, await f.text());
          e.target.value = '';
        }}
      />
      {dialog && (
        <div className="app-modal-backdrop">
          <div className="app-modal">
            <h3>{dialog === 'open' ? 'Open a document' : 'Save As'}</h3>
            {dialog === 'open' ? (
              <>
                <div className="open-file-list">
                  {files
                    .filter((f) => f.kind === 'text')
                    .map((f) => (
                      <button
                        key={f.id}
                        onClick={() => load(f.name, stored[f.name] ?? f.content ?? '')}
                      >
                        📄 {f.name}
                      </button>
                    ))}
                  {Object.entries(stored)
                    .filter(([n]) => !files.some((f) => f.name === n))
                    .map(([n, v]) => (
                      <button key={n} onClick={() => load(n, v)}>
                        📄 {n}
                      </button>
                    ))}
                </div>
                <button className="xp-button" onClick={() => fileInput.current?.click()}>
                  Browse this device…
                </button>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!saveName.trim()) return;
                  const n = saveName.trim().replace(/[/\\]/g, '_');
                  const ok = writeStorage('pc-notes', { ...stored, [n]: text });
                  downloadText(n, text);
                  setName(n);
                  setSaved(text);
                  setDialog(null);
                  notify(
                    ok
                      ? 'Document saved and downloaded.'
                      : 'Document downloaded; browser storage is unavailable.',
                  );
                }}
              >
                <label>
                  File name
                  <input
                    autoFocus
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    required
                  />
                </label>
                <p>A copy will be downloaded to your device.</p>
                <button className="xp-button" type="submit">
                  Save
                </button>
              </form>
            )}
            <button className="xp-button" onClick={() => setDialog(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
