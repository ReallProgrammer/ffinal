import { expect, type Page } from '@playwright/test';
export async function passEntry(page: Page) {
  await expect(page.locator('.access-challenge,.desktop')).toBeVisible({ timeout: 20000 });
  if (await page.locator('.access-challenge').isVisible()) {
    await page.getByRole('button', { name: 'Phishing', exact: true }).click();
    await page.getByLabel('Submit your flag').fill('FLAG{spot_the_phish}');
    await page.getByRole('button', { name: 'Unlock the desktop' }).click();
  }
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
