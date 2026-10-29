import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { E2E_DATA_DIR, LAMP_SVG, LOGO_SVG } from './env';

/** The ids the global setup seeded */
function seeded(): { lineId: string; productId: string; toApprove: string; toReject: string } {
  return JSON.parse(fs.readFileSync(path.join(E2E_DATA_DIR, 'seed.json'), 'utf8'));
}

test('Today shows the videos ready for review and the worker state', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await expect(page.getByText('Ready for review').first()).toBeVisible();
  await expect(page.getByTestId('video-link')).toHaveCount(2);
  await expect(page.getByTestId('worker-state')).toContainText('Worker offline');
});

test('the review page plays the video and shows the post texts and the history', async ({
  page,
}) => {
  await page.goto('/videos/review');
  await page.getByTestId('video-link').first().click();
  const video = page.getByTestId('review-video');
  await expect(video).toBeVisible();
  // the browser loads the real MP4 through the files route (with ranges) and can seek it
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.duration), {
      timeout: 15_000,
    })
    .toBeGreaterThan(1.5);
  await video.evaluate((element: HTMLVideoElement) => {
    element.currentTime = 1.2;
  });
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeGreaterThan(1);
  await expect(page.getByTestId('post')).toHaveCount(4);
  // the review frames are in the closed "Review frames" section as a contact sheet
  await expect(page.getByTestId('contact-sheet').locator('img')).toHaveCount(3);
  await expect(page.getByText('A short video about the moon lamp')).toBeVisible();
});

test('approve makes a video ready to post', async ({ page }) => {
  await page.goto(`/videos/${seeded().toApprove}`);
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Approved: ready to post').first()).toBeVisible();
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
});

test('reject with redo sends the video back to the chosen stage', async ({ page }) => {
  await page.goto(`/videos/${seeded().toReject}`);
  await page.getByLabel('Why?').fill('The price shows too late');
  await page.getByLabel('Back to').selectOption('script');
  await page.getByRole('button', { name: 'Reject' }).click();
  // the page reloads with the video back in production (the form leaves with the decision)
  await expect(page.getByText('The crews are working on it: Script.')).toBeVisible();
  await expect(page.getByText('Rejected (Redo: send it back with my comment)')).toBeAttached();
});

test('a new line is saved with its logo', async ({ page }) => {
  await page.goto('/lines/new');
  await page.getByLabel('Name').fill('3D printing tips');
  await page.getByLabel('Kind').selectOption('topic');
  await page.getByLabel('Subject').fill('Tips to get better 3D prints at home');
  await page.getByLabel('Tone').fill('calm and friendly');
  await page.getByLabel('Objective').fill('teach and gain followers');
  await page.getByLabel('Audience').fill('people who print in 3D at home');
  await page.getByLabel('Logo').setInputFiles(LOGO_SVG);
  await page.getByRole('button', { name: 'Create line' }).click();
  await expect(page).toHaveURL(/\/lines\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: '3D printing tips' })).toBeVisible();
  await page.goto('/lines');
  await expect(page.getByRole('link', { name: '3D printing tips' })).toBeVisible();
});

test('a new product is saved with its photos', async ({ page }) => {
  await page.goto('/products/new');
  await page.getByLabel('Name').fill('Vaso Onda');
  await page.getByLabel('Description').fill('A wavy vase printed in 3D.');
  await page.getByLabel('Price', { exact: true }).fill('59,90');
  await page.getByLabel('Category').fill('vases');
  await page.getByLabel('Photos').setInputFiles([LAMP_SVG, LOGO_SVG]);
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole('link', { name: 'Vaso Onda' }).first()).toBeVisible();
});

test('settings are saved', async ({ page }) => {
  await page.goto('/settings');
  // the config gives the panel fake keys, so both show as configured (never the real ones)
  await expect(page.getByText('Configured').first()).toBeVisible();
  await page.getByLabel('Global monthly cap (USD)').fill('77');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Global monthly cap (USD)')).toHaveValue('77');
});

test('the language switch turns the panel into Portuguese and back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'PT' }).click();
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
});

test('a request for another host name is refused', async ({ request, baseURL }) => {
  const response = await request.get(`${baseURL}/`, { headers: { host: 'evil.example:3310' } });
  expect(response.status()).toBe(403);
});

test('on a phone the menu drawer closes with Escape and focus returns to the menu button', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Open the menu' });
  await menu.click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(menu).toBeFocused();
});

test('a refused form keeps what was typed', async ({ page }) => {
  await page.goto('/products/new');
  await page.getByLabel('Name').fill('Vaso Refused');
  await page.getByLabel('Description').fill('A vase that must not be saved.');
  await page.getByLabel('Price', { exact: true }).fill('59,90');
  await page.getByLabel('Price before the offer').fill('10,00');
  await page.getByLabel('Category').fill('vases');
  await page.getByLabel('Photos').setInputFiles(LAMP_SVG);
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByText('must be higher than priceCents')).toBeVisible();
  await expect(page).toHaveURL(/\/products\/new$/);
  await expect(page.getByLabel('Name')).toHaveValue('Vaso Refused');
  await expect(page.getByLabel('Price before the offer')).toHaveValue('10,00');
});

test('settings: a new model with prices is saved and the new-model row is emptied', async ({
  page,
}) => {
  await page.goto('/settings');
  await page.getByLabel('Add a model', { exact: true }).fill('claude-e2e-model');
  await page.getByLabel('Add a model: Input').fill('3');
  await page.getByLabel('Add a model: Output').fill('15');
  await page.getByLabel('Add a model: Cache read').fill('0.3');
  await page.getByLabel('Add a model: Cache write').fill('3.75');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
  await expect(page.getByLabel('Add a model', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Add a model: Input')).toHaveValue('');
  await expect(page.getByLabel('claude-e2e-model: Input')).toHaveValue(/^3(\.0+)?$/);
});

test('a request for the right host name on another port is refused', async ({ request }) => {
  const response = await request.get('http://127.0.0.1:3310/', {
    headers: { host: '127.0.0.1:3399' },
  });
  expect(response.status()).toBe(403);
});

test('no page can be framed by another site, and files are never embeddable cross-origin', async ({
  request,
  baseURL,
}) => {
  const page = await request.get(`${baseURL}/`);
  expect(page.headers()['x-frame-options']).toBe('DENY');
  expect(page.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  const file = await request.get(`${baseURL}/files/jobs/${seeded().toApprove}/video.mp4`);
  expect(file.status()).toBe(200);
  expect(file.headers()['x-frame-options']).toBe('DENY');
  // the files route keeps its own, stricter policy (the proxy must not replace it)
  expect(file.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(file.headers()['content-security-policy']).toContain('sandbox');
  expect(file.headers()['cross-origin-resource-policy']).toBe('same-origin');
});
