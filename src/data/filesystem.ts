import { useSyncExternalStore } from 'react';
import { readStorage, writeStorage } from '../lib/storage';
import type { FileEntry } from '../types';
import { profile } from './profile';
export const welcomeNote = `A note for the curious\n──────────────────────\n\nWelcome to my little corner of the internet.\n\nDouble-click a folder. Open a window.\nPoke around. You might find something unexpected.\n\nThis computer is yours to explore.\n\nP.S. Try “help” in Command Prompt.\n\n— ${profile.name}`;
const initialFiles: FileEntry[] = [
  { id: 'desktop', name: 'Desktop', icon: 'computer', kind: 'folder', parent: '' },
  { id: 'computer', name: 'My Computer', icon: 'computer', kind: 'folder', parent: '' },
  { id: 'disk', name: 'Local Disk (C:)', icon: 'drive', kind: 'folder', parent: 'computer' },
  { id: 'documents', name: 'My Documents', icon: 'documents', kind: 'folder', parent: 'disk' },
  { id: 'projects', name: 'My Projects', icon: 'folder', kind: 'folder', parent: 'disk' },
  { id: 'about', name: 'About Me', icon: 'user', kind: 'folder', parent: 'disk' },
  { id: 'education', name: 'Education', icon: 'folder', kind: 'folder', parent: 'disk' },
  { id: 'experience', name: 'Experience', icon: 'folder', kind: 'folder', parent: 'disk' },
  {
    id: 'certifications',
    name: 'Certifications',
    icon: 'certificate',
    kind: 'folder',
    parent: 'disk',
  },
  { id: 'recycle', name: 'Recycle Bin', icon: 'recycle', kind: 'folder', parent: '' },
  {
    id: 'readme',
    name: 'READ ME.txt',
    icon: 'notepad',
    kind: 'text',
    parent: 'documents',
    content: welcomeNote,
  },
  {
    id: 'cv',
    name: 'CV.txt',
    icon: 'file',
    kind: 'text',
    parent: 'documents',
    content: `${profile.name}\n${profile.role}\n\nABOUT\n${profile.about}\n\nSKILLS\n${profile.skills.join(' · ')}\n\nEDUCATION\n${profile.education}\n\nEXPERIENCE\n${profile.experience}\n\nCERTIFICATIONS\n${profile.certifications}\n\nCONTACT\n${profile.github}\n\n${profile.note}`,
  },
  {
    id: 'contact',
    name: 'Contact.txt',
    icon: 'mail',
    kind: 'text',
    parent: 'documents',
    content: `Let's make a connection.\n\nGitHub: ${profile.github}\n${profile.email ? 'Email: ' + profile.email : 'Email: not added yet'}\n${profile.linkedin ? 'LinkedIn: ' + profile.linkedin : 'LinkedIn: not added yet'}\n\nYou can find my projects on GitHub.`,
  },
  {
    id: 'bio',
    name: 'About Me.txt',
    icon: 'notepad',
    kind: 'text',
    parent: 'about',
    content: `${profile.about}\n\n${profile.note}`,
  },
  {
    id: 'skills',
    name: 'Skills.txt',
    icon: 'file',
    kind: 'text',
    parent: 'about',
    content: `MY TOOLBOX\n\n${profile.skills.map((s) => '  + ' + s).join('\n')}\n\nAlways learning. Always experimenting.`,
  },
  {
    id: 'university',
    name: 'Education.txt',
    icon: 'file',
    kind: 'text',
    parent: 'education',
    content: profile.education,
  },
  {
    id: 'work',
    name: 'Experience.txt',
    icon: 'file',
    kind: 'text',
    parent: 'experience',
    content: profile.experience,
  },
  {
    id: 'certs',
    name: 'Certifications.txt',
    icon: 'file',
    kind: 'text',
    parent: 'certifications',
    content: profile.certifications,
  },
  {
    id: 'portfolio',
    name: 'Personal Computer.url',
    icon: 'globe',
    kind: 'link',
    parent: 'projects',
    target: 'portfolio://projects',
  },
  {
    id: 'github',
    name: 'GitHub.url',
    icon: 'globe',
    kind: 'link',
    parent: 'projects',
    target: profile.github,
  },
  {
    id: 'regrets',
    name: 'old-regrets.txt',
    icon: 'file',
    kind: 'text',
    parent: 'recycle',
    content:
      'File not found.\n\nJust kidding. I recycled those.\n\nHere’s to making new mistakes and learning better things.',
  },
  { id: 'oops', name: 'oops.exe', icon: 'computer', kind: 'app', parent: 'recycle', app: 'dialog' },
  {
    id: 'developer-note',
    name: 'a-note-from-the-developer.txt',
    icon: 'notepad',
    kind: 'text',
    parent: 'recycle',
    content:
      'You found me.\n\nThis computer is a love letter to the days when every folder felt like an adventure.\n\nThanks for looking a little closer. Stay curious.',
  },
  {
    id: 'ideas',
    name: 'definitely-not-a-game.exe',
    icon: 'game',
    kind: 'app',
    parent: 'recycle',
    app: 'game',
  },
];
const savedFiles = readStorage<FileEntry[] | null>('pc-files-v2', null);
export let files: FileEntry[] =
  Array.isArray(savedFiles) && savedFiles.some((f) => f.id === 'disk') ? savedFiles : initialFiles;
