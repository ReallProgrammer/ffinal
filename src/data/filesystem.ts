import type { FileEntry } from '../types';
import { profile } from './profile';
export const welcomeNote = `A note for the curious\n──────────────────────\n\nWelcome to my little corner of the internet.\n\nDouble-click a folder. Open a window.\nPoke around. You might find something unexpected.\n\nThis computer is yours to explore.\n\nP.S. Try “help” in Command Prompt.\n\n— ${profile.name}`;
export const files: FileEntry[] = [
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
export const getFile = (id: string) => files.find((f) => f.id === id);
export const children = (id: string) => files.filter((f) => f.parent === id);
export function filePath(id: string): string {
  const f = getFile(id);
  if (!f || id === 'computer') return 'My Computer';
  if (id === 'recycle') return 'Recycle Bin';
  if (id === 'disk') return 'C:\\';
  return filePath(f.parent).replace(/\\$/, '') + '\\' + f.name;
}
