#!/usr/bin/env node
// Native output assertions plus read-only JS ownership observations.
// Usage: node tools/restore-dormant-input-gate.mjs floor.json worm.json
// No runtime overrides, input callbacks, save edits or private exports.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { gamestate_decode, gamestate_encode } from '../js/save.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { m_at } from '../js/mon.js';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';
import { recordingIntegrityErrors } from './gen-sessions/assertions.mjs';

const paths = process.argv.slice(2);
assert.equal(paths.length, 2, 'supply the dormant floor and dormant worm native pairs');
const hash = value => createHash('sha256').update(value).digest('hex');
const calls = values => values.map(value => value.replace(/\s*@.*$/, '').trim());
const encodedHash = value => hash(JSON.stringify(gamestate_encode(value)));
const wormCoordinates = [[5, 13], [5, 14], [4, 15], [5, 15], [6, 15]];

function wormNodes(state, number) {
    const nodes = [];
    for (let node = state.wtails[number]; node; node = node.nseg) {
        assert.ok(!nodes.includes(node), 'worm chain has no cycle');
        nodes.push(node);
    }
    assert.equal(nodes.at(-1), state.wheads[number]);
    assert.deepEqual(nodes.map(node => [node.wx, node.wy]), wormCoordinates);
    return nodes;
}

function floorKnife(level) {
    const knives = level.objects.filter(object => object.otyp === ONAMES.CRYSKNIFE
        || object.otyp === ONAMES.WORM_TOOTH);
    assert.equal(knives.length, 1);
    const knife = knives[0];
    assert.equal(knife.otyp, ONAMES.WORM_TOOTH);
    assert.equal(knife.oerodeproof, 0);
    assert.deepEqual([knife.ox, knife.oy], [59, 6]);
    return knife;
}

function longWorm(level) {
    const worms = level.monsters.filter(monster => monster.mnum === PMNAMES.PM_LONG_WORM);
    assert.equal(worms.length, 1);
    const worm = worms[0];
    assert.equal(worm.wormno, 1);
    assert.equal(worm.mhp, 40);
    assert.deepEqual([worm.mx, worm.my], [6, 15]);
    return worm;
}

for (const [index, path] of paths.entries()) {
    const name = index === 0 ? 'dormant-floor' : 'dormant-worm';
    const original = readFileSync(path);
    const fixture = JSON.parse(original);
    assert.equal(fixture.segments.length, 2);
    assert.deepEqual(recordingIntegrityErrors(fixture), []);
    const nativeObservation = {};
    if (index === 0) {
        for (const [step, expected] of [[32, 'rn2(10)=2'], [44, 'rn2(10)=0']]) {
            const nativeCalls = fixture.segments[0].steps[step].rng
                .filter(call => call.includes('@ obj_no_longer_held'));
            assert.deepEqual(calls(nativeCalls), [expected]);
            nativeObservation[step === 32 ? 'drop' : 'save'] = nativeCalls;
        }
        assert.equal(decodeScreen(fixture.segments[0].steps[37].screen)[0].trim(),
            'You see here a crysknife.');
        // The final look is away from the knife. Do not call it a native type assertion.
        assert.equal(decodeScreen(fixture.segments[1].steps[8].screen)[0].trim(),
            'You see no objects here.');
    } else {
        const grid = decodeScreen(fixture.segments[1].steps[47].screen);
        assert.ok(grid[0].startsWith('You sense the presence of monsters.'));
        // Map coordinates (x,y) are terminal columns/rows (x-1,y+1).
        const glyphs = wormCoordinates.map(([x, y]) => grid[y + 1][x - 1]);
        assert.deepEqual(glyphs, ['~', '~', '~', '~', 'w']);
        nativeObservation.detectedCells = wormCoordinates.map(([x, y], cell) => ({
            gameX: x, gameY: y, glyph: glyphs[cell]
        }));
    }

    const storage = new InMemoryStorage();
    let saved;
    let dormant;
    let savedHash;
    let storedOwner;
    let storedNodes;
    let boundaries = 0;
    let count = 0;
    const ownership = {};
    for (const [segment, part] of fixture.segments.entries()) {
        const replay = await runSegment({ ...part, storage });
        boundaries += replay.getScreens().length;
        count += replay.getRngLog().length;
        assert.deepEqual(calls(replay.getRngLog()),
            calls(part.steps.flatMap(step => step.rng || [])));
        if (segment === 0) {
            const bytes = storage.getItem(`save:${game.plname}`);
            assert.ok(bytes);
            saved = gamestate_decode(JSON.parse(bytes));
            savedHash = encodedHash(saved);
            assert.equal(saved._save_version, 1);
            assert.deepEqual(saved.u.uz, { dnum: 0, dlevel: 2 });
            dormant = saved.saved_levels.get('0:1');
            assert.ok(dormant);
            assert.equal(dormant._saved_format, 1);
            assert.notEqual(dormant, saved.level);
            if (index === 0) {
                storedOwner = floorKnife(dormant);
                ownership.savedObject = { id: storedOwner.o_id,
                    type: storedOwner.otyp, fixed: storedOwner.oerodeproof };
            } else {
                storedOwner = longWorm(dormant);
                storedNodes = wormNodes(dormant._saved_worms, storedOwner.wormno);
                assert.equal(Object.keys(saved.level._saved_worms.wtails).length, 0);
                ownership.savedWorm = { id: storedOwner.m_id,
                    number: storedOwner.wormno, nodes: storedNodes.length };
            }
        } else {
            assert.deepEqual(game.u.uz, { dnum: 0, dlevel: 1 });
            assert.notEqual(game.level, dormant);
            assert.equal(storage.getItem(`save:${game.plname}`), null);
            if (index === 0) {
                const live = floorKnife(game.level);
                assert.notEqual(live, storedOwner);
                assert.equal(live.o_id, storedOwner.o_id);
                assert.equal(game.level.objectAt(live.ox, live.oy), live);
                ownership.returnedObject = { id: live.o_id,
                    type: live.otyp, fixed: live.oerodeproof };
            } else {
                const live = longWorm(game.level);
                const nodes = wormNodes(game.worms, live.wormno);
                assert.notEqual(live, storedOwner);
                assert.equal(live.m_id, storedOwner.m_id);
                for (const [position, node] of nodes.entries()) {
                    assert.notEqual(node, storedNodes[position]);
                    assert.equal(m_at(node.wx, node.wy), live);
                }
                ownership.returnedWorm = { id: live.m_id,
                    number: live.wormno, nodes: nodes.length };
            }
            assert.equal(encodedHash(saved), savedHash,
                'observing the independently decoded saved graph does not mutate it');
        }
    }
    assert.equal(boundaries, index === 0 ? 55 : 88);
    assert.equal(count, index === 0 ? 6949 : 5042);
    assert.equal(hash(readFileSync(path)), hash(original));
    console.log(JSON.stringify({ name, originalSha256: hash(original), boundaries,
        rngCalls: count, nativeObservation, jsOwnership: ownership, pass: true }));
}
