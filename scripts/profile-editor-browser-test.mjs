import assert from 'node:assert/strict';
import process from 'node:process';
import { chromium } from 'playwright';

const baseUrl = process.env.PROFILE_EDITOR_URL || 'https://127.0.0.1:4174/?no-sw=1#/';
const browser = await chromium.launch({ headless: true });

async function openProfile(viewport, mobile = false) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await context.newPage();
  let profileUpdateAttempts = 0;
  let failNextProfileUpdate = false;
  await page.route('**/api/user-actions', async route => {
    const request = route.request();
    const payload = request.method() === 'POST' ? request.postDataJSON() : {};
    if (payload?.action !== 'profile:update') return route.continue();
    profileUpdateAttempts += 1;
    if (failNextProfileUpdate) {
      failNextProfileUpdate = false;
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Тестовая ошибка сохранения' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('apg_email_user', JSON.stringify({
      id: 'quality-profile-user',
      userId: 'quality-profile-user',
      email: 'quality.profile@apg.local',
      firstName: 'Тест',
      lastName: 'Профиль',
      name: 'Тест Профиль',
      displayName: 'Тест Профиль',
    }));
    localStorage.setItem('apg_onboarded', '1');
    localStorage.setItem('apg_native_identity', JSON.stringify({
      uid: 'quality-profile-user',
      email: 'quality.profile@apg.local',
      token: 'quality-profile-token',
      claims: { role: 'user' },
    }));
    localStorage.removeItem('manualLogout');
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  if (mobile) await page.getByText('Профиль', { exact: true }).last().click();
  else await page.getByText('Открыть профиль', { exact: true }).click();
  return {
    context,
    page,
    failNextProfileUpdate: () => { failNextProfileUpdate = true; },
    getProfileUpdateAttempts: () => profileUpdateAttempts,
  };
}

try {
  const mobile = await openProfile({ width: 390, height: 844 }, true);
  const mobileTarget = mobile.page.getByTestId('profile-identity-edit-target');
  await mobileTarget.waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await mobileTarget.evaluate(node => node.tagName), 'BUTTON');
  await mobileTarget.click();
  await mobile.page.getByRole('dialog', { name: 'Редактировать профиль' }).waitFor();
  await mobile.page.getByRole('button', { name: 'Отмена' }).click();
  await mobileTarget.focus();
  await mobile.page.keyboard.press('Enter');
  const mobileDialog = mobile.page.getByRole('dialog', { name: 'Редактировать профиль' });
  await mobileDialog.waitFor();
  await mobile.page.getByPlaceholder('Имя').fill('Новое');
  const attemptsBeforeSave = mobile.getProfileUpdateAttempts();
  mobile.failNextProfileUpdate();
  await mobile.page.getByRole('button', { name: 'Сохранить' }).click();
  await mobile.page.getByRole('alert').waitFor({ timeout: 5000 });
  assert.match(await mobile.page.getByRole('alert').innerText(), /Тестовая ошибка сохранения/);
  await mobile.page.getByRole('button', { name: 'Сохранить' }).click();
  await mobileDialog.waitFor({ state: 'hidden' });
  await mobileTarget.getByText('Новое Профиль', { exact: true }).waitFor();
  assert.equal(mobile.getProfileUpdateAttempts(), attemptsBeforeSave + 2);
  await mobile.context.close();

  const desktop = await openProfile({ width: 1440, height: 1000 });
  const desktopName = desktop.page.getByTestId('desktop-profile-name-edit');
  await desktopName.waitFor({ state: 'visible', timeout: 10000 });
  await desktopName.click();
  await desktop.page.getByRole('dialog', { name: 'Редактировать профиль' }).waitFor();
  await desktop.page.getByRole('button', { name: 'Отмена' }).click();

  const desktopPencil = desktop.page.getByTestId('desktop-profile-pencil-edit');
  await desktopPencil.click();
  await desktop.page.getByRole('dialog', { name: 'Редактировать профиль' }).waitFor();
  await desktop.page.getByRole('button', { name: 'Отмена' }).click();
  await desktop.context.close();

  console.log('Profile editor browser regression passed: mobile click/keyboard and desktop name/pencil');
} finally {
  await browser.close();
}
