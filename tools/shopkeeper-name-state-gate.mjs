#!/usr/bin/env node
// src/shk.c make_angry_shk() uses Shknam even without visibility. Its
// hallucination draws are part of gameplay RNG, not just display styling.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { make_angry_shk } from '../js/shk.js';
import { Shknam } from '../js/shknam.js';
import { ESHK } from '../js/const.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';

const segment = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/shop-normal.json', import.meta.url))).segments[0];

for (const hallucinating of [false, true]) {
    test(`shopkeeper anger uses the canonical name, hallucination=${hallucinating}`, async () => {
        const replay = await runSegment({ ...segment, storage: new InMemoryStorage() });
        replay._display.onEmptyQueue = () => 0x20;
        const shkp = game.level.monsters.find(mon => mon.isshk);
        assert.ok(shkp);
        ESHK(shkp).shknam = '+izchak';
        shkp.mpeaceful = 1;
        game.u.uprops.HALLUC = hallucinating ? 100 : 0;
        initRng(71);
        enableRngLog();
        const expectedName = Shknam(shkp);
        const expectedDraws = [...getRngLog()];
        if (!hallucinating) assert.equal(expectedName, 'Izchak');
        else assert.ok(expectedDraws.length > 0);

        initRng(71);
        enableRngLog();
        game._toplines = '';
        game._msg_history = [];
        await make_angry_shk(shkp, game.u.ux, game.u.uy);
        assert.equal(game._toplines, `${expectedName} gets angry!`);
        assert.deepEqual(getRngLog(), expectedDraws);
        assert.equal(shkp.mpeaceful, 0);
    });
}
