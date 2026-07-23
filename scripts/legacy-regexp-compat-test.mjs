import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const provider = fs.readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
const richText = fs.readFileSync(new URL('../src/components/RichText.jsx', import.meta.url), 'utf8');
assert.doesNotMatch(provider, /\(\?<([=!]|[A-Za-z])/, 'LokiProvider must not contain lookbehind or named groups unsupported by iOS 16.1.');
assert.doesNotMatch(richText, /import\s+remarkGfm/, 'The startup bundle must not include remark-gfm, whose autolink parser uses lookbehind.');

const distDir = new URL('../dist/assets/', import.meta.url);
if (fs.existsSync(distDir)) {
  for (const name of fs.readdirSync(distDir)) {
    if (!name.endsWith('.js')) continue;
    const source = fs.readFileSync(path.join(distDir.pathname, name), 'utf8');
    assert.doesNotMatch(source, /\(\?<([=!]|[A-Za-z])/, `${name} contains a regexp group unsupported by iOS 16.1.`);
  }
}

console.log('legacy-regexp-compat-test: ok');