const listeners = new Set<() => void>();
export function useFiles() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => files,
  );
}
function commit(next: FileEntry[]) {
  if (!writeStorage('pc-files-v2', next))
    throw new Error(
      'Browser storage is full or unavailable. Download your notes before making more changes.',
    );
  files = next;
  listeners.forEach((fn) => fn());
}
export const getFile = (id: string) => files.find((f) => f.id === id);
export const children = (id: string) => files.filter((f) => f.parent === id);
export function filePath(id: string): string {
  const f = getFile(id);
  if (!f || id === 'computer') return 'My Computer';
  if (id === 'recycle') return 'Recycle Bin';
  if (id === 'disk') return 'C:\\';
  return filePath(f.parent).replace(/\\$/, '') + '\\' + f.name;
}

const protectedIds = new Set(['computer', 'disk', 'recycle', 'desktop']);
function safeName(name: string) {
  const clean = name.trim();
  if (!clean || /[\\/:*?"<>|]/.test(clean))
    throw new Error('Use a name without \\ / : * ? " < > |.');
  return clean.slice(0, 120);
}
function uniqueName(name: string, parent: string, except?: string) {
  if (
    files.some(
      (f) => f.parent === parent && f.id !== except && f.name.toLowerCase() === name.toLowerCase(),
    )
  )
    throw new Error('An item with that name already exists here.');
}
export function renameFile(id: string, name: string) {
  const f = getFile(id);
  if (!f || protectedIds.has(id)) throw new Error('This system location cannot be renamed.');
  const n = safeName(name);
  uniqueName(n, f.parent, id);
  commit(files.map((v) => (v.id === id ? { ...v, name: n } : v)));
}
export function isDescendant(id: string, ancestor: string): boolean {
  let current = getFile(id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    if (current.id === ancestor) return true;
    seen.add(current.id);
    current = getFile(current.parent);
  }
  return false;
}
export function moveFiles(ids: string[], parent: string) {
  if (getFile(parent)?.kind !== 'folder') throw new Error('Choose a folder.');
  const roots = ids.filter((id) => !ids.some((other) => other !== id && isDescendant(id, other)));
  for (const id of roots) {
    const f = getFile(id);
    if (!f || protectedIds.has(id)) throw new Error('System locations cannot be moved.');
    if (isDescendant(parent, id)) throw new Error('A folder cannot be moved inside itself.');
    if (parent !== 'recycle') uniqueName(f.name, parent, id);
  }
  commit(
    files.map((f) =>
      roots.includes(f.id)
        ? { ...f, parent, originalParent: parent === 'recycle' ? f.parent : undefined }
        : f,
    ),
  );
}
export function restoreFile(id: string) {
  const f = getFile(id);
  if (!f) return;
  moveFiles(
    [id],
    getFile(f.originalParent || '')?.kind === 'folder' ? f.originalParent! : 'documents',
  );
}
export function removeFiles(ids: string[], permanent = false) {
  if (ids.some((id) => protectedIds.has(id)))
    throw new Error('System locations cannot be deleted.');
  if (permanent) commit(files.filter((f) => !ids.some((id) => isDescendant(f.id, id))));
  else moveFiles(ids, 'recycle');
}
export function copyFiles(ids: string[], parent: string) {
  if (getFile(parent)?.kind !== 'folder') throw new Error('Choose a destination folder.');
  const additions: FileEntry[] = [];
  function clone(id: string, target: string, root = false) {
    const f = getFile(id);
    if (!f) return;
    let name = f.name;
    if (root) {
      let n = 1;
      while ([...files, ...additions].some((v) => v.parent === target && v.name === name))
        name = `${f.name} - Copy${n++ === 1 ? '' : ` (${n - 1})`}`;
    }
    const next = { ...f, id: crypto.randomUUID(), parent: target, name, originalParent: undefined };
    additions.push(next);
    children(id).forEach((child) => clone(child.id, next.id));
  }
  ids
    .filter((id) => !ids.some((other) => other !== id && isDescendant(id, other)))
    .forEach((id) => {
      if (protectedIds.has(id)) throw new Error('System locations cannot be copied.');
      clone(id, parent, true);
    });
  commit([...files, ...additions]);
}
export function createFile(parent: string, name: string, kind: 'folder' | 'text', content = '') {
  const n = safeName(name);
  uniqueName(n, parent);
  const file: FileEntry = {
    id: crypto.randomUUID(),
    parent,
    name: n,
    kind,
    icon: kind === 'folder' ? 'folder' : 'notepad',
    content,
  };
  commit([...files, file]);
  return file;
}
export function updateFileText(id: string, content: string) {
  if (content.length > 150000)
    throw new Error(
      'This text is too large for the virtual notepad. Save a downloaded copy instead.',
    );
  commit(files.map((f) => (f.id === id ? { ...f, content } : f)));
}
export function resetFileLayout() {
  commit(initialFiles.map((f) => ({ ...f })));
}
export let fileClipboard: { ids: string[]; cut: boolean } | null = null;
export function clipboardFiles(ids: string[], cut = false) {
  fileClipboard = { ids: [...ids], cut };
}
export function pasteFiles(parent: string) {
  if (!fileClipboard) throw new Error('Copy or cut a file first.');
  if (fileClipboard.cut) {
    moveFiles(fileClipboard.ids, parent);
    fileClipboard = null;
  } else copyFiles(fileClipboard.ids, parent);
}
export const FILE_DRAG_TYPE = 'application/x-personal-computer-files';

export function addFileEntry(entry: FileEntry) {
  if (files.some((f) => f.id === entry.id)) throw new Error('An item with that ID already exists.');
  commit([...files, entry]);
}
