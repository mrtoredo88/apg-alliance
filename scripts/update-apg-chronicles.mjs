import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const changelogPath = path.join(root, '.ai/17_CHANGELOG_AI.md');
const outputPath = path.join(root, 'src/loki/knowledge/updates/chronicles.json');

function parseEntries(markdown) {
  const blocks = markdown.split(/^## \[/gm).slice(1);
  return blocks.map(block => {
    const headerEnd = block.indexOf('\n');
    const header = block.slice(0, headerEnd).trim();
    const body = block.slice(headerEnd + 1);
    const date = header.split(']')[0]?.trim();
    const title = header.split(']').slice(1).join(']').trim();
    const commit = body.match(/\*\*Коммит:\*\*\s*`([^`]+)`/)?.[1] ?? 'unknown';
    const changed = body.match(/\*\*Что изменено:\*\*\s*(.+)/)?.[1]?.trim();
    const why = body.match(/\*\*Почему:\*\*\s*(.+)/)?.[1]?.trim();
    return {
      version: commit === 'N/A' || commit === 'pending' ? title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-|-$/g, '') : commit,
      date,
      title,
      changes: [changed, why].filter(Boolean),
      source: 'ai-changelog',
    };
  }).filter(item => item.date && item.title && item.changes.length);
}

const markdown = fs.readFileSync(changelogPath, 'utf8');
const entries = parseEntries(markdown).slice(0, 40);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(entries, null, 2)}\n`);
console.log(`Updated ${path.relative(root, outputPath)} with ${entries.length} entries`);
