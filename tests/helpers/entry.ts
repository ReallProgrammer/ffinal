import { expect, type Page } from '@playwright/test';
export async function terminalCommand(page: Page, command: string) {
  const input = page.getByRole('textbox', { name: 'Linux command', exact: true });
  await input.fill(command);
  await input.press('Enter');
}
export async function captureFlag(page: Page) {
  await expect(page.locator('.linux-terminal')).toBeVisible({ timeout: 20000 });
  if ((await page.locator('.linux-terminal').getAttribute('data-entry-phase')) === 'locked') {
    await terminalCommand(page, '-flag FLAG{follow_the_trail}');
    await expect(page.locator('.linux-terminal')).toHaveAttribute('data-entry-phase', 'unlocked');
  }
}
export async function passEntry(page: Page) {
  await expect(page.locator('.linux-terminal,.xp-logon,.desktop')).toBeVisible({ timeout: 20000 });
  if (await page.locator('.linux-terminal').isVisible()) {
    await captureFlag(page);
    await terminalCommand(page, 'UIstart');
  }
  if (await page.locator('.xp-logon').isVisible())
    await page.locator('.xp-logon').getByRole('button', { name: 'Guest', exact: false }).click();
  await expect(page.locator('.desktop')).toBeVisible();
}
export async function desktop(page: Page, path = '/') {
  await page.goto(path);
  await page.locator('.boot-screen').waitFor();
  await page.keyboard.press('Enter');
  await passEntry(page);
}
export async function runApp(page: Page, cmd: string) {
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.locator('.start-menu').getByRole('button', { name: 'Run…', exact: true }).click();
  const input = page.locator('.run-app input');
  await input.fill(cmd);
  await input.press('Enter');
}
