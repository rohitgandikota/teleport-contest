// C vault.c:1120-1150, engraving disposal in both doorway branches.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const evidence = new URL('../../', import.meta.url);
const {runSegment} = await import(new URL('js/jsmain.js', root));
const {InMemoryStorage} = await import(new URL('js/storage.js', root));
const {Passes_walls} = await import(new URL('js/youprop.js', root));
const {in_rooms} = await import(new URL('js/hack.js', root));
const {VAULT, DOOR, CORR, STONE, THRONE, IS_WALL} = await import(new URL('js/const.js', root));
const {outputs, hashes, deferred} = await import(new URL('tools/half-damage-reader-observe.mjs', root));
const recipe = JSON.parse(fs.readFileSync(new URL('recipe.json', evidence)));
const lock = JSON.parse(fs.readFileSync(new URL('input-lock.json', evidence)));
assert.deepEqual(recipe.segments.map(s => Object.fromEntries(lock.inputFields.map(f =>
    [f, {present:Object.hasOwn(s,f), value:s[f]}]))), lock.tuples);
const outputPath = process.argv[2];
assert.equal(process.argv.length, 3, 'one new report path is required');
assert.ok(!fs.existsSync(outputPath));
const firstCarve = [175, 187, 169, null, 134];
const results = [], rows = [];
function check(name, fn) {
    try { fn(); results.push({name, pass:true}); }
    catch (error) { results.push({name, pass:false, error:error.message}); }
}
for (const [i, part] of recipe.segments.entries()) {
    const states = [];
    const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let observed;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g,step) {
            if (!g.level || !g.u || step < 65) return;
            const guard = g.level.monsters.find(m => m.isgd);
            const e = guard?.mextra?.egd;
            const ep = g.level.lev_engr?.find(e => e.x===27 && e.y===5);
            states.push({step, key:part.moves[step-1], turn:g.moves,
                hero:[g.u.ux,g.u.uy], inVault:!!in_rooms(g.u.ux,g.u.uy,VAULT),
                passWalls:Passes_walls(), top:g._toplines,
                guard:guard?{xy:[guard.mx,guard.my],end:e.fcend,done:e.gddone,peaceful:guard.mpeaceful}:null,
                at26:g.level.at(26,5).typ, at27:g.level.at(27,5).typ,
                engraving:ep?{text:ep.engr_txt,type:ep.engr_type}:null});
        }};
        observed = outputs(await runSegment({...part, storage:new InMemoryStorage()}));
    } finally {
        if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const plain = outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    const held = await deferred(part);
    const liveHashes = hashes(plain);
    check(part.name+': passive observation is neutral', () => assert.deepEqual(hashes(observed),liveHashes));
    check(part.name+': deferred input preserves all streams', () => assert.deepEqual(hashes(held),liveHashes));
    check(part.name+': all keys and random boundaries retained', () => {
        assert.equal(plain.screens.length,part.moves.length+1);
        assert.deepEqual(plain.slices.flat(),plain.calls);
    });
    const before = states.find(s => s.step === (firstCarve[i] ? firstCarve[i]-1 : part.moves.length));
    const after = firstCarve[i] ? states.find(s => s.step === firstCarve[i]) : null;
    check(part.name+': actual door and engraving producers', () => {
        assert.deepEqual(before.hero,[23,5]); assert.deepEqual(before.guard.xy,[25,5]);
        assert.equal(before.guard.end,1); assert.equal(before.guard.peaceful,1);
        assert.equal(before.passWalls,false);
        if (i===1) { assert.equal(before.at26,THRONE); assert.ok(IS_WALL(before.at27)); }
        else if (i===2) { assert.equal(before.at26,STONE); assert.equal(before.at27,THRONE); }
        else if (i<4) { assert.ok(IS_WALL(before.at26)); assert.equal(before.at27,THRONE); }
        if (i<4) assert.equal(before.engraving.text,'mar|');
        else assert.equal(before.engraving,null);
        if (after) {
            assert.deepEqual(after.hero,[24,5]); assert.equal(after.inVault,true);
            assert.deepEqual(after.guard.xy,[26,5]); assert.equal(after.guard.end,2);
            assert.equal(after.at26,i<2?DOOR:CORR);
        }
    });
    check(part.name+': C doorway cleanup or paired negative', () => {
        if (i<2) {
            assert.equal(after.engraving,null,'C deletes the engraving beyond the opened door');
            assert.equal(states.at(-1).engraving,null);
            assert.ok(!states.some(s=>s.top?.includes('Something is written here in the dust.')));
        } else if (i===2) {
            assert.equal(after.engraving.text,'mar|');
            assert.ok(states.some(s=>s.top?.includes('Something is written here in the dust.')));
        } else if (i===3) {
            assert.equal(before.engraving.text,'mar|'); assert.equal(before.guard.end,1);
        } else assert.equal(states.at(-1).engraving,null);
    });
    rows.push({name:part.name,keys:part.moves.length,boundaries:plain.screens.length,
        calls:plain.calls.length,hashes:liveHashes,deferredHashes:hashes(held),
        before,after,last:states.at(-1)});
}
const report = {classification:'Ordinary source controls; original C output is checked separately',
    passed:results.filter(r=>r.pass).length,total:results.length,results,rows};
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:results.filter(r=>!r.pass)}));
if (report.passed!==report.total) process.exitCode=1;
