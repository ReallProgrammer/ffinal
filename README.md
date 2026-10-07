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

- Watch the boot sequence, or press **Enter / Escape** to skip it. Control Panel can skip startup on future visits.
- Desktop: single click selects, double click opens, drag moves icons, right click opens a menu, F2 renames. On touch devices, tap opens an app and drag moves an icon.
- Windows: drag the title bar, resize from any edge or corner, minimize to the taskbar, maximize, restore, or close. On small screens, apps use readable, nearly full-screen windows; the taskbar switches between apps.
- **Ctrl+Escape** opens Start. Arrow keys navigate its buttons. Escape dismisses menus. **Ctrl/⌘+Shift+L** launches Command Prompt.
- Explorer: browse folders, use Back/Forward/Up, change the address, switch icon/detail views, and open files.
- Notepad: edit, create, open built-in/saved/device files, toggle wrapping, and use normal text selection/copy/paste. **Ctrl/⌘+S** saves in this browser; **Ctrl/⌘+Shift+S** saves and downloads a text file. **Ctrl/⌘+O / N** open/new. Existing built-in documents can be edited locally; repository source files are unaffected.
- Calculator: use the buttons or number/operator keys. Enter calculates; Escape clears; Backspace deletes. Includes memory, percentage, square root, and reciprocal.
- Browser: browse `portfolio://home`, `portfolio://projects`, `portfolio://about`, and `portfolio://contact`. External addresses open in a separate tab because arbitrary websites cannot be embedded reliably or safely.
- Command Prompt: `help`, `dir`, `cd`, `cls`, `type`, `whoami`, `ver`, `date`, `time`, `echo`, `about`, `skills`, `education`, `projects`, `contact`, `start`, `exit`. Arrow keys recall commands; Tab completes local file names.
- Control Panel: change wallpaper, CRT effects, sound, volume, and startup preference. System sound is muted initially and requires user interaction. Reduced-motion preferences are respected.

## A few secrets

Try `matrix`, `secret`, `hello`, `sudo`, `error`, or `bsod` in Command Prompt. The Konami code opens Memory Lane. The Recycle Bin has some intentionally misplaced files. Simulated system errors and blue screens are harmless and recoverable without a page reload.

## Local storage

`pc-settings`, `pc-notes`, `pc-icon-labels`, `pc-icon-positions`, and `pc-visited` store only local UI state and notes. There is no cloud synchronization. Notepad's Save As downloads a portable copy. The app remains usable when browser storage is unavailable, and saving then falls back to downloading text.

## Validate

```sh
npx playwright install chromium
npm test
```

If Chromium is already installed, use it without downloading another copy:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test -- --workers=3
```

The Playwright suite exercises desktop and touch/mobile layouts: startup, Explorer navigation, notes and downloads, calculator, terminal, browser history, window controls, settings persistence, search, the game, and runtime errors. Desktop drag/resize tests are intentionally skipped on mobile, where windows use a full-screen interaction model.

## Architecture

`App.tsx` owns desktop state, window ordering, startup, and system dialogs. `DesktopContext` exposes app-launch and system actions. Each app manages its own content state, while `Window` owns pointer-driven move/resize interactions. `MenuBar` is shared across apps. All portfolio content comes from the shared data modules. No expression evaluation, external HTML injection, or executable shell access is used.

## GitHub Pages

The included `.github/workflows/pages.yml` builds and publishes the complete site when `main` changes. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. If this is the first deployment, enable that setting and run **Deploy portfolio to GitHub Pages** from the Actions tab if a previous run failed while Pages was disabled.

The workflow builds the site with its repository path (`/ffinal/`). Fonts, JavaScript, CSS, and the favicon use the same base path; the original development server still uses `/`.

To reproduce the deployment build locally:

```sh
PAGES_BASE_PATH=/ffinal/ npm run build
PAGES_BASE_PATH=/ffinal/ npm run preview -- --port 4173
```

The intended Pages address is `https://reallprogrammer.github.io/ffinal/`. It is only live after GitHub reports a successful Pages deployment. The complete source remains available in this repository; `dist/` is generated by the workflow and is not committed.
