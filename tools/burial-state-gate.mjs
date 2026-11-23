#!/usr/bin/env node
// C obtains the next floor object after unpunish frees the chain. These
// controls check both pile orders and the wizard command's cleanup bounds.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { punish } from '../js/read.js';
import { bury_objs } from '../js/dig.js';
import { find_lev_obj } from '../js/restore.js';
import { bind_key, rhack } from '../js/cmd.js';
import { engr_at, make_engr_at } from '../js/engrave.js';
import { ROOM, OBJ_FLOOR, OBJ_BURIED, OBJ_DELETED, TT_BURIEDBALL, DUST } from '../js/const.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/burial-command-effects.json', import.meta.url)));

async function start() {
    const replay = await runSegment({ ...recipe.segments[0], moves: ' \x1b',
        storage: new InMemoryStorage() });
    replay._display.onEmptyQueue = () => 27;
    game.u.ux = 30;
    game.u.uy = 10;
    for (let x = 29; x <= 32; x++)
        for (let y = 9; y <= 11; y++) {
            const loc = game.level.at(x, y);
            loc.typ = ROOM;
            loc.roomno = 0;
        }
}

for (const ballFirst of [false, true]) {
    test(`burying a ball ${ballFirst ? 'before' : 'after'} its chain never revives the freed chain`, async () => {
        await start();
        await punish(null);
        const ball = game.u.uball, chain = game.u.uchain;
        assert.equal(ball.where, OBJ_FLOOR);
        assert.equal(chain.where, OBJ_FLOOR);
        const others = game.level.objects.filter(obj => obj !== ball && obj !== chain);
        game.level.objects = [...(ballFirst ? [ball, chain] : [chain, ball]), ...others];
        await find_lev_obj();
        await bury_objs(30, 10);
        assert.equal(ball.where, OBJ_BURIED);
        assert.equal(chain.where, OBJ_DELETED);
        assert.ok(game.level.buriedobjs.includes(ball));
        assert.equal(game.level.buriedobjs.includes(chain), false);
        assert.equal(game.level.objects.includes(chain), false);
        assert.equal(game.u.uball, null);
        assert.equal(game.u.uchain, null);
        assert.equal(game.u.utraptype, TT_BURIEDBALL);
    });
}

test('wizard burial clears nearby engravings even when there are no objects', async () => {
    await start();
    for (const [x, y] of [[30, 10], [29, 9], [31, 11], [32, 10]])
        make_engr_at(x, y, 'Marker', null, game.moves, DUST);
    bind_key(126, 'wizbury');
    await rhack(126);
    for (const [x, y] of [[30, 10], [29, 9], [31, 11]])
        assert.equal(engr_at(x, y), null);
    assert.equal(engr_at(32, 10).engr_txt, 'Marker');
});
