import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Search,
  Grid2X2,
  FolderOpen,
  ArrowUpRight,
} from 'lucide-react';
import { useDesktop } from '../../lib/DesktopContext';
import { files, getFile, children, filePath } from '../../data/filesystem';
import { profile } from '../../data/profile';
import type { FileEntry, WindowData } from '../../types';
import Icon from '../Icon';
import MenuBar from '../MenuBar';
export default function Explorer({ window: w }: { window: WindowData }) {
  const { openFile, launch, updateWindow, notify } = useDesktop();
  const [history, setHistory] = useState([w.params.folder || 'computer']);
  const [index, setIndex] = useState(0);
  const folder = history[index];
  const [address, setAddress] = useState(filePath(folder));
  const [selected, setSelected] = useState('');
  const [list, setList] = useState(false);
  const [context, setContext] = useState<{ x: number; y: number; file: FileEntry } | null>(null);
  function navigate(id: string) {
    setHistory((h) => [...h.slice(0, index + 1), id]);
    setIndex(index + 1);
    setAddress(filePath(id));
    setSelected('');
    updateWindow(w.id, { title: getFile(id)?.name || 'My Computer' });
  }
  function travel(i: number) {
    setIndex(i);
    setAddress(filePath(history[i]));
    updateWindow(w.id, { title: getFile(history[i])?.name || 'My Computer' });
  }
  function activate(file: FileEntry) {
    if (file.kind === 'folder') navigate(file.id);
    else openFile(file);
    setContext(null);
  }
  const items = folder === 'computer' ? children('disk') : children(folder);
  const addressGo = () => {
    const v = address.toLowerCase().replace(/\\$/, '');
    const match = files.find(
      (f) =>
        f.kind === 'folder' &&
        (filePath(f.id).toLowerCase().replace(/\\$/, '') === v || f.name.toLowerCase() === v),
    );
    if (match) navigate(match.id);
    else notify(`The folder “${address}” could not be found.`);
  };
  return (
    <div className="explorer app-column" onClick={() => context && setContext(null)}>
      <MenuBar
        menus={[
          {
            label: 'File',
            items: [
              {
                label: 'Open',
                action: () => {
                  const f = getFile(selected);
                  if (f) activate(f);
                },
                disabled: !selected,
              },
              { label: 'New text document', action: () => launch('notepad') },
            ],
          },
          {
            label: 'Edit',
            items: [{ label: 'Select first item', action: () => setSelected(items[0]?.id || '') }],
          },
          {
            label: 'View',
            items: [
              { label: 'Icons', action: () => setList(false), checked: !list },
              { label: 'Details', action: () => setList(true), checked: list },
            ],
          },
          {
            label: 'Favorites',
            items: [
              { label: 'My Documents', action: () => navigate('documents') },
              { label: 'My Projects', action: () => navigate('projects') },
            ],
          },
          {
            label: 'Tools',
            items: [
              {
                label: 'Folder properties',
                action: () => notify(`${items.length} items in ${filePath(folder)}`),
              },
            ],
          },
          {
            label: 'Help',
            items: [{ label: 'How to explore', action: () => openFile(getFile('readme')!) }],
          },
        ]}
      />
      <div className="explorer-toolbar">
        <button onClick={() => travel(index - 1)} disabled={index === 0} className="back-tool">
          <span>
            <ArrowLeft size={19} />
          </span>
          Back
          <ChevronDown size={10} />
        </button>
        <button
          aria-label="Forward"
          onClick={() => travel(index + 1)}
          disabled={index === history.length - 1}
        >
          <span className="forward-tool">
            <ArrowRight size={19} />
          </span>
        </button>
        <button
          aria-label="Up one level"
          onClick={() => navigate(getFile(folder)?.parent || 'computer')}
          disabled={folder === 'computer'}
        >
          <FolderOpen color="#b7983b" size={25} />
          <ArrowUp className="up-overlay" size={12} />
        </button>
        <i />
        <button onClick={() => launch('search')}>
          <Search size={22} color="#4483b9" />
          <span>Search</span>
        </button>
        <button onClick={() => navigate('documents')}>
          <Icon name="folder" size={25} />
          <span>Folders</span>
        </button>
        <i />
        <button aria-label="Toggle file view" onClick={() => setList((v) => !v)}>
          <Grid2X2 size={21} color="#4876a6" />
          <ChevronDown size={10} />
        </button>
      </div>
      <form
        className="address-bar"
        onSubmit={(e) => {
          e.preventDefault();
          addressGo();
        }}
      >
        <label htmlFor={`address-${w.id}`}>Address</label>
        <div>
          <Icon name={getFile(folder)?.icon || 'computer'} size={18} />
          <input
            id={`address-${w.id}`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            spellCheck={false}
          />
          <ChevronDown size={14} />
        </div>
        <button type="submit">
          <ArrowRight size={17} /> Go
        </button>
      </form>
      <div className="explorer-layout">
        <aside className="explorer-sidebar">
          <div className="side-group">
            <h3>
              System Tasks
              <ChevronDown size={13} />
            </h3>
            <button onClick={() => launch('settings')}>
              <Icon name="settings" size={17} />
              View system information
            </button>
            <button onClick={() => navigate('projects')}>
              <Icon name="folder" size={17} />
              Explore my projects
            </button>
            <button onClick={() => openFile(getFile('cv')!)}>
              <Icon name="file" size={17} />
              View my résumé
            </button>
          </div>
          <div className="side-group">
            <h3>
              Other Places
              <ChevronDown size={13} />
            </h3>
            <button onClick={() => navigate('computer')}>
              <Icon name="computer" size={17} />
              My Computer
            </button>
            <button onClick={() => navigate('documents')}>
              <Icon name="documents" size={17} />
              My Documents
            </button>
            <button onClick={() => launch('browser', { page: 'contact' })}>
              <Icon name="mail" size={17} />
              Get in touch
            </button>
            <button onClick={() => navigate('recycle')}>
              <Icon name="recycle" size={17} />
              Recycle Bin
            </button>
          </div>
          <div className="sidebar-note">
            <span>✳</span>
            <p>
              Good things happen
              <br />
              when you explore.
            </p>
          </div>
          <div className="side-details">
            <b>{getFile(folder)?.name}</b>
            <p>
              {folder === 'computer' ? 'Your very own little adventure.' : 'File folder'}
              <br />
              {items.length} items
            </p>
          </div>
        </aside>
        <main className="explorer-main">
          {folder === 'computer' ? (
            <>
              <div className="welcome-hero">
                <div className="tiny-label">
                  <span /> HELLO, WORLD.
                </div>
                <h1>
                  A little curiosity.
                  <br />
                  <em>A lot of possibility.</em>
                </h1>
                <p>
                  I’m <strong>{profile.name}</strong> — {profile.role.toLowerCase()}. <br />
                  Welcome to my personal computer. Make yourself at home.
                </p>
                <div className="welcome-hero-bottom">
                  <span>Choose a folder. Follow your curiosity.</span>
                  <span className="hand-drawn-arrow">↴</span>
                </div>
                <div className="hero-stamp">
                  BUILT WITH
                  <br />
                  <b>CURIOSITY</b>
                  <span>✳</span>
                </div>
              </div>
              <h2 className="section-label">
                A FEW PLACES TO START <span>6 folders</span>
              </h2>
            </>
          ) : (
            <div className="folder-heading">
              <Icon name={getFile(folder)?.icon || 'folder'} size={42} />
              <div>
                <h1>{getFile(folder)?.name}</h1>
                <p>
                  {folder === 'recycle' ? 'Some things deserve a second look.' : filePath(folder)}
                </p>
              </div>
            </div>
          )}
          <div
            className={`file-grid ${list ? 'list-view' : ''} ${folder === 'computer' ? 'home-folders' : ''}`}
          >
            {items.map((file) => (
              <button
                key={file.id}
                className={`file-item ${selected === file.id ? 'file-selected' : ''}`}
                onClick={(e) => {
                  setSelected(file.id);
                  if (e.detail === 0 || matchMedia('(pointer: coarse)').matches) activate(file);
                }}
                onDoubleClick={() => activate(file)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    activate(file);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelected(file.id);
                  setContext({ x: e.clientX, y: e.clientY, file });
                }}
              >
                <Icon name={file.icon} size={42} />
                <span>
                  <b>{file.name}</b>
                  <small>
                    {file.id === 'documents'
                      ? 'Notes, thoughts & résumé'
                      : file.id === 'projects'
                        ? 'Things I’ve made'
                        : file.id === 'about'
                          ? 'The person behind the pixels'
                          : file.id === 'education'
                            ? 'A never-ending journey'
                            : file.id === 'experience'
                              ? 'Learning by doing'
                              : file.id === 'certifications'
                                ? 'Milestones along the way'
                                : file.kind === 'text'
                                  ? 'Text document'
                                  : file.kind === 'link'
                                    ? 'Internet shortcut'
                                    : file.kind === 'app'
                                      ? 'Application'
                                      : 'File folder'}
                  </small>
                </span>
                {folder === 'computer' && <ChevronRight size={14} />}
              </button>
            ))}
          </div>
          {folder === 'computer' && (
            <div className="explorer-footer-note">
              <span className="status-dot" /> Always learning. Always building.
              <button onClick={() => launch('browser', { page: 'contact' })}>
                Let’s connect <ArrowUpRight size={13} />
              </button>
            </div>
          )}
          {items.length === 0 && (
            <p className="empty-folder">This folder is waiting for its next chapter.</p>
          )}
        </main>
      </div>
      <footer className="status-bar">
        <span>
          {items.length} objects{selected ? ` · ${getFile(selected)?.name}` : ''}
        </span>
        <span>
          <Icon name="computer" size={15} /> My Computer
        </span>
      </footer>
      {context && (
        <div
          className="context-menu"
          style={{
            left: Math.min(context.x, innerWidth - 200),
            top: Math.min(context.y, innerHeight - 180),
          }}
        >
          <button onClick={() => activate(context.file)}>Open</button>
          <button
            onClick={() =>
              notify(
                `${context.file.name}\nType: ${context.file.kind}\nLocation: ${filePath(context.file.parent)}`,
              )
            }
          >
            Properties
          </button>
        </div>
      )}
    </div>
  );
}
