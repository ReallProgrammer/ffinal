# Personal Computer

An interactive retro operating-system portfolio built with React, TypeScript, and Vite. Original vector artwork, locally bundled fonts, synthesized optional audio, and a small window manager bring the desktop to life. There are no proprietary Windows assets, backend services, API keys, or tracking scripts.

## Develop

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm ci
npm run dev
```

Vite serves the application on port 5173. For a production bundle:

```sh
npm run build
npm run preview
```

Deploy the generated `dist/` directory to any static host. Navigation stays within the application, so no server-side routing rules are required. Browsers need JavaScript; note persistence needs browser storage. Local application pages and fonts do not need third-party requests after loading the site.

## Personalize

**The current biography is editable sample content, not a verified CV.** Change `src/data/profile.ts` to set your name, role, introduction, skills, education, experience, certifications, projects, and contact information. The example name and role come from the supplied brief. University details, employment records, certifications, email, and LinkedIn are intentionally not invented. GitHub points to the owner of this repository.

- `src/data/profile.ts`: all personal information and project cards.
- `src/data/filesystem.ts`: the virtual folders and documents used by Explorer, Search, and Command Prompt.
- `src/components/desktop/Wallpaper.tsx`: original landscape wallpaper.
- `src/components/Icon.tsx`: original vector icons.
- `src/styles.css`: desktop chrome, applications, CRT effects, and responsive layouts.

Add real project URLs and descriptions to the `projects` array. Empty contact links are omitted automatically. Portfolio documents are generated from the profile at build time.

## Explore

- Watch the ~18-second black-screen, POST diagnostics, and loading sequence, or press **Enter** to skip it. Control Panel can skip startup on future visits.
- Desktop: single click selects, double click opens, drag moves icons, right click opens a menu, F2 renames. On touch devices, tap opens an app and drag moves an icon.
- Windows: drag the title bar, resize from any edge or corner, minimize to the taskbar, maximize, restore, or close. On small screens, apps use readable, nearly full-screen windows; the taskbar switches between apps.
- **Ctrl+Escape** opens Start. Arrow keys navigate its buttons. Escape dismisses menus. **Ctrl/⌘+Shift+L** launches Command Prompt.
- Explorer: browse folders, use Back/Forward/Up, change the address, switch icon/detail views, and open files.
- Notepad: edit, create, open built-in/saved/device files, toggle wrapping, and use normal text selection/copy/paste. **Ctrl/⌘+S** saves in this browser; **Ctrl/⌘+Shift+S** saves and downloads a text file. **Ctrl/⌘+O / N** open/new. Existing built-in documents can be edited locally; repository source files are unaffected.
- Calculator: use the buttons or number/operator keys. Enter calculates; Escape clears; Backspace deletes. Includes memory, percentage, square root, and reciprocal.
- Browser: browse `portfolio://home`, `portfolio://projects`, `portfolio://about`, and `portfolio://contact`. External addresses open in a separate tab because arbitrary websites cannot be embedded reliably or safely.
- Command Prompt: `help`, `dir`, `cd`, `cls`, `type`, `whoami`, `ver`, `date`, `time`, `echo`, `about`, `skills`, `education`, `projects`, `contact`, `start`, `exit`. Arrow keys recall commands; Tab completes local file names.
- Control Panel: change wallpaper, CRT effects, sound, volume, and startup preference. Sound starts only after a user interaction. Boot tones, click sounds, and ambient hum have separate switches and a master volume. Reduced-motion preferences are respected and can also be set explicitly.

## Computer behaviors

- **Boot:** Escape or Delete opens BIOS Setup; F12 opens the boot menu. Arrow keys navigate, Enter selects, F10 confirms saving and rebooting. Boot target, display, sound, and startup preferences persist. Recovery can clear temporary files, reset icons, or enter Safe Mode.
- **Desktop:** drag across empty space to select intersecting icons. Ctrl-click toggles selection; Shift-click selects a range. Drag a selected group together. F2 renames, Delete recycles, and Ctrl+Z undoes the last desktop deletion. Copy/cut/paste works for actual desktop files. System shortcuts remain protected.
- **Files:** Explorer supports new folders/documents, rename, copy, cut, paste, native file dragging, recycling, and restore. Drop text files into Notepad. Saved new notes appear in My Documents. Desktop files can be dragged into Explorer folders.
- **Windows:** Alt+Tab shows the application switcher, Shift reverses direction, and releasing Alt focuses the selection. Alt+F4 closes the focused window, with confirmation for unsaved notes. Ctrl+Shift+Escape opens Task Manager. F1 opens Help. F5 refreshes views while retaining unsaved text.
- **Games:** Pong supports mouse/touch or W/S and arrows, with first-to-five scoring. Snake supports WASD/arrows, touch controls, increasing speed, and a saved best score. Both have start, pause, and restart. Minesweeper has safe first reveal, flags, flood reveal, a timer, and win/loss detection; touch users can toggle Flag mode. Memory Lane remains available.
- **Shelf:** open My Shelf, choose Arrange collection, and add or drop files. Edit names/descriptions/categories, reorder with dragging or arrow buttons, filter, open, download, and delete. Images can become wallpapers. PDFs use the browser viewer when supported; a download remains available.

