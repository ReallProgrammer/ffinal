import { useState } from 'react';
import { useDesktop } from '../../lib/DesktopContext';
import Icon from '../Icon';
export default function TaskManager() {
  const { windows, close, focusWindow } = useDesktop();
  const [selected, setSelected] = useState('');
  const apps = windows.filter((w) => w.app !== 'taskmanager');
  return (
    <div className="task-manager app-column">
      <div className="task-manager-tabs">
        <b>Applications</b>
        <span>Local session</span>
      </div>
      <div className="task-manager-list">
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((w) => (
              <tr
                key={w.id}
                className={selected === w.id ? 'selected' : ''}
                onClick={() => setSelected(w.id)}
                onDoubleClick={() => focusWindow(w.id)}
              >
                <td>
                  <button onClick={() => setSelected(w.id)}>
                    <Icon name={w.icon} size={21} />
                    {w.title}
                  </button>
                </td>
                <td>{w.minimized ? 'Minimized' : 'Running'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!apps.length && <p>No other applications are running.</p>}
      </div>
      <div className="task-manager-actions">
        <button
          className="xp-button"
          disabled={!apps.some((w) => w.id === selected)}
          onClick={() => focusWindow(selected)}
        >
          Switch To
        </button>
        <button
          className="xp-button"
          disabled={!apps.some((w) => w.id === selected)}
          onClick={() => {
            close(selected);
            setSelected('');
          }}
        >
          End Task
        </button>
      </div>
      <footer className="status-bar">
        <span>{apps.length} applications</span>
        <span>Simulated OS processes</span>
      </footer>
    </div>
  );
}
export function HelpCenter() {
  return (
    <div className="help-center">
      <Icon name="computer" size={48} />
      <h1>A familiar computer.</h1>
      <p>
        Click to select. Double-click to open. Drag a window by its title bar. Right-click to see
        what an object can do.
      </p>
      <dl>
        <dt>Alt + Tab</dt>
        <dd>Switch between open windows</dd>
        <dt>Alt + F4</dt>
        <dd>Close the focused window</dd>
        <dt>Ctrl + Shift + Esc</dt>
        <dd>Task Manager</dd>
        <dt>Ctrl + Esc</dt>
        <dd>Start menu</dd>
        <dt>F2</dt>
        <dd>Rename a selected icon or file</dd>
        <dt>F5</dt>
        <dd>Refresh the current view</dd>
        <dt>Ctrl + C / X / V</dt>
        <dd>Copy, cut, and paste selected files</dd>
        <dt>Ctrl + S</dt>
        <dd>Save in Notepad</dd>
      </dl>
      <p>
        Some keys are reserved by your real operating system. These shortcuts work when the browser
        delivers them to this computer.
      </p>
      <p>
        The Shelf keeps uploaded files in this browser. Games, documents, and settings are all in
        the Start menu.
      </p>
    </div>
  );
}
