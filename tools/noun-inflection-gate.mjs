#!/usr/bin/env node
// Compile the pinned C noun inflection functions with their actual tables.
// Compare both directions, including mixed case and compound suffixes.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import '../js/jsmain.js';
import { makeplural, makesingular, vtense } from '../js/objnam.js';
import { mons } from '../js/monst_data.js';
import { obj_descr } from '../js/objects_data.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const objnam = readFileSync(join(root, 'nethack-c/recorder/src/objnam.c'), 'utf8');
const hacklib = readFileSync(join(root, 'nethack-c/recorder/src/hacklib.c'), 'utf8');
const strutil = readFileSync(join(root, 'nethack-c/recorder/src/strutil.c'), 'utf8');
const role = readFileSync(join(root, 'nethack-c/recorder/src/role.c'), 'utf8');

function cFunction(source, name) {
    const match = source.match(new RegExp(
        '^([^\\n]+)\\n' + name + '\\([^]*?^}', 'm'));
    assert.ok(match, 'C function exists: ' + name);
    return match[0];
}
function cTable(source, name) {
    const match = source.match(new RegExp(
        '^.*\\b' + name + '\\[\\] = \\{[^]*?^};', 'm'));
    assert.ok(match, 'C table exists: ' + name);
    return match[0];
}
function cWords(source, name) {
    const table = source.match(new RegExp('\\b' + name + '\\[\\] = \\{([^]*?)\\};'));
    assert.ok(table, 'C word list exists: ' + name);
    return [...table[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
}

const groups = {
    branches: [
        'human', 'shaman', 'talisman', 'unhuman', 'snowman', 'caveman',
        'unman', 'specimen', 'abdomen', 'chairman', 'alga', 'larva', 'hypha',
        'amoeba', 'vertebra', 'serf', 'nerf', 'staff', 'wolf', 'roof', 'chief',
        'cliff', 'calf', 'baluchitherium', 'mycelium', 'lotus', 'wumpus', 'bus',
        'virus', 'analysis', 'gateau', 'bureau', 'matzo', 'matza', 'matzoh',
        'matzah', 'matzot', 'codex', 'index', 'spadix', 'cortex', 'monarch',
        'stomach', 'loch', 'epoch', 'church', 'witch', 'tomato', 'potato',
        'dingo', 'berry', 'key', 'ox', 'muskox', 'fox', 'box', 'mongoose',
        'slice', 'aircraft', 'craft', 'child', 'children', 'foot', 'feet',
        'knife', 'knives', 'mouse', 'mice', 'goose', 'geese', 'ya', 'silver ya',
        'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their',
        'x', '@', '3', 'enchanter +3', '  human  ', '  foot of a giant',
        'human  of the dungeon', 'pair of boots', 'pair of dancers',
        'mothers-in-law', 'lurkers above', 'nurses', 'cookies', 'pies',
        'harpies', 'genies', 'progenies', 'zombies', 'valkyries', 'cloves',
        'nerves', 'lenses', 'lens', 'glass', 'tengus', 'hezrous',
        'huMan', 'humaN', 'sNoWmAn', 'mOuSe', 'MouSE', 'WOLveS',
    ],
    monsters: mons.flatMap(mon => mon.pmnames || []).filter(Boolean),
    objects: obj_descr.flatMap(obj => [obj.oc_name, obj.oc_descr]).filter(Boolean),
    exceptions: [
        ...cWords(objnam, 'no_men').map(prefix => prefix + 'man'),
        ...cWords(objnam, 'no_man').map(prefix => prefix + 'men'),
        ...cWords(objnam, 'ch_k'),
        ...cWords(objnam, 'one_off'),
        ...cWords(objnam, 'as_is'),
    ].flatMap(word => [word, 'red ' + word, 'x' + word]),
};
for (const name of Object.keys(groups)) {
    assert.ok(groups[name].length, 'non-empty input group: ' + name);
    groups[name] = [...new Set(groups[name].flatMap(word => [
        word, word.toUpperCase(), word[0].toUpperCase() + word.slice(1),
    ]))];
}
groups.compounds = groups.branches.slice(0, 30).flatMap(word => [
    word + ' of mystery', word + ' named Mixed Case', word + '-in-law',
]);
const words = [...new Set(Object.values(groups).flat())];
const verbs = ['it', 'they', 'the invisible erinys', 'the teeth'].flatMap(subj =>
    ['are', 'Are', 'aRe', 'ARE', 'have', 'Have', 'fly', 'Fly', 'FLY', 'go']
        .map(verb => [subj, verb]));
const temp = mkdtempSync(join(tmpdir(), 'noun-inflection-'));
let plural, singular, verbResults;
try {
    const source = '#include "hack.h"\n'
        + '#define BSTRCMPI(base, ptr, str) ((ptr) < base || strcmpi((ptr), str))\n'
        + '#define BSTRNCMPI(base, ptr, str, n) ((ptr) < base || strncmpi((ptr), str, n))\n'
        + '#define Strcasecpy(dst, src) (void) strcasecpy(dst, src)\n'
        + 'const char vowels[] = "aeiouAEIOU";\n'
        + 'struct sing_plur { const char *sing, *plur; };\n'
        + 'static char *nextobuf(void) { static char buf[BUFSZ]; return buf; }\n'
        + 'void impossible(const char *fmt, ...) { (void)fmt; }\n'
        + 'void panic(const char *fmt, ...) { (void)fmt; abort(); }\n'
        + cFunction(strutil, 'Strlen_') + '\n'
        + cTable(role, 'genders') + '\n'
        + ['one_off', 'as_is', 'special_subjs'].map(n => cTable(objnam, n)).join('\n')
        + '\n' + ['letter', 'highc', 'lowc', 'eos', 'chrcasecpy', 'strcasecpy',
            'strncmpi'].map(n => cFunction(hacklib, n)).join('\n')
        + '\n' + ['badman', 'ch_ksound', 'singplur_compound', 'singplur_lookup',
            'makeplural', 'makesingular', 'vtense'].map(n => cFunction(objnam, n)).join('\n')
        + '\nint main(int argc, char **argv) { char buf[BUFSZ];\n'
        + 'while (fgets(buf, sizeof buf, stdin)) {\n'
        + 'buf[strcspn(buf, "\\n")] = 0;\n'
        + 'if (argc > 1 && !strcmp(argv[1], "verb")) {\n'
        + 'char *verb = strchr(buf, \'\\t\'); *verb++ = 0; puts(vtense(buf, verb));\n'
        + '} else puts(argc > 1 ? makesingular(buf) : makeplural(buf));\n'
        + '} return 0; }\n';
    writeFileSync(join(temp, 'probe.c'), source);
    execFileSync('clang', ['-std=c99', '-I', join(root, 'nethack-c/recorder/include'),
        join(temp, 'probe.c'), '-o', join(temp, 'probe')]);
    const run = (args, inputs = words) => execFileSync(join(temp, 'probe'), args,
        { input: inputs.join('\n') + '\n', encoding: 'utf8' }).slice(0, -1).split('\n');
    const plurals = run([]), singulars = run(['singular']);
    assert.equal(plurals.length, words.length);
    assert.equal(singulars.length, words.length);
    plural = new Map(words.map((word, i) => [word, plurals[i]]));
    singular = new Map(words.map((word, i) => [word, singulars[i]]));
    verbResults = run(['verb'], verbs.map(pair => pair.join('\t')));
} finally {
    rmSync(temp, { recursive: true, force: true });
}

test('shared case copying preserves 40 C verb conjugations', () => {
    for (let i = 0; i < verbs.length; i++)
        assert.equal(vtense(...verbs[i]), verbResults[i], verbs[i].join(' '));
});

for (const [name, inputs] of Object.entries(groups)) {
    for (const [operation, fn, expected] of [
        ['plural', makeplural, plural], ['singular', makesingular, singular],
    ]) {
        test(`${operation}: ${inputs.length} ${name} agree with compiled C`, () => {
            const mismatches = [];
            for (const word of inputs) {
                const actual = fn(word);
                if (actual !== expected.get(word))
                    mismatches.push({ word, actual, expected: expected.get(word) });
            }
            assert.equal(mismatches.length, 0,
                JSON.stringify({ count: mismatches.length, examples: mismatches.slice(0, 16) }));
        });
    }
}
