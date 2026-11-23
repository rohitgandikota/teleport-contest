#!/usr/bin/env node
// Source-derived naming guards; exact final menus have a separate C fixture.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {xname, minimal_xname, distant_name} from '../js/objnam.js';
import {mksobj} from '../js/mkobj.js';
import {cloak_simple_name} from '../js/do_wear.js';
import {ONAMES} from '../js/objects_data.js';
import {OBJ_INVENT, OBJ_FREE} from '../js/const.js';

async function setup() {
    await runSegment({
        seed:9785, datetime:'20000112093000', moves:' ',
        nethackrc:'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage:new InMemoryStorage(),
    });
    game.program_state_gameover = true;
}

test('minimal names suppress final text from objects with real identities', async () => {
    await setup();
    const shirt = mksobj(ONAMES.T_SHIRT, true, false);
    assert.ok(xname(shirt).includes(' with text '));
    assert.equal(minimal_xname(shirt), 'T-shirt');
    shirt.o_id = 0;
    assert.equal(xname(shirt), 'T-shirt');
});

for (const where of [OBJ_INVENT, OBJ_FREE]) {
    test(`distant naming suppresses final text and restores identity at location ${where}`, async () => {
        await setup();
        const shirt = mksobj(ONAMES.T_SHIRT, true, false);
        shirt.where = where;
        const id = shirt.o_id;
        assert.equal(distant_name(shirt, xname), 'T-shirt');
        assert.equal(shirt.o_id, id);
        assert.equal(game.distantname || 0, 0);
        assert.ok(xname(shirt).includes(' with text '));
    });
}

test('an empty candy wrapper does not add a label', async () => {
    await setup();
    const candy = mksobj(ONAMES.CANDY_BAR, true, false);
    candy.spe = 0;
    assert.equal(xname(candy), 'candy bar');
});

test('disclosing readable inventory preserves literacy conduct', async () => {
    await setup();
    const before = game.u.uconduct.literate;
    for (const type of [ONAMES.T_SHIRT, ONAMES.ALCHEMY_SMOCK,
                       ONAMES.HAWAIIAN_SHIRT, ONAMES.CANDY_BAR])
        xname(mksobj(type, true, false));
    assert.equal(game.u.uconduct.literate, before);
});

test('smock naming uses current discovery and observation state', async () => {
    await setup();
    const smock = mksobj(ONAMES.ALCHEMY_SMOCK, true, false);
    for (const known of [0, 1]) {
        game.objects[smock.otyp].oc_name_known = known;
        for (const seen of [0, 1]) {
            smock.dknown = seen;
            assert.equal(cloak_simple_name(smock), known && seen ? 'smock' : 'apron');
        }
    }
});
