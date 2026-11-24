// Ordinary command producers only. This gate does not create a native oracle.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { ONAMES as O } from '../js/objects_data.js';
import { G_GENOD } from '../js/const.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import tags from './gen-sessions/coverage-requirements.json' with { type: 'json' };
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/monster-growth-callback.json', import.meta.url)));

test('proposal contains both named ordinary inputs and registered coverage categories', () => {
    assert.equal(recipe.segments.length, 2);
    const registered = new Set(tags.requirements.map(r => r.id));
    for (const category of recipe.coverage) assert.ok(registered.has(category), category);
    for (const segment of recipe.segments) {
        assert.deepEqual(Object.keys(segment).sort(), ['datetime', 'moves', 'name', 'nethackrc', 'seed']);
        assert.ok(segment.moves.includes('\u0017uncursed scroll of genocide\r'));
        assert.ok(segment.moves.includes('\u0007tame killer bee\r'));
        assert.ok(segment.moves.includes('\u0017uncursed lump of royal jelly\r'));
        assert.ok(segment.moves.includes('dbh'));
    }
});

for (const [index, segment] of recipe.segments.entries()) {
    test(`${segment.name}: real food and growth producers complete`, async () => {
        const rows = [], previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        let replay;
        try {
            globalThis.__step_snapshot = { step: '*', cb(g, step) {
                const bee = g.level?.monsters.find(m => m.mnum === P.PM_KILLER_BEE && m.mtame);
                const queen = g.level?.monsters.find(m => m.mnum === P.PM_QUEEN_BEE);
                const jelly = g.level?.objects.find(o => o.otyp === O.LUMP_OF_ROYAL_JELLY);
                rows.push({ step, bee: bee && { id:bee.m_id, hp:bee.mhp, xy:[bee.mx,bee.my] },
                    queen: queen && { id:queen.m_id, hp:queen.mhp, tame:queen.mtame },
                    jelly: jelly && { id:jelly.o_id, xy:[jelly.ox,jelly.oy] },
                    flags:g.mvitals?.[P.PM_QUEEN_BEE].mvflags,
                    deaths:g.mvitals?.[P.PM_QUEEN_BEE].died });
            } };
            replay = await runSegment({ ...segment, storage: new InMemoryStorage() });
        } finally {
            if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
            else delete globalThis.__step_snapshot;
        }
        assert.equal(replay.getScreens().length, segment.moves.length + 1);
        const created = rows.find(row => row.bee);
        assert.ok(created && created.bee.hp > 0);
        assert.equal(!!(created.flags & G_GENOD), index === 0);
        assert.ok(rows.some(row => row.jelly), 'real dropped jelly exists before the meal');
        const last = rows.at(-1);
        assert.equal(last.bee, undefined); assert.equal(last.jelly, undefined);
        if (index === 0) {
            assert.ok(rows.some(row => row.bee && row.jelly
                && row.bee.xy[0] === row.jelly.xy[0] && row.bee.xy[1] === row.jelly.xy[1]),
                'ordinary pet displacement places the bee on the jelly');
            assert.equal(last.queen, undefined); assert.equal(last.deaths, 1);
        } else {
            assert.equal(last.queen.id, created.bee.id);
            assert.ok(last.queen.hp > 0 && last.queen.tame);
            assert.equal(last.deaths, 0);
        }
        const text = replay.getScreens().map(screen => decodeScreen(screen)
            .map(row => row.map(cell => cell.ch).join('')).join('\n')).join('\n');
        for (const value of recipe.branchAssertions[index].screenIncludes)
            assert.ok(text.includes(value), value);
        for (const value of recipe.branchAssertions[index].screenExcludes)
            assert.ok(!text.includes(value), value);
    });
}
