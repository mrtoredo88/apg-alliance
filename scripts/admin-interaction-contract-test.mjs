import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default;
const source = await readFile(new URL('../src/AdminPanel.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const buttonsWithoutAction = [];
let buttonCount = 0;

traverse(ast, {
  JSXOpeningElement(path) {
    if (path.node.name.type !== 'JSXIdentifier' || path.node.name.name !== 'button') return;
    buttonCount += 1;
    const attributes = path.node.attributes
      .filter(attribute => attribute.type === 'JSXAttribute')
      .map(attribute => attribute.name.name);
    const hasAction = attributes.some(name => ['onClick', 'onMouseDown'].includes(name));
    const typeAttribute = path.node.attributes.find(attribute => attribute.type === 'JSXAttribute' && attribute.name.name === 'type');
    const buttonType = typeAttribute?.value?.type === 'StringLiteral' ? typeAttribute.value.value : '';
    const submitsForm = buttonType === 'submit';
    if (!hasAction && !submitsForm) buttonsWithoutAction.push(path.node.loc.start.line);
  },
});

assert.ok(buttonCount >= 290, `Ожидалось не менее 290 кнопок админки, найдено ${buttonCount}.`);
assert.deepEqual(buttonsWithoutAction, [], `Кнопки без действия: строки ${buttonsWithoutAction.join(', ')}`);

for (const action of [
  'user-accounts:duplicates',
  'user-accounts:not-duplicate',
  'user-accounts:split-duplicate',
  'user-accounts:bulk-update',
  'user-accounts:merge-preview',
  'user-accounts:merge',
  'user-accounts:archive',
  'user-accounts:restore',
  'user-accounts:delete',
]) {
  assert.ok(source.includes(`'${action}'`), `В интерфейсе отсутствует действие ${action}.`);
}

assert.match(source, /mergePreview\.requiresPrivilegedConfirmation && !confirmPrivilegedMerge/);
assert.match(source, /canDeleteUsers=\{String\(adminSession\?\.role \|\| adminSecurity\?\.actor\?\.role \|\| ''\)\.toLowerCase\(\) === 'owner'\}/);
assert.match(source, />Карточка<\/button>/);
assert.match(source, />Не дубли<\/button>/);
assert.match(source, />Отделить от группы<\/button>/);

console.log(`Admin interaction contract passed: ${buttonCount} buttons and all user-account actions checked`);
