import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {runSegment} from '../../js/jsmain.js';
import {InMemoryStorage} from '../../js/storage.js';
import {game} from '../../js/gstate.js';
import {goto_level} from '../../js/do.js';
import {outputs, hashes} from '../half-damage-reader-observe.mjs';

const recipe = JSON.parse(readFileSync(new URL('../gen-sessions/recipes/level-change-trap-reset.json', import.meta.url)));
const results = [];
const timer = setTimeout(() => process.exit(2), 55000);
for (const kind of ['same level', 'real departure', 'departure with forced bungle']) {
    const result = {name: kind, classification: 'constructed public-owner call after ordinary producer'};
    try {
        const part = {...recipe.segments[0], moves: recipe.segments[0].moves.slice(0, 31)};
        const run = await runSegment({...part, storage: new InMemoryStorage()});
        const info = game.trapinfo, trap = info.tobj, level = game.level;
        assert.equal(trap?.o_id, 34);
        assert.equal(info.time_needed, 4);
        assert.equal(game.occupation, null);
        const before = {xy: [game.u.ux, game.u.uy], tx: info.tx, ty: info.ty,
            time: info.time_needed, outputs: hashes(outputs(run))};
        if (kind === 'departure with forced bungle') info.force_bungle = 1;
        if (kind === 'same level') {
            await goto_level({...game.u.uz}, false, false, 0);
            assert.equal(game.level, level);
            assert.equal(info.tobj, trap);
            assert.deepEqual([game.u.ux, game.u.uy], before.xy);
            assert.deepEqual(hashes(outputs(run)), before.outputs);
        } else {
            game.nhDisplay.pushKey(32);
            await goto_level({dnum: 0, dlevel: 2}, false, false, 0);
            assert.equal(game.u.uz.dlevel, 2);
            assert.equal(info.tobj, 0);
            assert.equal(info.force_bungle, 0);
            assert.ok(game.invent.includes(trap), 'the actual trap object remains carried');
        }
        assert.equal(game.trapinfo, info, 'reset updates the existing context');
        assert.deepEqual([info.tx, info.ty, info.time_needed], [before.tx, before.ty, before.time]);
        result.pass = true;
    } catch (error) { result.pass = false; result.error = error.message.slice(0, 700); }
    results.push(result);
}
clearTimeout(timer);
const report = {classification: 'constructed owner controls, no native claim', total: 3,
    passed: results.filter(r => r.pass).length, results};
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(report));
if (report.passed !== report.total) process.exitCode = 1;
