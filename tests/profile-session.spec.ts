import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { desktop, runApp, captureFlag, terminalCommand, passEntry } from './helpers/entry';

test('XP account chooser offers only existing owner and Guest, with no desktop before selection', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('.boot-screen').waitFor();
  await page.keyboard.press('Enter');
  await captureFlag(page);
  await terminalCommand(page, 'UIstart');
  const logon = page.locator('.xp-logon');
  await expect(logon).toBeVisible();
  await expect(page.locator('.desktop')).toHaveCount(0);
  await expect(logon.getByRole('button', { name: /sign up|create account/i })).toHaveCount(0);
  await logon.getByRole('button', { name: 'x0Arghad', exact: false }).click();
  await expect(logon.getByLabel('Username')).toHaveValue('x0Arghad');
  await logon.getByLabel('Password', { exact: true }).fill('wrong-test-password');
  await logon.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(logon.getByRole('alert')).toContainText('Could not sign in');
  await expect(logon.getByLabel('Password', { exact: true })).toHaveValue('');
  await logon.getByRole('button', { name: 'Back to terminal' }).click();
  await expect(page.locator('.linux-terminal')).toHaveAttribute('data-entry-phase', 'unlocked');
  await terminalCommand(page, 'UIstart');
  await page.screenshot({
    path: '/workspace/artifacts/xp-account-' + test.info().project.name + '.png',
  });
  await logon.getByRole('button', { name: 'Guest', exact: false }).click();
  await runApp(page, 'chess');
  await page.getByRole('button', { name: 'Owner dashboard', exact: true }).click();
  await expect(page.getByLabel('Owner email')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Use the same private owner account');
});

test('virtual files and edited CV reset on refresh while settings and published collection remain', async ({
  page,
}) => {
  await desktop(page);
  await runApp(page, 'notepad');
  const note = page.locator('[data-app="notepad"]').last();
  await note.getByLabel('Notepad document').fill('temporary note');
  await note.getByLabel('Notepad document').press('Control+s');
  await runApp(page, 'explorer');
  const explorer = page.locator('[data-app="explorer"]').last();
  const documents = explorer.locator('[data-file-id="documents"]');
  if (test.info().project.name === 'mobile') await documents.tap();
  else await documents.dblclick();
  const cv = explorer.locator('[data-file-id="cv"]');
  if (test.info().project.name === 'mobile') await cv.tap();
  else await cv.dblclick();
  const editor = page.locator('[data-app="notepad"]').last().getByLabel('Notepad document');
  await editor.fill('Session-only CV');
  await editor.press('Control+s');
  await page.reload();
  await page.locator('.boot-screen').waitFor();
  await page.keyboard.press('Enter');
  await passEntry(page);
  await runApp(page, 'cmd');
  const command = page.getByRole('textbox', { name: 'Command prompt input' });
  await command.fill('cd documents');
  await command.press('Enter');
  await command.fill('dir');
  await command.press('Enter');
  await expect(page.locator('.terminal')).not.toContainText('Untitled.txt');
  await expect(page.locator('.terminal')).not.toContainText('temporary-copy.txt');
  await command.fill('type CV.txt');
  await command.press('Enter');
  await expect(page.locator('.terminal')).toContainText('x0Arghad');
  await expect(page.locator('.terminal')).not.toContainText('Session-only CV');
  expect(await page.evaluate(() => localStorage.getItem('pc-files-v2'))).toBeNull();
});

