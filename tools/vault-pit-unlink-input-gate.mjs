// Ordinary keyboard checks for C vault wall repair and reciprocal pit cleanup.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const evidence = new URL('gen-sessions/evidence/vault-pit-unlink/', import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const reportPath = process.argv[2] || null;
assert.ok(process.argv.length <= 3 && (!reportPath || !reportPath.startsWith('-')));
assert.ok(!reportPath || !existsSync(reportPath), 'report must be new');
const pins = {
    "source-input-lock.json": "00e282b6871734b4144676d8e782591882ab568542fb24cecc5fcac4c66cadef",
    "parent-input-lock.json": "48f3c0c153391fa4eec70302aa1316ef7c625c4b23516025eac6f152d406d053",
    "baseline-ordinary.json": "eccf54bfe40f935f52f32589fd3410f29b679e1537b46d0b7b63c621471f1637",
    "candidate-ordinary.json": "c5c8b964f7ac8df11046f13964011ca36558f96fe013e7f2b4461d29286a15d1",
    "native.json": "6c7ef7814ef840b08a0976d6ef54c9c7e0c440065350cd1bebcbe4f1a2da5e7b",
    "candidate-composition.json": "7c14c6c58bb327d101705603cf143dbadec30eac886ec7cc110cd3d05beb8310",
    "candidate-validation.json": "8e4f987b2a0c41b6871b0acc715a07a0a148b3d69b21c6d1df6252a9eb8a06f8",
    "recording.json": "1082d0a4f5a588535fa9c8dfd68ccc1cb03270561c454c971ada44d58cedd3d0",
    "minimal-input.json": "9ad260645d2b8f37dbc753f4084836fd4aa1f4f8c68f1fb2417edfd9b111e03d",
    "negative-hashes.json": "67663ece146008e365b5c6e745155b5ae435ab811df0eb42732bc65770adad66"
};
function read(name) {
    const bytes = readFileSync(new URL(name, evidence));
    assert.equal(sha(bytes), pins[name], name);
    return JSON.parse(bytes);
}
const lock = read('source-input-lock.json');
const beforeC = read('parent-input-lock.json');
const baseline = read('baseline-ordinary.json');
const recording = read('recording.json');
const negative = read('negative-hashes.json');
const recipeBytes = readFileSync(new URL('gen-sessions/recipes/vault-pit-unlink.json', import.meta.url));
assert.equal(sha(recipeBytes), lock.recipeSHA256);
assert.equal(sha(recipeBytes), beforeC.primaryRecipeSHA256);
const recipe = JSON.parse(recipeBytes);
const rawBytes = readFileSync(new URL('gen-sessions/generated/vault-pit-unlink.session.json', import.meta.url));
assert.equal(sha(rawBytes), 'e51ff4565cbb7f98f303a9f758ce83e82c9b8ea6848f7f3d9638c42f1b1690f6');
const raw = JSON.parse(rawBytes);
assert.equal(raw.source, 'c');
assert.equal(raw.version, 5);
assert.equal(raw.segments.length, 2);
assert.equal(recording.exit, 0);
assert.equal(recording.cExecutedOnce, true);
assert.equal(recording.rawSha256, sha(rawBytes));
assert.equal(recording.cPin, '16ff59115315917b93185d026aeefea06db9b0f4');
assert.equal(recording.binarySha256, 'ba4dbc1c823f8d4b0cfb6fd594d00ff0ff5754daaaa2036bee15baeffdf85aa7');
assert.equal(recording.recorderSha256, 'b129caee2ca3941b30c36f5c26644bd37ff610344332eb511c474b8709b70648');
assert.equal(recording.inputSHA256, beforeC.minimalInputSHA256);
assert.equal(recording.primaryRecipeSHA256, beforeC.primaryRecipeSHA256);
const tuple = s => ['name','seed','datetime','nethackrc','moves'].map(f => [f,Object.hasOwn(s,f),s[f]]);
assert.deepEqual(raw.segments.map(tuple), recipe.segments.map(tuple));
for (const [i, part] of recipe.segments.entries())
    assert.deepEqual(raw.segments[i].steps.map(s => s.key), [null,...part.moves]);
assert.deepEqual(recordingIntegrityErrors(raw), []);
assert.deepEqual(branchAssertionErrors(recipe, raw), []);
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {PIT, IS_WALL, DIR_180} = await import('../js/const.js');
const {xytodir} = await import('../js/cmd.js');
const {outputs, hashes, deferred} = await import('./half-damage-reader-observe.mjs');
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
const failures = rows.flatMap(r => r.checks.filter(c => !c.pass).map(c => ({case:r.name,...c})));
assert.deepEqual(rows[1], baseline.rows[1], 'complete unlinked control');
assert.deepEqual(rows[1].hashes, negative, 'five original negative hashes');
for (const [i,row] of rows.entries())
    assert.deepEqual(row.hashes, baseline.rows[i].hashes, 'state cleanup preserves terminal and random streams');
const report = {classification:'C-source state checks and unchanged native output',rows};
if (reportPath) writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:rows.length,checks:rows.reduce((n,r) => n+r.checks.length,0),failures}));
if (failures.length) process.exitCode = 1;
