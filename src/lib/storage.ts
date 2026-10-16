const temporaryKeys = new Set([
  'pc-files-v2',
  'pc-notes',
  'pc-linux-fs-v2',
  'pc-ctf-fs-v1',
  'pc-icon-positions',
  'pc-icon-labels',
  'pc-desktop-hidden',
]);
const temporaryValues = new Map<string, string>();
export function removeStorage(key: string) {
  temporaryValues.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* Storage may be disabled. */
  }
}
export function clearTemporaryStorage() {
  for (const key of temporaryKeys) removeStorage(key);
}
// Virtual file changes belong to this page lifetime, including in browsers
// that restore sessionStorage after a tab is closed. Ignore legacy saved files.
clearTemporaryStorage();
export function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = temporaryKeys.has(key) ? temporaryValues.get(key) : localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStorage(key: string, value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);
    if (temporaryKeys.has(key)) temporaryValues.set(key, serialized);
    else localStorage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}
export function downloadText(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
