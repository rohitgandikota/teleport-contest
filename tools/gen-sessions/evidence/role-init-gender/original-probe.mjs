// One source-only batch, after original assertions and input tuples are locked.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root = new URL('./',import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => JSON.parse(readFileSync(new URL(name,root)));
const lock = read('input-lock.json');
assert.equal(lock.beforeGameplayAndCandidate,true);
for (const [name,digest] of Object.entries(lock.files))
    assert.equal(sha(readFileSync(new URL(name,root))),digest,name);
assert.equal(sha(readFileSync(new URL('probe.mjs',root))),lock.probeSHA256);
const recipe = read('recipe.json'), predictions = read('predictions.json');
const tuple = part => lock.fields.map(field => ({field,present:Object.hasOwn(part,field),
    ...(Object.hasOwn(part,field) ? {value:part[field]} : {})}));
assert.deepEqual(recipe.segments.map(tuple),lock.tuples);
assert.equal(sha(JSON.stringify(lock.tuples)),lock.tuplesSHA256);
assert.equal(sha(JSON.stringify(recipe.segments.map(part => [null,...part.moves]))),lock.allKeysSHA256);
assert.deepEqual(lock.negativeIndexes,[1,2,3]);
for (const item of read('source-pins.json').files)
    assert.equal(sha(readFileSync(new URL(item.path,root))),item.sha256,item.path);
const runtimeBytes = readFileSync(new URL('baseline-runtime.json',root));
assert.equal(sha(runtimeBytes),'54f4253995ebeaa653f714780ee49347d94f242d5a61b15ce4e6a4c8aff64388');
const runtime = JSON.parse(runtimeBytes);
function verifyRuntime() {
    assert.equal(Object.keys(runtime).length,280);
    for (const [name,digest] of Object.entries(runtime))
        assert.equal(sha(readFileSync(new URL(name,root))),digest,name);
}
verifyRuntime();
const {runSegment} = await import('./js/jsmain.js');
const {InMemoryStorage} = await import('./js/storage.js');
const {decodeScreen,renderCell} = await import('./frozen/screen-decode.mjs');
const {outputs,hashes,hash,deferred} = await import('./tools/half-damage-reader-observe.mjs');

