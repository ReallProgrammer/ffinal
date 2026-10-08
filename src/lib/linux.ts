import { getFile } from '../data/filesystem';
import { profile } from '../data/profile';
import { readStorage, writeStorage } from './storage';
export interface LinuxNode {
  type: 'dir' | 'file';
  text: string;
  modified: number;
}
export type LinuxTree = Record<string, LinuxNode>;
const HOME_DIR = '/home/guest';
const file = (text = ''): LinuxNode => ({ type: 'file', text, modified: Date.now() });
const dir = (): LinuxNode => ({ type: 'dir', text: '', modified: Date.now() });
export function initialLinuxTree(): LinuxTree {
  return {
    '/': dir(),
    '/home': dir(),
    [HOME_DIR]: dir(),
    [HOME_DIR + '/README.txt']: file(
      'Welcome to Portfolio Linux.\nThis is a local simulated computer. Your experiments stay in this browser.\nTry help, man, ls, cat CV.txt, or a small game.\nUse reboot or exit to return to the graphical desktop.\n',
    ),
    [HOME_DIR + '/CV.txt']: file(getFile('cv')?.content || profile.about),
    [HOME_DIR + '/projects']: dir(),
    [HOME_DIR + '/projects/README.txt']: file(
      profile.projects.map((p) => p.name + '\n' + p.description + '\n' + p.url).join('\n\n'),
    ),
    [HOME_DIR + '/certificates']: dir(),
    [HOME_DIR + '/certificates/README.txt']: file(profile.certifications),
    [HOME_DIR + '/shelf']: dir(),
    '/etc': dir(),
    '/etc/os-release': file('NAME="Portfolio Linux"\nVERSION="2.0 (Curiosity)"\nID=portfolio\n'),
    '/etc/hostname': file('portfolio\n'),
    '/usr': dir(),
    '/usr/bin': dir(),
    '/var': dir(),
    '/var/log': dir(),
    '/var/log/boot.log': file(
      'POST completed.\nMounted local virtual filesystem.\nStarted guest session.\n',
    ),
    '/tmp': dir(),
  };
}
export function normalizePath(input: string, cwd = HOME_DIR) {
  const path =
    input === '~'
      ? HOME_DIR
      : input.startsWith('~/')
        ? HOME_DIR + input.slice(1)
        : input.startsWith('/')
          ? input
          : cwd + '/' + input;
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return '/' + parts.join('/');
}
export const parentPath = (p: string) => p.slice(0, p.lastIndexOf('/')) || '/';
export const basename = (p: string) => p.split('/').pop() || '/';
export function listLinux(tree: LinuxTree, path: string) {
  return Object.keys(tree)
    .filter((p) => p !== path && parentPath(p) === path)
    .sort();
}
export function tokenizeShell(input: string): string[] {
  const tokens: string[] = [];
  let token = '',
    quote = '',
    started = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '\\' && quote !== "'") {
      if (i + 1 < input.length) {
        token += input[++i];
        started = true;
      }
      continue;
    }
    if (quote) {
      if (c === quote) quote = '';
      else token += c;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      started = true;
      continue;
    }
    if (/\s/.test(c)) {
      if (started) {
        tokens.push(token);
        token = '';
        started = false;
      }
      continue;
    }
    if (c === '>' || c === '|') {
      if (started) {
        tokens.push(token);
        token = '';
        started = false;
      }
      if (c === '>' && input[i + 1] === '>') {
        tokens.push('>>');
        i++;
      } else tokens.push(c);
      continue;
    }
    token += c;
    started = true;
  }
  if (quote) throw new Error('Unclosed quote. Close the quote and try again.');
  if (started) tokens.push(token);
  return tokens;
}
export class LinuxFilesystem {
  tree: LinuxTree;
  constructor(tree?: LinuxTree) {
    const saved = tree || readStorage<LinuxTree | null>('pc-linux-fs-v2', null);
    this.tree = saved && saved['/home/guest']?.type === 'dir' ? saved : initialLinuxTree();
  }
  private save(next: LinuxTree) {
    if (JSON.stringify(next).length > 2000000)
      throw new Error('Virtual disk quota exceeded (2 MB of text).');
    if (!writeStorage('pc-linux-fs-v2', next))
      throw new Error('Unable to persist this change. Browser storage may be full.');
    this.tree = next;
  }
  writable(path: string) {
    if (
      !(path.startsWith(HOME_DIR + '/') || path.startsWith('/tmp/')) ||
      path.startsWith(HOME_DIR + '/shelf/')
    )
      throw new Error(`${path}: Permission denied`);
  }
  write(path: string, text: string, append = false) {
    this.writable(path);
    if (this.tree[parentPath(path)]?.type !== 'dir') throw new Error(`${path}: No such directory`);
    if (this.tree[path]?.type === 'dir') throw new Error(`${path}: Is a directory`);
    this.save({ ...this.tree, [path]: file((append ? this.tree[path]?.text || '' : '') + text) });
  }
  mkdir(path: string, recursive = false) {
    this.writable(path);
    if (this.tree[path]) {
      if (recursive && this.tree[path].type === 'dir') return;
      throw new Error(`${path}: File exists`);
    }
    if (!this.tree[parentPath(path)]) {
      if (recursive) this.mkdir(parentPath(path), true);
      else throw new Error(`${path}: No such directory`);
    }
    if (this.tree[parentPath(path)].type !== 'dir') throw new Error('Parent is not a directory');
    this.save({ ...this.tree, [path]: dir() });
  }
  remove(path: string, recursive = false) {
    this.writable(path);
    if (!this.tree[path]) throw new Error(`${path}: No such file or directory`);
    if (this.tree[path].type === 'dir' && !recursive)
      throw new Error(`${path}: Is a directory (use rm -r)`);
    const next = { ...this.tree };
    for (const key of Object.keys(next))
      if (key === path || key.startsWith(path + '/')) delete next[key];
    this.save(next);
  }
  transfer(source: string, dest: string, move = false, recursive = false) {
    if (!this.tree[source]) throw new Error(`${source}: No such file or directory`);
    if (this.tree[dest]?.type === 'dir') dest += '/' + basename(source);
    this.writable(dest);
    if (move) this.writable(source);
    if (dest === source || dest.startsWith(source + '/'))
      throw new Error('Cannot copy or move a directory into itself');
    if (this.tree[source].type === 'dir' && !move && !recursive)
      throw new Error('Source is a directory (use cp -r)');
    if (this.tree[parentPath(dest)]?.type !== 'dir')
      throw new Error('Destination directory does not exist');
    if (this.tree[dest]?.type === 'dir')
      throw new Error('Destination already contains a directory of that name');
    const next = { ...this.tree };
    for (const key of Object.keys(this.tree))
      if (key === source || key.startsWith(source + '/')) {
        next[dest + key.slice(source.length)] = { ...this.tree[key], modified: Date.now() };
        if (move) delete next[key];
      }
    this.save(next);
  }
  clearTemporary() {
    const next = { ...this.tree };
    Object.keys(next)
      .filter((p) => p.startsWith('/tmp/'))
      .forEach((p) => delete next[p]);
    this.save(next);
  }
  mountShelf(items: { filename: string; description: string; type: string; size: number }[]) {
    const next = { ...this.tree };
    Object.keys(next)
      .filter((p) => p.startsWith(HOME_DIR + '/shelf/'))
      .forEach((p) => delete next[p]);
    for (const item of items) {
      let name = item.filename.replaceAll('/', '_');
      let n = 1;
      while (next[HOME_DIR + '/shelf/' + name]) name = `${n++}-${item.filename}`;
      next[HOME_DIR + '/shelf/' + name] = file(
        `${item.filename}\n${item.type} · ${item.size} bytes\n${item.description}\n\nOpen Shelf in the graphical desktop to view or download this object.\n`,
      );
    }
    this.tree = next;
  }
}
export interface ShellResult {
  output: string;
  cwd: string;
  action?: 'clear' | 'reboot' | 'shutdown' | 'snake' | 'matrix';
}
const docs: Record<string, string> = {
  ls: 'ls [-a] [-l] [path] — list files',
  cd: 'cd [directory] — change directory; no argument returns home',
  pwd: 'pwd — show the current directory',
  cat: 'cat FILE... — print file contents',
  mkdir: 'mkdir [-p] DIRECTORY... — create directories',
  touch: 'touch FILE... — create empty files or update their timestamps',
  rm: 'rm [-r] FILE... — remove local files; -r removes directories',
  cp: 'cp [-r] SOURCE DEST — copy a file or directory',
  mv: 'mv SOURCE DEST — move or rename a file or directory',
  find: 'find [path] [-name pattern] — search paths; * and ? are supported',
  grep: 'grep [-i] [-n] PATTERN [FILE...] — find matching lines (literal text)',
  head: 'head [-n count] [FILE] — first lines of a file or piped text',
  tail: 'tail [-n count] [FILE] — last lines of a file or piped text',
  echo: 'echo TEXT — print text; > FILE writes and >> FILE appends',
  history: 'history — show commands from this terminal session',
  man: 'man COMMAND — read a command reference',
  reboot: 'reboot — restart through POST into the normal graphical OS',
  snake: 'snake — launch the terminal arcade; Q returns to the shell',
  clear: 'clear — clear the terminal scrollback',
  exit: 'exit — restart into the normal graphical OS',
};
export const linuxCommands = [
  ...Object.keys(docs),
  'help',
  'whoami',
  'uname',
  'date',
  'time',
  'tree',
  'env',
  'ps',
  'top',
  'df',
  'free',
  'uptime',
  'hostname',
  'id',
  'neofetch',
  'sudo',
  'shutdown',
  'fortune',
  'matrix',
  'cowsay',
  'coffee',
  'sl',
  'about',
  'skills',
  'projects',
  'contact',
  'easteregg',
  'hack',
];
function glob(pattern: string) {
  return new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replaceAll('*', '.*')
        .replaceAll('?', '.') +
      '$',
  );
}
export function runShell(
  line: string,
  fs: LinuxFilesystem,
  cwd: string,
  history: string[],
  uptime: number,
): ShellResult {
  let current = cwd;
  try {
    const tokens = tokenizeShell(line);
    if (!tokens.length) return { output: '', cwd };
    let redirect = '',
      append = false;
    const red = tokens.findIndex((t) => t === '>' || t === '>>');
    if (red >= 0) {
      if (red !== tokens.length - 2) throw new Error('Usage: command > file');
      redirect = tokens[red + 1];
      append = tokens[red] === '>>';
      tokens.splice(red);
    }
    const stages: string[][] = [[]];
    tokens.forEach((t) => (t === '|' ? stages.push([]) : stages[stages.length - 1].push(t)));
    if (stages.some((s) => s.length === 0)) throw new Error('Missing command in pipeline');
    let output = '',
      action: ShellResult['action'];
    for (const stage of stages) {
      const [cmd, ...args] = stage;
      const options = args.filter((a) => a.startsWith('-'));
      const paths = args.filter((a) => !a.startsWith('-'));
      const resolve = (p: string) => normalizePath(p, current);
      const read = (p: string) => {
        const node = fs.tree[resolve(p)];
        if (!node) throw new Error(`${p}: No such file or directory`);
        if (node.type === 'dir') throw new Error(`${p}: Is a directory`);
        return node.text;
      };
      const input = output;
      switch (cmd) {
        case 'help':
          output =
            'Portfolio Linux — a local simulated shell\n\n' +
            linuxCommands.join('  ') +
            '\n\nUse man COMMAND for details. Pipes | and text redirection > / >> work.\nFiles under /home/guest and /tmp are writable. No real shell commands run.\nUse reboot or exit to return to the graphical desktop.';
          break;
        case 'man':
          output =
            docs[args[0]] ||
            (linuxCommands.includes(args[0])
              ? `${args[0]} — a built-in Portfolio Linux command. Try ${args[0]}.`
              : `No manual entry for ${args[0] || '(missing command)'}`);
          break;
        case 'pwd':
          output = current;
          break;
        case 'cd': {
          const target = resolve(args[0] || '~');
          if (fs.tree[target]?.type !== 'dir') throw new Error(`${args[0]}: No such directory`);
          current = target;
          output = '';
          break;
        }
        case 'ls': {
          const target = resolve(paths[0] || '.');
          if (!fs.tree[target]) throw new Error('No such file or directory');
          const entries = fs.tree[target].type === 'dir' ? listLinux(fs.tree, target) : [target];
          output = entries
            .filter((p) => options.some((o) => o.includes('a')) || !basename(p).startsWith('.'))
            .map((p) =>
              options.some((o) => o.includes('l'))
                ? `${fs.tree[p].type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--'} guest guest ${String(fs.tree[p].text.length).padStart(5)} ${basename(p)}${fs.tree[p].type === 'dir' ? '/' : ''}`
                : basename(p) + (fs.tree[p].type === 'dir' ? '/' : ''),
            )
            .join(options.some((o) => o.includes('l')) ? '\n' : '  ');
          break;
        }
        case 'cat':
          output = paths.length ? paths.map(read).join('\n') : input;
          break;
        case 'clear':
          action = 'clear';
          output = '';
          break;
        case 'echo':
          output = args.join(' ');
          break;
        case 'mkdir':
          if (!paths.length) throw new Error('mkdir: missing directory');
          paths.forEach((p) => fs.mkdir(resolve(p), options.includes('-p')));
          output = '';
          break;
        case 'touch':
          if (!paths.length) throw new Error('touch: missing file');
          paths.forEach((p) => fs.write(resolve(p), fs.tree[resolve(p)]?.text || ''));
          output = '';
          break;
        case 'rm':
          if (!paths.length) throw new Error('rm: missing file');
          paths.forEach((p) =>
            fs.remove(
              resolve(p),
              options.some((o) => o.includes('r')),
            ),
          );
          if (!fs.tree[current]) current = HOME_DIR;
          output = '';
          break;
        case 'cp':
        case 'mv':
          if (paths.length !== 2) throw new Error(`${cmd}: specify SOURCE and DEST`);
          fs.transfer(
            resolve(paths[0]),
            resolve(paths[1]),
            cmd === 'mv',
            options.some((o) => o.includes('r')),
          );
          output = '';
          break;
        case 'find': {
          const target = resolve(args[0] && !args[0].startsWith('-') ? args[0] : '.');
          if (!fs.tree[target]) throw new Error('find: starting path does not exist');
          const ni = args.indexOf('-name');
          const pattern = ni >= 0 ? glob(args[ni + 1] || '*') : null;
          output = Object.keys(fs.tree)
            .filter(
              (p) =>
                (p === target || p.startsWith(target === '/' ? '/' : target + '/')) &&
                (!pattern || pattern.test(basename(p))),
            )
            .sort()
            .join('\n');
          break;
        }
        case 'grep': {
          if (!paths.length) throw new Error('grep: missing pattern');
          const pattern = options.includes('-i') ? paths[0].toLowerCase() : paths[0];
          const inputs =
            paths.length > 1
              ? paths.slice(1).map((p) => ({ p, text: read(p) }))
              : [{ p: '', text: input }];
          output = inputs
            .flatMap(({ p, text }) =>
              text
                .split('\n')
                .map((text, i) => ({ text, i }))
                .filter((l) =>
                  (options.includes('-i') ? l.text.toLowerCase() : l.text).includes(pattern),
                )
                .map(
                  (l) =>
                    (inputs.length > 1 ? p + ':' : '') +
                    (options.includes('-n') ? l.i + 1 + ':' : '') +
                    l.text,
                ),
            )
            .join('\n');
          break;
        }
        case 'head':
        case 'tail': {
          const ni = args.indexOf('-n');
          let count = 10;
          const pp = [...args];
          if (ni >= 0) {
            count = Number(args[ni + 1]);
            if (!Number.isInteger(count) || count < 0) throw new Error('Invalid line count');
            pp.splice(ni, 2);
          }
          const text = pp.length ? read(pp[0]) : input;
          const lines = text.replace(/\n$/, '').split('\n');
          output = (cmd === 'head' ? lines.slice(0, count) : count ? lines.slice(-count) : []).join(
            '\n',
          );
          break;
        }
        case 'tree': {
          const root = resolve(args[0] || '.');
          if (fs.tree[root]?.type !== 'dir') throw new Error('Not a directory');
          const walk = (p: string, prefix = ''): string[] =>
            listLinux(fs.tree, p).flatMap((child, i, all) => [
              prefix + (i === all.length - 1 ? '└── ' : '├── ') + basename(child),
              ...(fs.tree[child].type === 'dir'
                ? walk(child, prefix + (i === all.length - 1 ? '    ' : '│   '))
                : []),
            ]);
          output = root + '\n' + walk(root).join('\n');
          break;
        }
        case 'whoami':
          output = 'guest';
          break;
        case 'uname':
          output = args.includes('-a')
            ? 'Linux portfolio 6.8.0-curiosity #1 SIMULATED x86_64 Portfolio/Linux'
            : 'Linux';
          break;
        case 'date':
          output = new Date().toString();
          break;
        case 'time':
          output = new Date().toLocaleTimeString();
          break;
        case 'history':
          output = history.map((c, i) => String(i + 1).padStart(4) + '  ' + c).join('\n');
          break;
        case 'env':
          output =
            'USER=guest\nHOME=/home/guest\nSHELL=/bin/portfolio-sh\nHOSTNAME=portfolio\nTERM=xterm-256color\nLANG=en_US.UTF-8';
          break;
        case 'hostname':
          output = 'portfolio';
          break;
        case 'id':
          output = 'uid=1000(guest) gid=1000(guest) groups=1000(guest),27(curiosity)';
          break;
        case 'uptime':
          output = `up ${Math.floor(uptime / 60)} min, ${Math.floor(uptime % 60)} sec · 1 guest · simulated session`;
          break;
        case 'ps':
        case 'top':
          output =
            '  PID USER     COMMAND\n    1 root     imagination\n   42 guest    portfolio-sh\n  128 guest    curiosity.service\n\nSimulated process table; no access to host processes.';
          break;
        case 'df':
          output = `Filesystem       Size   Used   Mounted on\nvirtual-disk     2 MB   ${Math.ceil(JSON.stringify(fs.tree).length / 1024)} KB  /\nindexeddb        browser-managed /home/guest/shelf`;
          break;
        case 'free':
          output =
            '              total      used      free\nSimulated RAM  640K       128K      512K\nSwap          a good night’s sleep';
          break;
        case 'neofetch':
          output = `       /\\_/\\\n      ( o.o )       guest@portfolio\n       > ^ <        ----------------\n                    OS: Portfolio Linux (simulated)\n                    Kernel: 6.8.0-curiosity\n                    Shell: portfolio-sh\n                    CPU: A curious human\n                    Memory: Plenty of good ones\n                    Uptime: ${Math.floor(uptime)} seconds`;
          break;
        case 'about':
          output = profile.about;
          break;
        case 'skills':
          output = profile.skills.join('\n');
          break;
        case 'projects':
          output = profile.projects
            .map((p) => p.name + '\n  ' + p.description + '\n  ' + p.url)
            .join('\n\n');
          break;
        case 'contact':
          output = profile.github + (profile.email ? '\n' + profile.email : '');
          break;
        case 'fortune':
          output = [
            'The best shortcut is knowing what you’re doing.',
            'A bug is a question waiting to be understood.',
            'Your next good idea is one experiment away.',
          ][Math.floor(Math.random() * 3)];
          break;
        case 'cowsay': {
          const message = args.join(' ') || 'Stay curious.';
          output =
            ' ' +
            '_'.repeat(Math.min(message.length + 2, 60)) +
            '\n< ' +
            message +
            ' >\n ' +
            '-'.repeat(Math.min(message.length + 2, 60)) +
            '\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||';
          break;
        }
        case 'coffee':
          output =
            '  ( (\n   ) )\n  .----.\n  |    |]   Brewing ideas…\n  `----´    One imaginary coffee, coming right up.';
          break;
        case 'sl':
          output =
            '      ====        ________\n  _D _|  |_______/        \\\n   |(_)---  |   H\________/\n   /     |  |   H  |  |\n  |______|__|___H__|__|\n   (o)   (o)    (o)(o)\n\nWrong platform. The next train is curiosity.';
          break;
        case 'hack':
          output =
            '[SIMULATION] Scanning for curiosity… FOUND\n[SIMULATION] Bypassing procrastination… RETRY\n[SIMULATION] Access granted to your own imagination.\nNo networks were accessed.';
          break;
        case 'sudo':
          output =
            'guest is not in the sudoers file.\nThis incident will be reported to the nearest houseplant.';
          break;
        case 'easteregg':
          output =
            'A small note: thank you for looking closer.\nTry fortune, cowsay, coffee, matrix, or snake.';
          break;
        case 'matrix':
          action = 'matrix';
          output = 'Follow the white rabbit. Press Escape to return.';
          break;
        case 'snake':
          action = 'snake';
          output = '';
          break;
        case 'reboot':
        case 'exit':
          action = 'reboot';
          output = 'Stopping guest session. Returning to the graphical OS…';
          break;
        case 'shutdown':
          action = 'shutdown';
          output = 'System shutting down…';
          break;
        default:
          throw new Error(`${cmd}: command not found`);
      }
    }
    if (redirect) {
      if (action) throw new Error('Interactive commands cannot be redirected');
      fs.write(normalizePath(redirect, current), output + '\n', append);
      output = '';
    }
    return { output, cwd: current, action };
  } catch (e) {
    return { output: (e as Error).message, cwd: current };
  }
}