Keyboard shortcuts work when the browser delivers those keys to the page. Host operating systems may reserve Alt+Tab, Alt+F4, or the Windows key. Ctrl+L, browser DevTools, and fullscreen shortcuts keep their browser behavior. Keyboard shortcuts in text inputs remain scoped to the editor.

## Linux boot

During startup only, **Ctrl+Alt+T** opens the full-screen Linux environment. The boot menu also offers Linux. The graphical desktop is not mounted in this mode.

The terminal supports real simulated filesystem navigation and mutations: `ls`, `cd`, `pwd`, `cat`, `mkdir`, `touch`, `rm`, `cp`, `mv`, `find`, `grep`, `head`, `tail`, and `tree`. Quoted strings, pipes, `>` and `>>` work. `help` lists commands; Up/Down recall history and Tab completes paths. Files under `/home/guest` and `/tmp` persist locally. System folders and the Shelf metadata mount are read-only. Commands never execute a real shell.

Try `neofetch`, `fortune`, `cowsay`, `coffee`, or `matrix`. `snake` launches the playable terminal game; Q returns to the shell. `reboot` or `exit` runs shutdown and POST again, then returns to Windows. `shutdown` powers off.

## A few secrets

Try `matrix`, `secret`, `hello`, `sudo`, `error`, or `bsod` in Command Prompt. The Konami code opens Memory Lane. The Recycle Bin has some intentionally misplaced files. Simulated system errors and blue screens are harmless and recoverable without a page reload.

## Local storage

Settings, icon positions, short notes, and the simulated Windows/Linux filesystems use localStorage (`pc-*`). Large Shelf uploads use IndexedDB, never localStorage. Uploads are limited to 30 MB per file. Storage errors are reported without pretending a save succeeded. Notepad's Save As downloads a portable copy.

**The Shelf is local to each browser and site origin.** Uploads survive refresh, but are not published to other visitors or synced between devices. Clearing browser site data removes them; download important originals. “Arrange collection” edits this local collection without pretending to authenticate an owner. `src/lib/shelf/repository.ts` defines the replaceable `ShelfRepository` interface; supply a server implementation to the Shelf component to add shared storage and owner authentication later. Recovery's Clear Temporary Data and Reset Desktop preserve saved files and Shelf items.

## Validate

```sh
npx playwright install chromium
npm test
```

If Chromium is already installed, use it without downloading another copy:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test -- --workers=3
```

The Playwright suite exercises full boot, BIOS, Linux filesystem persistence, terminal Snake, recovery, Shelf uploads and downloads, desktop selection, actual file operations, game mechanics, window switching, and desktop/touch layouts. Original coverage includes: startup, Explorer navigation, notes and downloads, calculator, terminal, browser history, window controls, settings persistence, search, the game, and runtime errors. Desktop drag/resize tests are intentionally skipped on mobile, where windows use a full-screen interaction model.

## Architecture

`App.tsx` owns desktop state and window ordering. `src/lib/machine.ts` defines explicit boot/BIOS/Linux/Windows/recovery/shutdown transitions; system screens live under `src/components/system`. Game logic and loops live under `src/components/games`. `src/behaviors.css` adds styles for the second-pass behaviors. `DesktopContext` exposes app-launch and system actions. Each app manages its own content state, while `Window` owns pointer-driven move/resize interactions. `MenuBar` is shared across apps. All portfolio content comes from the shared data modules. No expression evaluation, external HTML injection, or executable shell access is used.

## GitHub Pages

The included `.github/workflows/pages.yml` builds and publishes the complete site when `main` changes. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. If this is the first deployment, enable that setting and run **Deploy portfolio to GitHub Pages** from the Actions tab if a previous run failed while Pages was disabled.

The workflow builds the site with its repository path (`/ffinal/`). Fonts, JavaScript, CSS, and the favicon use the same base path; the original development server still uses `/`.

To reproduce the deployment build locally:

```sh
PAGES_BASE_PATH=/ffinal/ npm run build
PAGES_BASE_PATH=/ffinal/ npm run preview -- --port 4173
```

The intended Pages address is `https://reallprogrammer.github.io/ffinal/`. It is only live after GitHub reports a successful Pages deployment. The complete source remains available in this repository; `dist/` is generated by the workflow and is not committed.
