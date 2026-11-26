// Fixed ordinary inputs. The observer only reads the two pits and guard state.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root = new URL('./', import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const read = name => JSON.parse(readFileSync(new URL(name, root)));
const lock = read('input-lock.json');
assert.equal(sha(readFileSync(import.meta.url.slice(7))), lock.probeSHA256);
const recipeBytes = readFileSync(new URL('recipe.json', root));
assert.equal(sha(recipeBytes), lock.recipeSHA256);
const recipe = JSON.parse(recipeBytes);
const runtimeBytes = readFileSync(new URL('baseline-runtime.json', root));
assert.equal(sha(runtimeBytes), lock.runtimeSHA256);
for (const [name, expected] of Object.entries(JSON.parse(runtimeBytes)))
    assert.equal(sha(readFileSync(new URL('baseline/' + name, root))), expected, name);
for (const [name, expected] of Object.entries(lock.sourcePins))
    assert.equal(sha(readFileSync(name)), expected, name);
const reportPath = new URL('baseline-observation.json', root);
assert.ok(!existsSync(reportPath));
const {runSegment} = await import('./baseline/js/jsmain.js');
const {InMemoryStorage} = await import('./baseline/js/storage.js');
const {PIT, IS_WALL, DIR_180} = await import('./baseline/js/const.js');
const {xytodir} = await import('./baseline/js/cmd.js');
const {outputs, hashes, deferred} = await import('./baseline/tools/half-damage-reader-observe.mjs');
const north = 1 << xytodir(0, -1);
const south = 1 << DIR_180(xytodir(0, -1));
assert.deepEqual([north, south], [4, 64]);
const rows = [];
for (const [index, part] of recipe.segments.entries()) {
    const states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            if (!g.level || g.u.uz.dnum !== 0 || g.u.uz.dlevel !== 2) return;
            const pit = (x,y) => {
                const trap = g.level.traps.find(t => t.tx === x && t.ty === y);
                return trap ? {type:trap.ttyp, conjoined:trap.conjoined || 0} : null;
            };
            const guard = g.level.monsters.find(m => m.isgd || m.mextra?.egd);
            const egd = guard?.mextra?.egd;
            states.push({step, turn:g.moves, hero:[g.u.ux,g.u.uy], hp:g.u.uhp,
                mortality:g.u.umortality || 0, targetType:g.level.at(23,4).typ,
                target:pit(23,4), survivor:pit(23,3),
                corridor:(egd?.fakecorr || []).slice(0,egd?.fcend)
                    .map(c => [c.fx,c.fy])});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const output = structuredClone(outputs(run));
    const streamHashes = hashes(output);
    const removed = states.findIndex((s,i) => i && states[i-1].target?.type === PIT
        && !s.target && IS_WALL(s.targetType));
    const before = removed > 0 ? states[removed-1] : null;
    const after = removed > 0 ? states[removed] : null;
    const checks = [];
    const check = (name, test) => {
        try { test(); checks.push({name,pass:true}); }
        catch (error) { checks.push({name,pass:false,error:error.message}); }
    };
    check('real pit pair before ordinary guard repair', () => {
        assert.equal(before?.target.type,PIT);
        assert.equal(before?.survivor.type,PIT);
        assert.equal(before.target.conjoined & north,index === 0 ? north : 0);
        assert.equal(before.survivor.conjoined & south,index === 0 ? south : 0);
    });
    check('wall repair removes only the boundary pit', () => {
        assert.ok(after && IS_WALL(after.targetType));
        assert.equal(after.target,null);
        assert.equal(after.survivor.type,PIT);
    });
    check('C deltrap clears the surviving reciprocal link', () => {
        assert.equal(after?.survivor.conjoined & south,0);
    });
    check('boundary remains outside the guard corridor', () => {
        assert.ok(states.every(s => !s.corridor.some(c => c[0] === 23 && c[1] === 4)));
    });
    check('all keys complete without death', () => {
        assert.equal(states.at(-1)?.step,part.moves.length);
        assert.ok(states.every(s => s.hp > 0 && s.mortality === 0));
        assert.equal(output.screens.length,part.moves.length+1);
        assert.deepEqual(output.slices.flat(),output.calls);
    });
    const plain = outputs(await runSegment({...part, storage:new InMemoryStorage()}));
    check('observer preserves all five output streams', () => assert.deepEqual(hashes(plain),streamHashes));
    const delayed = await deferred(part);
    check('deferred keys preserve all five output streams', () => assert.deepEqual(hashes(delayed),streamHashes));
    rows.push({name:part.name,checks,before,after,hashes:streamHashes,
        keys:part.moves.length,boundaries:output.screens.length,calls:output.calls.length,
        frames:output.frames.flat().length});
}
const report = {recipeSHA256:lock.recipeSHA256,runtimeSHA256:lock.runtimeSHA256,
    classification:'C-source state predictions with ordinary inputs; no native comparison yet',rows};
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const failures = rows.flatMap(r => r.checks.filter(c => !c.pass).map(c => ({case:r.name,...c})));
console.log(JSON.stringify({cases:rows.length,checks:rows.reduce((n,r) => n+r.checks.length,0),failures}));
if (failures.length) process.exitCode = 1;
