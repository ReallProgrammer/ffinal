import { type LinuxTree, LinuxFilesystem } from './linux';
import { readStorage } from './storage';
export const ENTRY_FLAG = 'FLAG{follow_the_trail}';
export const challengeHint =
  'To enter the UI experience, catch the flag first. Hint: start with ls and cat README.txt. Hidden directories begin with a dot.';
export function challengeTree(): LinuxTree {
  const tree: LinuxTree = {};
  for (const path of [
    '/',
    '/home',
    '/home/guest',
    '/home/guest/training',
    '/home/guest/training/archive',
    '/home/guest/training/archive/.cache',
    '/tmp',
  ])
    tree[path] = { type: 'dir', text: '', modified: Date.now() };
  for (const [path, text] of Object.entries({
    '/home/guest/README.txt':
      'Welcome to the boot challenge.\nChange into training with cd training, then list its files with ls.\nRead briefing.txt with cat.\n',
    '/home/guest/training/briefing.txt':
      'The flag was archived.\nEnter archive, then use ls -a to reveal hidden directories.\nRead ctf.txt when you find it. Submit its contents with -flag FLAG{...}.\n',
    '/home/guest/training/archive/.cache/ctf.txt': ENTRY_FLAG + '\n',
  }))
    tree[path] = { type: 'file', text, modified: Date.now() };
  return tree;
}
export function challengeFilesystem(reset = false) {
  const tree = reset ? challengeTree() : readStorage('pc-ctf-fs-v1', challengeTree());
  return new LinuxFilesystem(tree, 'pc-ctf-fs-v1');
}
export function flagCaptured() {
  try {
    return sessionStorage.getItem('pc-terminal-flag') === 'captured';
  } catch {
    return false;
  }
}
