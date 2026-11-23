#!/usr/bin/env node
// Pinned pray.c eligibility and divine-response predicates, including the
// demon condition whose implementation disagrees with its C comment.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { can_pray, dopray } from '../js/pray.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { A_NONE, A_LAWFUL, A_NEUTRAL, A_CHAOTIC, ALTAR, Align2amask,
         FROMOUTSIDE, ECMD_TIME } from '../js/const.js';

const segment = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/recorder-meta-keys.json', import.meta.url))).segments[0];

async function setup() {
    const replay = await runSegment({ ...segment, moves: ' ',
        storage: new InMemoryStorage() });
    let extraKeys = 0;
    replay._display.onEmptyQueue = () => {
        assert.ok(++extraKeys < 100, 'divine response must finish');
        return 0x1b;
    };
    game.flags.paranoia_bits = 0;
    game.wizard = false;
    game.u.ublesscnt = 0;
    game._toplines = game._pending_message = '';
    game._msg_history = [];
    game._toplin = 0;
}

async function finishPrayer(seed = 1) {
    assert.equal(await dopray(), ECMD_TIME);
    initRng(seed);
    enableRngLog();
    await game.afternmv();
}

function messages() {
    return [...game._msg_history, game._toplines].join('\n');
}

for (const [baseLuck, cursed, eligible] of [[-1, false, true], [1, true, false]]) {
    test(`prayer eligibility includes the carried luckstone, cursed=${cursed}`, async () => {
        await setup();
        const stone = mksobj(ONAMES.LUCKSTONE, false, false);
        stone.blessed = !cursed;
        stone.cursed = cursed;
        await addinv(stone);
        game.u.uluck = baseLuck;
        assert.equal(game.u.moreluck, cursed ? -3 : 3);
        assert.equal(can_pray(false), eligible);
    });
}

for (const alignment of [A_LAWFUL, A_NEUTRAL, A_CHAOTIC, A_NONE]) {
    test(`demon prayer follows the pinned condition, altar alignment=${alignment}`, async () => {
        await setup();
        game.u.umonnum = PMNAMES.PM_HORNED_DEVIL;
        game.youmonst.data = game.mons[PMNAMES.PM_HORNED_DEVIL];
        const square = game.level.at(game.u.ux, game.u.uy);
        square.typ = ALTAR;
        square.altarmask = Align2amask(alignment);
        assert.equal(can_pray(false), alignment === A_NEUTRAL);
    });
}

for (const [baseLuck, bonus, record, anger, range] of [
    [1, 3, 0, 3, 8],
    [-2, -3, 0, 1, 8],
    [-3, 0, 4, 1, 4],
]) {
    test(`divine anger uses effective Luck and the STRIDENT threshold, range=${range}, bonus=${bonus}`, async () => {
        await setup();
        game.u.uluck = baseLuck;
        game.u.moreluck = bonus;
        game.u.ualign.record = record;
        game.u.ugangr = anger;
        await finishPrayer();
        assert.ok(getRngLog()[0].startsWith(`rn2(${range})=`));
    });
}

for (const angry of [false, true]) {
    for (const resistant of [false, true]) {
        test(`divine mood respects hallucination resistance, angry=${angry}, resistant=${resistant}`, async () => {
            await setup();
            game.u.ualign.record = angry ? -1 : 4;
            game.u.intrinsic.HHallucination = game.u.uprops.HALLUC = 100;
            game.u.intrinsic.HHalluc_resistance = resistant ? FROMOUTSIDE : 0;
            await finishPrayer();
            const mood = angry
                ? (resistant ? 'displeased' : 'bummed')
                : (resistant ? 'pleased' : 'ticklish');
            assert.ok(messages().includes(`Thoth is ${mood}.`));
        });
    }
}

for (const protection of ['none', 'blind', 'antimagic']) {
    test(`divine curse glow respects ${protection}`, async () => {
        await setup();
        game.u.ugangr = 3;
        if (protection === 'blind') game.u.intrinsic.HBlinded = 20;
        if (protection === 'antimagic') game.u.intrinsic.HAntimagic = FROMOUTSIDE;
        await finishPrayer(5); // rn2(9)=4 selects divine cursing
        assert.equal(getRngLog()[0], 'rn2(9)=4');
        assert.equal(messages().includes('glow surrounds you'), protection === 'none');
    });
}
