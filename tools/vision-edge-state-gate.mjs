// C vision.c:670-701 excludes column zero from night vision.
// These constructed edge controls complement the native toss-up fixture.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {game} from '../js/gstate.js';
import {set_levltyp} from '../js/mkmaze.js';
import {u_on_newpos} from '../js/teleport.js';
import {vision_reset, vision_recalc, cansee, couldsee} from '../js/vision.js';
import {COLNO, ROWNO, ROOM} from '../js/const.js';
import {setup} from './status-followup-test-setup.mjs';

for (const [x, y] of [[1, 0], [1, 7], [1, ROWNO - 1], [2, 7], [COLNO - 1, 7]]) {
    test(`night vision keeps valid adjacent squares at ${x},${y}`, async () => {
        await setup();
        assert.equal(game.u.nv_range, 1);
        assert.equal(game.u.xray_range, -1);
        const left = Math.max(1, x - 1), right = Math.min(COLNO - 1, x + 1);
        const top = Math.max(0, y - 1), bottom = Math.min(ROWNO - 1, y + 1);
        for (let xx = left; xx <= right; xx++) {
            for (let yy = top; yy <= bottom; yy++) {
                assert.ok(set_levltyp(xx, yy, ROOM));
                Object.assign(game.level.at(xx, yy), {lit:0, waslit:0, seenv:0});
            }
        }
        u_on_newpos(x, y);
        vision_reset();
        vision_recalc();
        for (let yy = top; yy <= bottom; yy++) {
            for (let xx = left; xx <= right; xx++)
                assert.ok(cansee(xx, yy), `adjacent square ${xx},${yy} remains visible`);
            if (x === 1) {
                assert.ok(couldsee(0, yy), 'the geometry still includes the boundary');
                assert.equal(cansee(0, yy), false, 'night vision excludes column zero');
            }
        }
        vision_recalc(2);
        assert.equal(cansee(x, y), false);
        vision_recalc();
        assert.ok(cansee(x, y));
    });
}
