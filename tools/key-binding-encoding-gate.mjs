#!/usr/bin/env node
// Compile the pinned C parser and its string helpers, then compare its byte
// results with txt2key. Gameplay fixtures separately check command dispatch.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import * as options from '../js/options.js';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { cmdbind_get } from '../js/cmd.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const inputs = [
    '', ' ', '\tx\t', 'x', '^X', '^x', '^-x', 'C-x', 'cx', 'C-', '^?',
    'M', 'M-', 'M-x', 'mx', 'm-X', 'M-C-x', 'M-^x', 'M-^?', 'M-C-',
    'M-foo', '<enter>', '<space>', '<esc>', '<del>', '<ENTER>',
    '\\n', '\\t', '\\b', '\\r', '\\x21', '\\o101', '\\065', '\\mX',
    '\\M^V', '\\M', '\\', '\\^', '0', '12', '032', '160', '256', '999',
    '065tail', '12x', 'foo', "'x'", 'é', 'M-é', '\u00a0x',
];

function cFunction(source, name) {
    const match = source.match(new RegExp(
        '^([^\\n]+)\\n' + name + '\\([^]*?^}', 'm'));
    assert.ok(match, 'C function exists: ' + name);
    return match[0];
}

const temp = mkdtempSync(join(tmpdir(), 'key-binding-'));
let expected;
try {
    const opt = readFileSync(join(root, 'nethack-c/recorder/src/options.c'), 'utf8');
    const lib = readFileSync(join(root, 'nethack-c/recorder/src/hacklib.c'), 'utf8');
    const source = '#include "hack.h"\n'
        + 'const char hexdd[33] = "00112233445566778899aAbBcCdDeEfF";\n'
        + ['highc', 'eos', 'trimspaces'].map(name => cFunction(lib, name)).join('\n')
        + '\n' + cFunction(opt, 'escapes') + '\n' + cFunction(opt, 'txt2key')
        + '\nint main(int argc, char **argv) {\n'
        + 'for (int i = 1; i < argc; ++i) printf("%u\\n", txt2key(argv[i]));\n'
        + 'return 0;\n}\n';
    writeFileSync(join(temp, 'probe.c'), source);
    execFileSync('clang', ['-std=c99', '-I', join(root, 'nethack-c/recorder/include'),
        join(temp, 'probe.c'), '-o', join(temp, 'probe')]);
    expected = execFileSync(join(temp, 'probe'), inputs, { encoding: 'utf8' })
        .trim().split('\n').map(Number);
} finally {
    rmSync(temp, { recursive: true, force: true });
}

for (const [index, input] of inputs.entries()) {
    test(`txt2key matches C for ${JSON.stringify(input)}`, () => {
        assert.equal(options.txt2key(input), expected[index]);
    });
}

test('startup installs every encoded command key from the native recipe', async () => {
    const recipe = JSON.parse(readFileSync(new URL(
        'gen-sessions/recipes/binding-key-encodings.json', import.meta.url)));
    await runSegment({ ...recipe.segments[0], moves: ' ',
        storage: new InMemoryStorage() });
    for (const key of [248, 22, 126, 33, 150])
        assert.equal(cmdbind_get(key).cmd.ef_txt, 'versionshort');
});
