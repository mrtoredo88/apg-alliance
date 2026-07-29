import assert from 'node:assert/strict';
import process from 'node:process';
import { chromium } from 'playwright';

const url = process.env.ADMIN_USERS_HARNESS_URL || 'http://127.0.0.1:5173/admin-users-harness.html';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const dialogAnswers = [];
page.on('dialog', async dialog => {
  const answer = dialogAnswers.shift();
  if (answer === false) await dialog.dismiss();
  else await dialog.accept(typeof answer === 'string' ? answer : '');
});

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  const activeRows = page.getByTestId('admin-user-row');
  await activeRows.nth(0).locator('input[type="checkbox"]').check();
  await activeRows.nth(1).locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Объединить', exact: true }).last().click();
  await page.getByRole('button', { name: 'Проверить перенос' }).click();
  await page.getByPlaceholder('Например: один пользователь зарегистрировался через email и Telegram').fill('Выбраны вручную в списке активных');
  await page.getByRole('button', { name: 'Объединить', exact: true }).last().click();

  await page.getByRole('button', { name: 'Найти дубли' }).click();
  await page.getByRole('button', { name: 'Разобрать группу' }).click();
  await page.getByRole('button', { name: 'Объединить' }).click();
  await page.getByRole('alert').getByText('Сначала нажмите «Проверить перенос».').waitFor();
  await page.getByRole('button', { name: 'Проверить перенос' }).click();
  await page.getByRole('button', { name: 'Объединить' }).click();
  await page.getByRole('alert').getByText('Укажите причину объединения — минимум 3 символа.').waitFor();
  await page.getByPlaceholder('Например: один пользователь зарегистрировался через email и Telegram').fill('Один пользователь, разные способы входа');
  await page.getByRole('button', { name: 'Объединить' }).click();

  await page.getByRole('button', { name: 'Активные · 3' }).click();
  const alphabeticalNames = await page.getByTestId('admin-user-row').evaluateAll(rows => rows.map(row => row.dataset.userName));
  assert.deepEqual(alphabeticalNames, ['Анна Петрова', 'Борис Петров', 'Яков Петров']);
  await page.getByRole('button', { name: 'Карточка' }).first().click();
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await page.getByRole('button', { name: 'Изменить' }).first().click();
  await page.getByLabel('Количество ключей').fill('12');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('button', { name: 'Выбрать все' }).click();
  dialogAnswers.push(true, 'Плановая проверка тестового аккаунта');
  await page.getByRole('button', { name: 'В архив' }).click();

  await page.getByRole('button', { name: 'Архив · 1' }).click();
  await page.getByRole('button', { name: 'Выбрать все' }).click();
  await page.getByRole('button', { name: 'Восстановить' }).click();
  await page.getByRole('button', { name: 'Выбрать все' }).click();
  dialogAnswers.push('УДАЛИТЬ 1', 'Удаление тестового аккаунта');
  await page.getByRole('button', { name: 'Удалить выбранные' }).click();

  await page.getByRole('button', { name: 'Найти дубли' }).click();
  dialogAnswers.push('Это разные люди');
  await page.getByRole('button', { name: 'Не дубли' }).click();
  await page.getByRole('button', { name: 'Найти дубли' }).click();
  dialogAnswers.push('Отдельный тестовый пользователь');
  await page.getByRole('button', { name: 'Отделить от группы' }).first().click();

  const actions = await page.evaluate(() => window.__adminHarnessActions.map(item => item.action));
  for (const expected of [
    'user-accounts:duplicates', 'user-accounts:merge-preview', 'user-accounts:merge',
    'user-accounts:bulk-update', 'user-accounts:archive', 'user-accounts:restore',
    'user-accounts:delete', 'user-accounts:not-duplicate', 'user-accounts:split-duplicate',
  ]) assert.ok(actions.includes(expected), `Не вызвано действие ${expected}`);
  const profileUpdate = await page.evaluate(() => window.__adminHarnessActions.find(item => item.action === 'user-accounts:bulk-update'));
  assert.equal(profileUpdate.payload.patch.keys, 12, 'Количество ключей не передано при редактировании аккаунта');
  assert.equal(dialogAnswers.length, 0, 'Не все подтверждения были обработаны');
  console.log(`Admin users browser test passed: ${actions.length} actions, all controls clickable`);
} finally {
  await browser.close();
}