test('power on starts immediately and requires a new flag before returning to the terminal', async ({
  page,
}) => {
  await desktop(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Turn Off Computer', exact: true }).click();
  await page
    .locator('.power-dialog')
    .getByRole('button', { name: 'Turn Off', exact: true })
    .click();
  await expect(page.locator('.off-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Power on', exact: true }).click();
  await expect(page.locator('.shutdown-screen')).toHaveCount(0);
  await expect(page.locator('.boot-screen')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.linux-terminal')).toHaveAttribute('data-entry-phase', 'locked');
  await terminalCommand(page, 'UIstart');
  await expect(page.locator('.linux-output')).toContainText('UI locked');
  await captureFlag(page);
  await expect(page.locator('.desktop')).toHaveCount(0);
  await terminalCommand(page, 'UIstart');
  await expect(page.locator('.xp-logon')).toBeVisible();
});

test('public profile, Nabeeh and CV use supplied facts without the excluded education', async ({
  page,
  request,
}) => {
  await desktop(page);
  await runApp(page, 'browser');
  await page.locator('.site-header').getByRole('button', { name: 'About', exact: true }).click();
  const content = page.locator('.browser-page');
  await expect(content).toContainText('x0Arghad');
  await expect(content).toContainText('PMU');
  await expect(content).toContainText('Google Cybersecurity');
  await expect(content).toContainText('Arabic — Native');
  await expect(content).not.toContainText(/KFUPM|Petroleum|Real Otaku/);
  await page.locator('.site-header').getByRole('button', { name: 'Projects', exact: true }).click();
  await expect(content.locator('.project-card').filter({ hasText: 'Nabeeh' })).toContainText(
    'Arabic trivia',
  );
  await expect(
    content.locator('a[href="https://github.com/ProgrammeringAlone/Nabeeh"]'),
  ).toBeVisible();
  const cv = await request.get('/cv-x0Arghad.pdf');
  expect(cv.ok()).toBe(true);
  expect((await cv.body()).subarray(0, 4).toString()).toBe('%PDF');
});

test('existing owner signs in at XP screen and gains the same protected dashboard access', async ({
  page,
}, info) => {
  test.skip(
    !process.env.LIBRARY_TEST_CREDENTIALS || info.project.name === 'mobile',
    'Owner integration runs on desktop.',
  );
  const creds = JSON.parse(readFileSync(process.env.LIBRARY_TEST_CREDENTIALS!, 'utf8'));
  await page.goto('/');
  await page.locator('.boot-screen').waitFor();
  await page.keyboard.press('Enter');
  await captureFlag(page);
  await terminalCommand(page, 'UIstart');
  const logon = page.locator('.xp-logon');
  await logon.getByRole('button', { name: 'x0Arghad', exact: false }).click();
  await logon.getByLabel('Password', { exact: true }).fill(creds.password);
  const signedIn = page.waitForResponse(
    (r) => r.url().endsWith('/session') && r.request().method() === 'POST',
  );
  await logon.getByRole('button', { name: 'Sign in', exact: true }).click();
  const token = (await (await signedIn).json()).token;
  await expect(page.locator('.desktop')).toBeVisible();
  await runApp(page, 'chess');
  await page.getByRole('button', { name: 'Owner dashboard', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Match requests', exact: false })).toBeVisible();
  await expect(page.getByLabel('Owner email')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Turn Off Computer', exact: true }).click();
  await page
    .locator('.power-dialog')
    .getByRole('button', { name: 'Turn Off', exact: true })
    .click();
  await expect(page.locator('.off-screen')).toBeVisible();
  const api = process.env.LIBRARY_TEST_API || 'http://127.0.0.1:8787/api/v1';
  expect(
    (
      await page.request.get(api + '/admin/collection', {
        headers: { Authorization: 'Bearer ' + token },
      })
    ).status(),
  ).toBe(401);
});

test('closing a tab restores files after creating, copying and moving a folder document', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.locator('.boot-screen').waitFor();
  await page.keyboard.press('Control+Alt+t');
  await captureFlag(page);
  for (const command of [
    'mkdir -p session-box/nested',
    'echo "temporary document" > session-box/nested/note.txt',
    'cp session-box/nested/note.txt copy.txt',
    'mv copy.txt session-box/moved.txt',
    'cat session-box/moved.txt',
  ])
    await terminalCommand(page, command);
  await expect(page.locator('.linux-output')).toContainText('temporary document');
  await page.close();
  const fresh = await context.newPage();
  await fresh.goto('/');
  await fresh.locator('.boot-screen').waitFor();
  await fresh.keyboard.press('Control+Alt+t');
  await captureFlag(fresh);
  await terminalCommand(fresh, 'cat session-box/moved.txt');
  await expect(fresh.locator('.linux-output')).toContainText('No such file or directory');
});
