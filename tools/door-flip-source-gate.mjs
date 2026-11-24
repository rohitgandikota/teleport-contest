#!/usr/bin/env node
// Pinned source witnesses only. This does not execute or instrument C.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const sources = [];
const bodies = new Map();
for (const [file, names] of Object.entries({
    sp_lev: ['flip_level'],
    shknam: ['shkinit'],
    restore: ['restmon', 'restmonchn'],
    shk: ['restshk', 'add_damage', 'shk_move'],
    priest: ['move_special'],
    wizcmds: ['wiz_flip_level']
})) {
    const path = `nethack-c/recorder/src/${file}.c`;
    const text = read(path);
    for (const name of names) {
        const match = text.match(new RegExp(`^${name}\\([^]*?^}`, 'm'));
        assert.ok(match, `${path}: ${name}`);
        bodies.set(`${file}.${name}`, match[0]);
        sources.push({ file: path, function: name,
            line: text.slice(0, match.index).split('\n').length,
            functionSha256: sha(match[0]), fileSha256: sha(text) });
    }
}
const checks = [];
const failures = [];
function check(name, fn) {
    try {
        fn();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message });
    }
}

check('C active door prefix uses the guarded coordinate transform', () => {
    assert.match(bodies.get('sp_lev.flip_level'),
        /for \(i = 0; i < gd\.doorindex; i\+\+\) \{\s*Flip_coord\(svd\.doors\[i\]\)/);
    const source = read('nethack-c/recorder/src/sp_lev.c');
    assert.match(source, /if \(\(cc\)\.x && inFlipArea\(\(cc\)\.x, \(cc\)\.y\)\)/);
});
check('C shop entrance is an embedded value coordinate', () => {
    assert.match(read('nethack-c/recorder/include/mextra.h'), /coord shd;/);
    assert.match(bodies.get('shknam.shkinit'), /eshkp->shd = svd\.doors\[sh\]/);
});
check('C restores each shopkeeper into a newly allocated eshk', () => {
    assert.match(bodies.get('restore.restmon'), /neweshk\(mtmp\);\s*Sfi_eshk\(nhfp, ESHK\(mtmp\)/);
    assert.match(bodies.get('restore.restmonchn'), /restshk\(mtmp, ghostly\)/);
});
check('C flips current and migrating shop entrances independently', () => {
    const body = bodies.get('sp_lev.flip_level');
    assert.equal((body.match(/Flip_coord\(ESHK\(mtmp\)->shd\)/g) || []).length, 2);
});
check('C entrance coordinates affect movement and damage scheduling', () => {
    assert.match(bodies.get('shk.shk_move'), /uondoor = u_at\(eshkp->shd\.x, eshkp->shd\.y\)/);
    assert.match(bodies.get('priest.move_special'), /mtmp->isshk && avoid && uondoor/);
    assert.match(bodies.get('priest.move_special'), /!rn2\(\+\+chcnt\)/);
    const body = bodies.get('shk.add_damage');
    assert.match(body, /x == ESHK\(mtmp\)->shd\.x && y == ESHK\(mtmp\)->shd\.y/);
    assert.match(body, /if \(!\*shops\)\s*return;/);
    assert.match(body, /svl\.level\.damagelist = tmp_dam/);
});
check('ordinary wizard command reaches the extras flip arm', () => {
    assert.match(bodies.get('wizcmds.wiz_flip_level'), /flip_level\(\(int\) c, TRUE\)/);
});
check('JS shop creation owns a separate coordinate', () => {
    assert.match(read('js/shknam.js'), /shd: \{ \.\.\.game\.level\.doors\[sh\] \}/);
});
check('JS restore normalizes historical JSON aliases without async work', () => {
    const source = read('js/shk.js');
    const body = source.match(/^export function restshk\([^]*?^}/m)?.[0];
    assert.ok(body);
    assert.match(body, /eshk\.shd = \{ \.\.\.eshk\.shd \}/);
    assert.ok(body.indexOf('eshk.shd =') < body.indexOf('if (!game.u.uz.dlevel)'));
    assert.doesNotMatch(body, /\bawait\b|\brn2\b|\brnd\b/);
});
check('JS current keeper and active door pass match the C owners', () => {
    const source = read('js/sp_lev.js');
    assert.match(source, /Flip_coord\(m\.eshk\?\.shd\)/);
    assert.match(source, /for \(let i = 0; i < game\.level\.doorindex; i\+\+\)\s*Flip_coord\(game\.level\.doors\[i\]\)/);
    assert.doesNotMatch(source, /eshk\.shd ALIASES/);
});
console.log(JSON.stringify({ evidence: 'static pinned C and JS source',
    passed: checks.length, total: checks.length + failures.length,
    functions: sources.length, checks, failures, sources }, null, 4));
if (failures.length)
    process.exitCode = 1;
