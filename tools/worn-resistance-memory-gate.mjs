#!/usr/bin/env node
// Removing gear lets observing monsters retry attacks the hero resisted.
// Compile C's property mapping; exercise both worn.c removal paths in JS.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import * as mondata from '../js/mondata.js';
import { couldsee } from '../js/vision.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { setworn, setnotworn } from '../js/worn.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import * as C from '../js/const.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(join(root, 'nethack-c/recorder/src/mondata.c'), 'utf8');
const fn = source.match(/^unsigned long\ncvt_prop_to_mseenres\([^]*?^}/m)?.[0];
assert.ok(fn);
const temp = mkdtempSync(join(tmpdir(), 'worn-memory-'));
let expected;
try {
    writeFileSync(join(temp, 'probe.c'), '#include "hack.h"\n' + fn
        + '\nint main(void) { for (int p=0; p<256; p++)'
        + ' printf("%lu\\n", cvt_prop_to_mseenres((uchar)p)); return 0; }\n');
    execFileSync('clang', ['-std=c99', '-I', join(root, 'nethack-c/recorder/include'),
        join(temp, 'probe.c'), '-o', join(temp, 'probe')]);
    expected = execFileSync(join(temp, 'probe'), [], { encoding: 'utf8' })
        .trim().split('\n').map(Number);
} finally {
    rmSync(temp, { recursive: true, force: true });
}

test('every byte-sized property maps to the same C resistance memory', () => {
    assert.equal(typeof mondata.cvt_prop_to_mseenres, 'function');
    assert.deepEqual(expected.map((_, prop) => mondata.cvt_prop_to_mseenres(prop)),
        expected);
});

const recipe = JSON.parse(readFileSync(join(root,
    'tools/gen-sessions/recipes/noun-inflection-inventory.json')));
const allSeen = expected.reduce((bits, next) => bits | next, 0);
async function setup() {
    const replay = await runSegment({ ...recipe.segments[0], moves: ' ',
        storage: new InMemoryStorage() });
    replay._display.onEmptyQueue = () => 0x1b;
    const { ux, uy } = game.u;
    const coords = [[ux + 1, uy], [ux - 1, uy], [ux, uy + 1], [ux, uy - 1]]
        .find(([x, y]) => couldsee(x, y));
    assert.ok(coords);
    assert.equal(couldsee(0, 0), false);
    const observer = { mnum: PMNAMES.PM_GNOME, data: game.mons[PMNAMES.PM_GNOME],
        mx: coords[0], my: coords[1], mhp: 30, mcansee: 1, seen_resistance: allSeen };
    const hidden = { ...observer, mx: 0, my: 0 };
    const dead = { ...observer, mhp: 0 };
    game.level.monsters = [observer, hidden, dead];
    return { observer, hidden, dead };
}

const gear = [
    ['CLOAK_OF_MAGIC_RESISTANCE', C.W_ARMC],
    ['RIN_FIRE_RESISTANCE', C.W_RINGL], ['RIN_COLD_RESISTANCE', C.W_RINGL],
    ['ORANGE_DRAGON_SCALES', C.W_ARM], ['BLACK_DRAGON_SCALES', C.W_ARM],
    ['RIN_POISON_RESISTANCE', C.W_RINGL], ['RIN_SHOCK_RESISTANCE', C.W_RINGL],
    ['YELLOW_DRAGON_SCALES', C.W_ARM], ['SHIELD_OF_REFLECTION', C.W_ARMS],
    ['MEAT_RING', C.W_RINGL],
];
const replacement = { [C.W_ARMC]: 'CLOAK_OF_PROTECTION', [C.W_ARM]: 'LEATHER_ARMOR',
    [C.W_RINGL]: 'RIN_ADORNMENT', [C.W_ARMS]: 'SMALL_SHIELD' };

for (const [name, mask] of gear) {
    for (const action of ['remove', 'lose', 'replace']) {
        test(`${action} ${name} clears only its observed defense`, async () => {
            const { observer, hidden, dead } = await setup();
            const obj = addinv(mksobj(ONAMES[name], false, false));
            const bits = expected[game.objects[obj.otyp].oc_oprop];
            setworn(obj, mask);
            assert.equal(observer.seen_resistance, allSeen);
            if (action === 'lose')
                setnotworn(obj);
            else
                setworn(action === 'replace'
                    ? addinv(mksobj(ONAMES[replacement[mask]], false, false)) : null, mask);
            assert.equal(observer.seen_resistance, allSeen & ~bits);
            assert.equal(hidden.seen_resistance, allSeen);
            assert.equal(dead.seen_resistance, allSeen);
        });
    }
}

for (const condition of ['invisible', 'underwater', 'swallowed', 'blind-monster']) {
    test(`${condition} follows C's observer guard`, async () => {
        const { observer } = await setup();
        const obj = addinv(mksobj(ONAMES.RIN_FIRE_RESISTANCE, false, false));
        setworn(obj, C.W_RINGL);
        if (condition === 'invisible') game.u.uprops.INVIS = C.W_ART;
        if (condition === 'underwater') game.u.uinwater = 1;
        if (condition === 'swallowed') game.u.uswallow = 1;
        if (condition === 'blind-monster') observer.mcansee = 0;
        setnotworn(obj);
        assert.equal(observer.seen_resistance,
            condition === 'blind-monster' ? allSeen & ~C.M_SEEN_FIRE : allSeen);
    });
}

test('another source of the same resistance does not suppress forgetting', async () => {
    const { observer } = await setup();
    const left = mksobj(ONAMES.RIN_FIRE_RESISTANCE, false, false);
    const right = mksobj(ONAMES.RIN_FIRE_RESISTANCE, false, false);
    setworn(left, C.W_RINGL);
    setworn(right, C.W_RINGR);
    setworn(null, C.W_RINGL);
    assert.equal(game.u.uprops.FIRE_RES, C.W_RINGR);
    assert.equal(observer.seen_resistance, allSeen & ~C.M_SEEN_FIRE);
});

for (const mask of [C.W_SWAPWEP, C.W_QUIVER]) {
    test(`ordinary removal skips slot ${mask}; destruction still clears memory`, async () => {
        const { observer } = await setup();
        const obj = mksobj(ONAMES.RIN_FIRE_RESISTANCE, false, false);
        setworn(obj, mask);
        setworn(null, mask);
        assert.equal(observer.seen_resistance, allSeen);
        setworn(obj, mask);
        setnotworn(obj);
        assert.equal(observer.seen_resistance, allSeen & ~C.M_SEEN_FIRE);
    });
}
