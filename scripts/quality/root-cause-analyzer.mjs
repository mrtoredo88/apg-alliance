import fs from 'node:fs';
import process from 'node:process';
import { groupRootCauses } from './core.mjs';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/quality/root-cause-analyzer.mjs <report.json>');
const report = JSON.parse(fs.readFileSync(source, 'utf8'));
const groups = groupRootCauses(report.findings || report.scans?.flatMap(scan => scan.findings || []) || []);
process.stdout.write(`${JSON.stringify({ symptoms: groups.reduce((sum, group) => sum + group.occurrences, 0), rootCauses: groups }, null, 2)}\n`);
