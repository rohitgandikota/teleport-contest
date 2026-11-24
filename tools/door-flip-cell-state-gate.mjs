#!/usr/bin/env node
// C sp_lev.c:827-829,848-850 copies complete rm values at stable map addresses.
// Use actual ordinary inputs and bones decoding to obtain an omitted field.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { get_level_extends } from '../js/mklev.js';
import { flip_level } from '../js/sp_lev.js';
import { getRngLog } from '../js/rng.js';
import { ROOM, COLNO, ROWNO } from '../js/const.js';

const recipe = JSON.parse(fs.readFileSync(new URL(
    './gen-sessions/recipes/bones-shop-door-flip-damage.json', import.meta.url)));

for (const [name, orientation] of [['vertical', 1], ['horizontal', 2], ['both', 3]]) {
    test(`${name} flip moves absent memory and retains cell owners`, async () => {
        const storage = new InMemoryStorage();
        await runSegment({ ...recipe.segments[0], storage });
        await runSegment({ ...recipe.segments[1], storage,
            moves: recipe.segments[1].moves.slice(0, 44) });
        assert.ok(game.level.bonesinfo, 'actual bones load reached');
        const ext = get_level_extends();
        const minx = Math.max(1, ext.xmin);
        const maxx = Math.min(COLNO - 1, ext.xmax);
        const miny = Math.max(0, ext.ymin);
        const maxy = Math.min(ROWNO - 1, ext.ymax);
        let pair;
        for (let x = minx; x <= maxx && !pair; x++) {
            for (let y = miny; y <= maxy; y++) {
                const nx = orientation & 2 ? minx + maxx - x : x;
                const ny = orientation & 1 ? miny + maxy - y : y;
                const a = game.level.at(x, y);
                const b = game.level.at(nx, ny);
                if (a.typ === ROOM && a.remembered_glyph?.glyph?.kind === 'cmap'
                    && !Object.hasOwn(b, 'remembered_glyph')) {
                    pair = { x, y, nx, ny, a, b };
                    break;
                }
            }
        }
        assert.ok(pair, 'decoded floor memory has an unseen mirror partner');
        const { x, y, nx, ny, a, b } = pair;
        const memory = a.remembered_glyph;
        const rng = [...getRngLog()];
        await flip_level(orientation, true);
        assert.strictEqual(game.level.at(x, y), a, 'source map address retains its owner');
        assert.strictEqual(game.level.at(nx, ny), b, 'destination retains its owner');
        assert.equal(a.remembered_glyph, undefined, 'incoming absent value clears old memory');
        assert.strictEqual(b.remembered_glyph, memory, 'remembered floor moves to its mirror');
        assert.deepEqual(getRngLog(), rng);

        await flip_level(orientation, true);
        assert.strictEqual(a.remembered_glyph, memory, 'inverse flip returns the memory');
        assert.equal(b.remembered_glyph, undefined);
        assert.strictEqual(game.level.at(x, y), a);
        assert.strictEqual(game.level.at(nx, ny), b);
        assert.deepEqual(getRngLog(), rng);
    });
}
