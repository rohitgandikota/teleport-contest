#!/usr/bin/env node
// Validate ordinary inputs in JS, or inspect a caller-supplied native recording.
// This command never records C, changes game state, or replaces a runtime module.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { branchAssertionErrors } from './gen-sessions/assertions.mjs';
import { decodeScreen } from './gen-sessions/screen-decode.mjs';

const manifest = JSON.parse(fs.readFileSync(
    new URL('./nexthere-order-native-cases.json', import.meta.url)
));
const [mode, id, file, ...extra] = process.argv.slice(2);
assert.ok(
    (mode === '--js' && !id) || (mode === '--native' && id && file && !extra.length),
    'usage: node tools/nexthere-order-native-gate.mjs --js | --native <case-id> <recording.json>'
);
const sample = manifest.cases.find(c => c.id === (mode === '--js' ? 'stone-flesh-restore' : id));
assert.ok(sample, 'known native case id');
const recipe = JSON.parse(fs.readFileSync(new URL(sample.recipe, import.meta.url)));

function checkScreens(segments) {
    assert.deepEqual(branchAssertionErrors(recipe, { segments }), [], 'recipe branch assertions');
    return sample.checkpoints.map(check => {
        const screen = segments[check.segment]?.steps[check.step]?.screen;
        assert.equal(typeof screen, 'string', check.name + ' screen exists');
        const rows = decodeScreen(screen).map(row => row.trim());
        const title = rows.indexOf('Things that are here:');
        assert.ok(title >= 0, check.name + ' pile title');
        const positions = check.items.map((_, i) => title + 1 + i);
        assert.deepEqual(
            rows.slice(title + 1, title + 1 + check.items.length),
            check.items,
            check.name + ' ordered pile lines'
        );
        assert.equal(rows[positions.at(-1) + 1], '--More--', check.name + ' complete pile list');
        return {
            name: check.name,
            segment: check.segment,
            step: check.step,
            rows: positions,
            items: check.items
        };
    });
}

if (mode === '--native') {
    const raw = fs.readFileSync(file);
    const session = JSON.parse(raw);
    const sha256 = createHash('sha256').update(raw).digest('hex');
    assert.equal(session.source, 'c', 'requires a native C recording');
    if (sample.recording) {
        assert.equal(sha256, sample.recording.sha256, 'retained original file hash');
    }
    assert.equal(session.segments.length, recipe.segments.length);
    for (const [index, part] of recipe.segments.entries()) {
        for (const key of ['seed', 'datetime', 'nethackrc', 'moves']) {
            assert.equal(session.segments[index][key], part[key], `segment ${index} ${key}`);
        }
    }
    console.log(JSON.stringify({
        case: sample.id,
        evidence: 'supplied-native-recording',
        sha256,
        checkpoints: checkScreens(session.segments)
    }, null, 2));
} else {
    // Start at the normal driver. No test loader or private export is needed.
    const { runSegment } = await import('../js/jsmain.js');
    const { InMemoryStorage } = await import('../js/storage.js');
    const { ONAMES } = await import('../js/objects_data.js');
    const names = Object.fromEntries(Object.entries(ONAMES).map(([name, type]) => [type, name]));
    const describe = objects => objects.map(obj => ({
        id: obj.o_id,
        type: names[obj.otyp],
        quan: obj.quan
    }));
    const storage = new InMemoryStorage();
    const segments = [];
    const states = [];
    assert.equal(globalThis.__step_snapshot, undefined, 'no existing observation hook');
    for (const [index, part] of recipe.segments.entries()) {
        const snapshots = new Map();
        globalThis.__step_snapshot = {
            step: '*',
            cb(game, step) {
                if (!sample.checkpoints.some(check => check.segment === index && check.step === step)) {
                    return;
                }
                const { ux: x, uy: y } = game.u;
                snapshots.set(step, {
                    position: [x, y],
                    turn: game.moves,
                    global: describe(game.level.objects),
                    globalAtHero: describe(game.level.objects.filter(obj => obj.ox === x && obj.oy === y)),
                    local: describe(game.level.objectsAt(x, y))
                });
            }
        };
        let result;
        try {
            result = await runSegment({ ...part, storage });
        } finally {
            delete globalThis.__step_snapshot;
        }
        const screens = result.getScreens();
        assert.equal(screens.length, part.moves.length + 1, `segment ${index} all input boundaries captured`);
        segments.push({ steps: screens.map(screen => ({ screen })) });
        states.push(snapshots);
        assert.equal(
            storage.getItem('save:wizard') !== null,
            index === 0,
            `segment ${index} save exists only between the two runs`
        );
    }
    const checkpoints = checkScreens(segments);
    for (const [index, check] of sample.checkpoints.entries()) {
        const state = states[check.segment].get(check.step);
        assert.ok(state, check.name + ' observation');
        assert.deepEqual(
            state.globalAtHero.map(obj => obj.type),
            check.globalTypesAtHero,
            check.name + ' global order'
        );
        assert.deepEqual(state.local.map(obj => obj.type), check.localTypes, check.name + ' local order');
        Object.assign(checkpoints[index], { globalAtHero: state.globalAtHero, local: state.local });
    }
    const before = states[0].get(sample.checkpoints[1].step);
    const after = states[1].get(sample.checkpoints[2].step);
    assert.deepEqual(after.global, before.global, 'restore preserves the entire global floor traversal');
    assert.deepEqual(after.position, before.position, 'restore returns to the same square');
    assert.equal(after.turn, before.turn, 'look and save/restore do not spend a turn');
    assert.deepEqual(after.local, [...before.local].reverse(), 'same two identities, opposite local order');
    const finalRows = decodeScreen(segments[1].steps.at(-1).screen).join('\n');
    assert.ok(
        !finalRows.includes('--More--') && !finalRows.includes('keep the save file?'),
        'restore proposal ends after acknowledging the pile list'
    );
    console.log(JSON.stringify({
        case: sample.id,
        evidence: 'JS-validated-inputs-native-C-verified',
        inputKeys: recipe.segments.map(part => part.moves.length),
        checkpoints,
        unchangedGlobalObjects: before.global.length
    }, null, 2));
}
