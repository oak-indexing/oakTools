#!/usr/bin/env node
// Recursively runs validateDiffIndex (docs/js/diffIndexVerifier.js) against every
// *.json file under a directory tree and reports any failures.
//
// Usage:
//   node scripts/verifyDiffIndexDir.js <directory> [--pattern=_diff.index.json]
//
// Exit code is non-zero if any file fails validation or fails to parse,
// so this can be wired into cron/CI to alert on regressions.

const fs = require('fs');
const path = require('path');
const { validateDiffIndex } = require('../docs/js/diffIndexVerifier.js');

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--'));
const patternArg = args.find(a => a.startsWith('--pattern='));
const suffix = patternArg ? patternArg.slice('--pattern='.length) : '.json';

if (!dir) {
    console.error('Usage: node scripts/verifyDiffIndexDir.js <directory> [--pattern=_diff.index.json]');
    process.exit(2);
}

function findFiles(root) {
    const results = [];
    const stack = [root];
    while (stack.length) {
        const current = stack.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(full);
            } else if (entry.isFile() && entry.name.endsWith(suffix)) {
                results.push(full);
            }
        }
    }
    return results.sort();
}

const files = findFiles(dir);
let failureCount = 0;

for (const file of files) {
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        failureCount++;
        console.log(`\n${file}`);
        console.log(`  PARSE ERROR: ${e.message}`);
        continue;
    }

    const lines = validateDiffIndex(parsed);
    const failLines = lines.filter(l => l.includes('FAIL'));
    if (failLines.length > 0) {
        failureCount++;
        console.log(`\n${file}`);
        for (const l of failLines) {
            console.log(`  ${l.replace(/\n/g, '\n  ')}`);
        }
    }
}

console.log(`\nChecked ${files.length} file(s), ${failureCount} with failures.`);
process.exit(failureCount > 0 ? 1 : 0);
