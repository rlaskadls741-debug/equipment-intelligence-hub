const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = ['source-part1.txt', 'source-part2.txt'].map(name => fs.readFileSync(path.join(root, name), 'utf8')).join('');
const patchContext = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'reader-updates.js'), 'utf8'), patchContext);
const updated = patchContext.window.DemoKitReaderUpdates.apply(source);
const scripts = [...updated.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const core = scripts.find(script => script.startsWith("(()=>{'use strict';\nconst T=JSON.parse"));
const end = core.indexOf('\n})();') + '\n})();'.length;
const fixture = {files: {'AutoDlg.cpp': {lines: 1511}, 'DemoKitDlg.cpp': {lines: 2000}}, functions: {}, dictionary: {function_ranges: []}};
const context = {window: {}, document: {getElementById: () => ({textContent: JSON.stringify(fixture)})}};
vm.runInNewContext(core.slice(0, end), context);
const parse = (...args) => JSON.parse(JSON.stringify(context.window.DemoKitCode.parseRange(...args)));

test('start line and count identify the intended inclusive selection', () => {
 assert.deepEqual(parse('500', 'AutoDlg.cpp', '20'), {file: 'AutoDlg.cpp', start: 500, end: 519});
 assert.deepEqual(parse('1510', 'AutoDlg.cpp', '20'), {file: 'AutoDlg.cpp', start: 1510, end: 1511});
 assert.deepEqual(parse('500', 'AutoDlg.cpp', '1'), {file: 'AutoDlg.cpp', start: 500, end: 500});
});

test('explicit ranges and file-qualified locations remain compatible', () => {
 assert.deepEqual(parse('500-519', 'AutoDlg.cpp', '4'), {file: 'AutoDlg.cpp', start: 500, end: 519});
 assert.deepEqual(parse('500+20', 'AutoDlg.cpp', '4'), {file: 'AutoDlg.cpp', start: 500, end: 519});
 assert.deepEqual(parse('demokitdlg.cpp:100-110', 'AutoDlg.cpp', '4'), {file: 'DemoKitDlg.cpp', start: 100, end: 110});
});

test('invalid start lines and counts return an error instead of a different selection', () => {
 for (const start of ['0', '1512', '500.5', 'word', '600-500']) assert.ok(parse(start, 'AutoDlg.cpp', '20').error, start);
 for (const count of ['', '0', '-1', '1.5', 'abc', '10001']) assert.ok(parse('500', 'AutoDlg.cpp', count).error, count);
 assert.ok(parse('500', 'Missing.cpp', '20').error);
});

test('reader changes preserve the complete embedded analysis and original C++ data', () => {
 const data = html => html.match(/<script[^>]*id="control-trace"[^>]*>([\s\S]*?)<\/script>/)[1];
 assert.equal(data(updated), data(source));
});
