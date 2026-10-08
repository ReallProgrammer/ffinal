import { useEffect, useState } from 'react';
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
import {
  files,
  getFile,
  children,
  filePath,
  useFiles,
  renameFile,
  removeFiles,
  restoreFile,
  clipboardFiles,
  pasteFiles,
  createFile,
  moveFiles,
  FILE_DRAG_TYPE,
} from '../../data/filesystem';
import { profile } from '../../data/profile';
import type { FileEntry, WindowData } from '../../types';
import Icon from '../Icon';
import MenuBar from '../MenuBar';
import ContextMenu from '../ContextMenu';
export default function Explorer({ window: w, active }: { window: WindowData; active: boolean }) {
  useFiles();
  const { openFile, launch, updateWindow, notify } = useDesktop();
  const [history, setHistory] = useState([w.params.folder || 'computer']);
  const [index, setIndex] = useState(0);
  const folder = history[index];
  const [address, setAddress] = useState(filePath(folder));
  const [selected, setSelected] = useState('');
  const [list, setList] = useState(false);
  const [context, setContext] = useState<{ x: number; y: number; file: FileEntry } | null>(null);
  const [rename, setRename] = useState<{ id: string; name: string } | null>(null);
  const [dropFolder, setDropFolder] = useState('');
  const attempt = (action: () => void) => {
    try {
      action();
    } catch (error) {
      notify((error as Error).message);
    }
  };
  const newEntry = (kind: 'folder' | 'text') => {
    const parent = folder === 'computer' ? 'disk' : folder;
    const base = kind === 'folder' ? 'New Folder' : 'New Document.txt';
    let name = base,
      n = 2;
    while (children(parent).some((f) => f.name === name)) name = `${base} (${n++})`;
    attempt(() => {
      const f = createFile(parent, name, kind);
      setSelected(f.id);
      setRename({ id: f.id, name: f.name });
    });
  };
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,textarea,select')) return;
      const f = getFile(selected);
      if (e.key === 'Escape') {
        setContext(null);
        setRename(null);
      }
      if (e.key === 'F2' && f) {
        e.preventDefault();
        setRename({ id: f.id, name: f.name });
      }
      if (e.key === 'Delete' && f) {
        e.preventDefault();
        attempt(() => removeFiles([f.id]));
      }
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (['c', 'x'].includes(k) && f) {
          e.preventDefault();
          clipboardFiles([f.id], k === 'x');
          notify(k === 'x' ? 'Ready to move. Choose a folder and paste.' : 'File copied.');
        }
        if (k === 'v') {
          e.preventDefault();
          attempt(() => pasteFiles(folder === 'computer' ? 'disk' : folder));
        }
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [active, selected, folder]);
  const dropFiles = (e: React.DragEvent, parent: string) => {
    const data = e.dataTransfer.getData(FILE_DRAG_TYPE);
    if (!data) return;
    e.preventDefault();
    e.stopPropagation();
    attempt(() => moveFiles(JSON.parse(data), parent));
    setDropFolder('');
  };
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
              { label: 'New text document', action: () => newEntry('text') },
              { label: 'New folder', action: () => newEntry('folder') },
            ],
          },
          {
            label: 'Edit',
            items: [
              { label: 'Copy', disabled: !selected, action: () => clipboardFiles([selected]) },
              { label: 'Cut', disabled: !selected, action: () => clipboardFiles([selected], true) },
              {
                label: 'Paste',
                action: () => attempt(() => pasteFiles(folder === 'computer' ? 'disk' : folder)),
              },
              {
                label: 'Delete',
                disabled: !selected,
                action: () => attempt(() => removeFiles([selected])),
              },
            ],
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
            <button onClick={() => launch('shelf')}>
              <Icon name="certificate" size={17} />
              My Shelf
            </button>
            <button onClick={() => launch('games')}>
              <Icon name="game" size={17} />
              Games
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
        <main
          className={`explorer-main ${dropFolder === folder ? 'file-drop-active' : ''}`}
          data-folder-drop={folder === 'computer' ? 'disk' : folder}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(FILE_DRAG_TYPE)) {
              e.preventDefault();
              setDropFolder(folder);
            }
          }}
          onDragLeave={() => setDropFolder('')}
          onDrop={(e) => dropFiles(e, folder === 'computer' ? 'disk' : folder)}
        >
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
                draggable
                data-file-id={file.id}
                data-folder-drop={file.kind === 'folder' ? file.id : undefined}
                onDragStart={(e) => {
                  setSelected(file.id);
                  e.dataTransfer.setData(FILE_DRAG_TYPE, JSON.stringify([file.id]));
                  e.dataTransfer.effectAllowed = 'move';
                  e.currentTarget.classList.add('file-dragging');
                }}
                onDragEnd={(e) => {
                  e.currentTarget.classList.remove('file-dragging');
                  setDropFolder('');
                }}
                onDragOver={(e) => {
                  if (file.kind === 'folder' && e.dataTransfer.types.includes(FILE_DRAG_TYPE)) {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropFolder(file.id);
                  }
                }}
                onDrop={(e) => {
                  if (file.kind === 'folder') dropFiles(e, file.id);
                }}
                className={`file-item ${selected === file.id ? 'file-selected' : ''} ${dropFolder === file.id ? 'file-drop-active' : ''}`}
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
        <ContextMenu
          x={context.x}
          y={context.y}
          onClose={() => setContext(null)}
          items={[
            { label: 'Open', action: () => activate(context.file) },
            ...(context.file.kind === 'text'
              ? [
                  {
                    label: 'Open With',
                    children: [{ label: 'Notepad', action: () => openFile(context.file) }],
                  },
                ]
              : []),
            {
              label: 'Rename',
              action: () => setRename({ id: context.file.id, name: context.file.name }),
            },
            { label: 'Copy', action: () => clipboardFiles([context.file.id]) },
            { label: 'Cut', action: () => clipboardFiles([context.file.id], true) },
            ...(folder === 'recycle'
              ? [{ label: 'Restore', action: () => attempt(() => restoreFile(context.file.id)) }]
              : []),
            {
              label: folder === 'recycle' ? 'Delete permanently' : 'Delete',
              action: () => {
                if (folder === 'recycle' && !window.confirm('Permanently delete this item?'))
                  return;
                attempt(() => removeFiles([context.file.id], folder === 'recycle'));
              },
            },
            {
              label: 'Properties',
              action: () =>
                notify(
                  `${context.file.name}\nType: ${context.file.kind}\nLocation: ${filePath(context.file.parent)}`,
                ),
            },
          ]}
        />
      )}
      {rename && (
        <div className="app-modal-backdrop">
          <form
            className="app-modal"
            onSubmit={(e) => {
              e.preventDefault();
              attempt(() => {
                renameFile(rename.id, rename.name);
                setRename(null);
              });
            }}
          >
            <h3>Rename item</h3>
            <label>
              File name
              <input
                aria-label="File name"
                autoFocus
                value={rename.name}
                onChange={(e) => setRename({ ...rename, name: e.target.value })}
              />
            </label>
            <button className="xp-button">OK</button>
            <button type="button" className="xp-button" onClick={() => setRename(null)}>
              Cancel
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