const rows = [];
for (const [index,part] of recipe.segments.entries()) {
    const p = predictions[index], states = [], checks = [];
    const check = (name,body) => {
        try {body();checks.push({name,pass:true});}
        catch(error) {checks.push({name,pass:false,error:error.message});}
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run,runError;
    try {
        globalThis.__step_snapshot = {step:'*',cb(g,step) {
            if (!g.u || !g.level || !g.urole) return;
            states.push({step,turn:g.moves,level:g.u.ulevel,hp:g.u.uhp,mortality:g.u.umortality || 0,
                xy:[g.u.ux,g.u.uy],dungeon:{...g.u.uz},wizard:!!g.wizard,
                initrole:g.flags.initrole,initrace:g.flags.initrace,initalign:g.flags.initalign,
                initgend:g.flags.initgend,initgendType:typeof g.flags.initgend,
                female:g.flags.female,femaleType:typeof g.flags.female,
                rcGender:g.rc.opts.gender,roleName:g.urole.name.m,raceName:g.urace.noun,
                genderMask:g.urole.allow & 0xf000,pantheon:g.pantheon,
                gods:[g.urole.lgod,g.urole.ngod,g.urole.cgod],
                inventoryCount:g.invent.length,gameover:!!g.program_state?.gameover,
                parserErrors:[...g.rc.errors],unhandled:[...g.rc.unhandled]});
        }};
        run = await runSegment({...part,storage:new InMemoryStorage()});
    } catch(error) {runError=error.stack;}
    finally {
        if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    const out = run ? outputs(run) : null;
    const screens = out?.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd())) || [];
    const text = screens.map(lines => lines.join('\n'));
    const first = states[0], last = states.at(-1);
    check('real startup identity and initial rank',() => {
        assert.ok(first);
        assert.equal(first.initrole,p.roleIndex);assert.equal(first.initrace,p.raceIndex);
        assert.equal(first.initalign,p.alignmentIndex);assert.equal(first.roleName,p.role);
        assert.equal(first.raceName,'human');assert.equal(first.rcGender,p.inputGender);
        assert.equal(first.genderMask,p.genderMask);
        assert.ok(text.some(t => t.includes(p.firstRank)));
        assert.ok(states.every(s => !s.parserErrors.length && !s.unhandled.length));
    });
    check('C newgame gender flags are valid from the first gameplay row',() => {
        assert.equal(first.initgend,p.expectedInitgend);
        assert.equal(first.female,p.expectedFemale);
        assert.equal(first.initgendType,'number');assert.equal(first.femaleType,'boolean');
        assert.ok(first.genderMask & (first.initgend === 1 ? 0x2000 : 0x1000));
    });
    check('newgame owns its pantheon and starts at level one',() => {
        assert.equal(first.level,1);assert.equal(first.pantheon,p.roleIndex);
        assert.ok(first.gods.every(Boolean));assert.ok(first.wizard);
        assert.ok(states.every(s => s.pantheon === first.pantheon
            && JSON.stringify(s.gods) === JSON.stringify(first.gods)));
    });
    check('real levelchange input reaches experience level thirty',() => {
        assert.equal(last.level,30);
        assert.ok(text.some(t => t.includes('To what experience level do you want to be set?')));
        assert.ok(text.some(t => t.includes('Welcome to experience level 30.')));
        assert.ok(states.some(s => s.level === 10));
    });
    check('C intermediate gendered rank is actually rendered',() => {
        assert.ok(screens.some(lines => lines[22]?.includes(p.genderedRank)),p.genderedRank);
    });
    check('C final rank is actually rendered',() => {
        assert.ok(screens.some(lines => lines[22]?.includes(p.finalRank)),p.finalRank);
    });
    check('initial gender fields stay stable through the real producer',() => {
        assert.ok(states.every(s => s.initgend === first.initgend && s.female === first.female));
        assert.ok(states.every(s => s.initrole === first.initrole && s.initrace === first.initrace));
    });
    check('no movement death or weapon producer is involved',() => {
        assert.ok(states.every(s => s.hp > 0 && !s.mortality && !s.gameover));
        assert.ok(states.every(s => JSON.stringify(s.xy) === JSON.stringify(first.xy)));
        assert.ok(states.every(s => s.inventoryCount === 0));
    });
    check('every input boundary and RNG slice is retained',() => {
        assert.equal(runError,undefined);
        assert.equal(last.step,part.moves.length);
        for (const name of ['screens','cursors','slices','frames'])
            assert.equal(out[name].length,part.moves.length+1,name);
        assert.deepEqual(out.slices.flat(),out.calls);
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    });
    let plainHashes,plainError;
    try {plainHashes=hashes(outputs(await runSegment({...part,storage:new InMemoryStorage()})));}
    catch(error) {plainError=error.stack;}
    check('passive observer preserves all five output streams',() => {
        assert.equal(plainError,undefined);assert.deepEqual(plainHashes,hashes(out));
    });
    let deferredHashes,deferredError;
    try {deferredHashes=hashes(await deferred(part));}
    catch(error) {deferredError=error.stack;}
    check('deferred EOF preserves all five output streams',() => {
        assert.equal(deferredError,undefined);assert.deepEqual(deferredHashes,hashes(out));
    });
    const ranks = [];
    for (const [step,lines] of screens.entries()) {
        const status = lines[22] || '';
        const match = status.match(/\bthe (.*?)\s+St:/);
        if (match && ranks.at(-1)?.rank !== match[1]) ranks.push({step,rank:match[1]});
    }
    rows.push({name:part.name,negative:p.negative,checks,first,last,ranks,
        stateTraceSHA256:hash(states),hashes:out ? hashes(out) : null,plainHashes,deferredHashes,
        keys:part.moves.length,boundaries:out?.screens.length,calls:out?.calls.length,
        frames:out?.frames.flat().length,
        ...(runError || plainError || deferredError ? {runError,plainError,deferredError} : {})});
}
verifyRuntime();
const failures = rows.flatMap(row => row.checks.filter(c => !c.pass).map(c => ({case:row.name,...c})));
const report = {classification:'Source-only ordinary keyboard evidence, not original C comparison',
    recipeSHA256:lock.files['recipe.json'],runtimeSHA256:sha(runtimeBytes),
    cases:rows.length,checks:rows.reduce((n,row) => n+row.checks.length,0),failures,rows};
writeFileSync(new URL('review/ordinary-baseline.json',root),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
writeFileSync(new URL('negative-hashes.json',root),JSON.stringify(rows.filter(r => r.negative)
    .map(r => ({index:rows.indexOf(r),name:r.name,hashes:r.hashes})),null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:rows.length,checks:report.checks,passed:report.checks-failures.length,
    failures:failures.map(f => ({case:f.case,name:f.name,error:f.error})),
    negativeCases:rows.filter(r => r.negative).length,negativeHashes:15}));
if (failures.length) process.exitCode=1;
