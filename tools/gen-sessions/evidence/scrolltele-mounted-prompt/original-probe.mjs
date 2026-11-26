// One source-only ordinary batch. Inputs, assertions and old negatives are prelocked.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root = new URL('./',import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => JSON.parse(readFileSync(new URL(name,root)));
const lock = read('input-lock.json');
assert.equal(lock.beforeGameplayAndCandidate,true);
for (const [path,digest] of Object.entries(lock.files))
    assert.equal(sha(readFileSync(new URL(path,root))),digest,path);
assert.equal(sha(readFileSync(new URL('probe.mjs',root))),lock.probeSHA256);
const recipe = read('recipe.json'), predictions = read('predictions.json');
const negative = read('negative-hashes.json');
const tuple = part => lock.fields.map(field => ({field,present:Object.hasOwn(part,field),
    ...(Object.hasOwn(part,field) ? {value:part[field]} : {})}));
assert.deepEqual(recipe.segments.map(tuple),lock.tuples);
assert.equal(sha(JSON.stringify(recipe.segments.map(tuple))),lock.tuplesSHA256);
assert.equal(sha(JSON.stringify(recipe.segments.map(part => [null,...part.moves]))),lock.allKeysSHA256);
assert.equal(recipe.segments.length,4);
assert.equal(negative.reduce((n,row) => n+Object.keys(row.hashes).length,0),10);
for (const item of read('source-pins.json').files)
    assert.equal(sha(readFileSync(new URL(item.path,root))),item.sha256,item.path);
const runtimeBytes = readFileSync(new URL('baseline-runtime.json',root));
assert.equal(sha(runtimeBytes),'68aa0830525b530b58f5f18b848ddafd3beb586dff20a4d63619b5d3dd66d7ad');
const runtime = JSON.parse(runtimeBytes);
function verifyRuntime() {
    assert.equal(Object.keys(runtime).length,280);
    for (const [path,digest] of Object.entries(runtime))
        assert.equal(sha(readFileSync(new URL(path,root))),digest,path);
}
verifyRuntime();
const {runSegment} = await import('./js/jsmain.js');
const {InMemoryStorage} = await import('./js/storage.js');
const {ONAMES} = await import('./js/objects_data.js');
const {PMNAMES} = await import('./js/monst_data.js');
const {W_SADDLE} = await import('./js/const.js');
const {Blind,Blinded,Hallucination,Confusion,Stunned,Teleport_control} = await import('./js/youprop.js');
const {noteleport_level} = await import('./js/teleport.js');
const {unconscious} = await import('./js/trap.js');
const {decodeScreen,renderCell} = await import('./frozen/screen-decode.mjs');
const {outputs,hashes,hash,deferred} = await import('./tools/half-damage-reader-observe.mjs');

const object = o => ({id:o.o_id,type:o.otyp,quantity:o.quan,letter:o.invlet,
    blessed:!!o.blessed,cursed:!!o.cursed,seen:!!o.dknown});
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
            if (!g.u || !g.level || !g.youmonst?.data) return;
            const m = g.u.usteed;
            states.push({step,turn:g.moves,hp:g.u.uhp,mortality:g.u.umortality || 0,
                xy:[g.u.ux,g.u.uy],level:{...g.u.uz},wizard:!!g.wizard,explore:!!g.discover,
                naturalNoTeleport:!!g.level.flags.noteleport,stasisUntil:g.level.flags.stasis_until || 0,
                restricted:!!noteleport_level(g.youmonst),blind:!!Blind(),blinded:!!Blinded(),
                hallucinating:!!Hallucination(),confused:!!Confusion(),stunned:!!Stunned(),
                unconscious:!!unconscious(),teleportControl:!!Teleport_control(),
                scrollKnown:!!g.objects[ONAMES.SCR_TELEPORTATION].oc_name_known,
                wishes:g.u.uconduct?.wishes || 0,inventoryCount:(g.invent || []).length,
                scrolls:(g.invent || []).filter(o => o.otyp === ONAMES.SCR_TELEPORTATION).map(object),
                steed:m ? {id:m.m_id,type:m.mnum,xy:[m.mx,m.my],hp:m.mhp,tame:m.mtame,
                    givenName:m.mextra?.mgivenname || m.mgivenname || '',invisible:!!m.minvis,
                    appearanceType:m.m_ap_type || 0,wornSaddle:!!((m.misc_worn_check || 0)&W_SADDLE),
                    saddle:(m.minvent || []).some(o => o.otyp === ONAMES.SADDLE
                        && !!(o.owornmask&W_SADDLE) && o.leashmon === m.m_id),
                    rawMapOccupant:g.level.monAt.get(`${m.mx},${m.my}`)?.m_id || null} : null});
        }};
        run = await runSegment({...part,storage:new InMemoryStorage()});
    } catch(error) {runError=error.stack;}
    finally {
        if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    const out = run ? structuredClone(outputs(run)) : null;
    const texts = out?.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n')) || [];
    const at = step => states.find(s => s.step === step);
    const first = at(1), mounted = p.mounted ? at(p.mountStep) : null;
    const beforeRead = at(p.beforeRead), last = states.at(-1);
    const prompts = texts.flatMap((text,step) => step > p.beforeRead
        && /Where do .* want to be teleported\?/.test(text)
        ? [{step,top:text.split('\n').slice(0,2).join('\n')}] : []);
    const promptState = prompts.length ? at(prompts[0].step) : null;
    check('real maintained mount producer or unmounted control',() => {
        assert.equal(first?.steed,null);
        if (p.mounted) {
            assert.equal(first.inventoryCount,0);
            assert.ok(mounted?.steed && mounted.steed.hp>0 && mounted.steed.tame>0);
            assert.equal(mounted.steed.type,PMNAMES.PM_PONY);
            assert.ok(mounted.steed.saddle && mounted.steed.wornSaddle);
            assert.equal(mounted.steed.rawMapOccupant,null);
            assert.deepEqual(mounted.xy,[40,4]);
            assert.deepEqual(mounted.steed.xy,mounted.xy);
            assert.ok(states.filter(s => s.step>=p.mountStep).every(s =>
                s.steed?.id === mounted.steed.id && s.steed.hp>0 && s.steed.saddle));
        } else assert.ok(states.every(s => s.steed === null));
    });
    check('real wished blessed scroll is ready to read',() => {
        assert.equal(beforeRead?.wishes,1);
        assert.equal(beforeRead.scrolls.length,1);
        const scroll=beforeRead.scrolls[0];
        assert.equal(scroll.type,ONAMES.SCR_TELEPORTATION);
        assert.equal(scroll.quantity,1);assert.equal(scroll.letter,p.scrollLetter);
        assert.equal(scroll.blessed,true);assert.equal(scroll.cursed,false);assert.equal(scroll.seen,true);
        assert.equal(beforeRead.scrollKnown,false);
    });
    check('actual wizard or explore flag at the read',() => {
        assert.equal(beforeRead?.wizard,p.wizard);
        assert.equal(beforeRead?.explore,!p.wizard);
        assert.equal(texts.some(t => t.includes('now in non-scoring explore mode')),!p.wizard);
    });
    check('unrestricted conscious sober controlled branch',() => {
        assert.ok(beforeRead);
        for (const field of ['naturalNoTeleport','restricted','blind','blinded','hallucinating',
                             'confused','stunned','unconscious','teleportControl'])
            assert.equal(beforeRead[field],false,field);
        assert.equal(beforeRead.stasisUntil,0);
        assert.equal(texts.some(t => t.includes('A mysterious force prevents you from teleporting!')),false);
    });
    check('actual steed and naming prerequisites at controlled prompt',() => {
        assert.ok(prompts.length>0 && promptState,'real prompt boundary observed');
        assert.equal(promptState.wizard,p.wizard);
        assert.equal(promptState.explore,!p.wizard);
        assert.equal(promptState.unconscious,false);assert.equal(promptState.stunned,false);
        assert.equal(promptState.hallucinating,false);assert.equal(promptState.blind,false);
        if (p.mounted) {
            assert.equal(promptState.steed?.id,mounted.steed.id);
            assert.equal(promptState.steed.type,PMNAMES.PM_PONY);
            assert.equal(promptState.steed.givenName,'');assert.equal(promptState.steed.invisible,false);
            assert.equal(promptState.steed.appearanceType,0);
            assert.ok(promptState.steed.saddle && promptState.steed.wornSaddle);
            assert.deepEqual(promptState.steed.xy,promptState.xy);
        } else assert.equal(promptState.steed,null);
    });
    check('C controlled prompt includes the actual mounted name',() => {
        assert.ok(prompts.some(row => row.top.includes(p.expectedPrompt)),p.expectedPrompt);
        if (p.mounted) assert.ok(!prompts.some(row => row.top.includes('Where do you want to be teleported?')));
    });
    check('read discovers and consumes the scroll once',() => {
        assert.ok(last);assert.deepEqual(last.scrolls,[]);assert.equal(last.scrollKnown,true);
        assert.equal(last.wishes,beforeRead.wishes);
        assert.equal(last.turn-beforeRead.turn,1);
    });
    check('cancel preserves hero and steed destination',() => {
        assert.deepEqual(last.xy,beforeRead.xy);assert.deepEqual(last.level,beforeRead.level);
        assert.equal(texts.slice(p.beforeRead).some(t => t.includes('You materialize')),false);
        if (p.mounted) {
            assert.equal(last.steed?.id,beforeRead.steed.id);
            assert.deepEqual(last.steed.xy,beforeRead.steed.xy);
        } else assert.equal(last.steed,null);
    });
    check('survival, every key and every random slice',() => {
        assert.equal(runError,undefined);assert.ok(states.every(s => s.hp>0 && !s.mortality));
        assert.equal(last.step,part.moves.length);assert.equal(out.screens.length,part.moves.length+1);
        assert.deepEqual(out.slices.flat(),out.calls);
    });
    let plainHashes,deferredHashes,plainError,deferredError;
    try {plainHashes=hashes(outputs(await runSegment({...part,storage:new InMemoryStorage()})));}
    catch(error) {plainError=error.stack;}
    check('passive observation preserves all five streams',() => {
        assert.equal(plainError,undefined);assert.deepEqual(plainHashes,hashes(out));
    });
    try {deferredHashes=hashes(await deferred(part));}
    catch(error) {deferredError=error.stack;}
    check('deferred EOF preserves all five streams',() => {
        assert.equal(deferredError,undefined);assert.deepEqual(deferredHashes,hashes(out));
    });
    rows.push({name:part.name,checks,first,mounted,beforeRead,promptState,last,prompts,
        stateTraceSHA256:hash(states),hashes:out ? hashes(out) : null,plainHashes,deferredHashes,
        keys:part.moves.length,boundaries:out?.screens.length,calls:out?.calls.length,
        frames:out?.frames.flat().length,
        ...(runError || plainError || deferredError ? {runError,plainError,deferredError} : {})});
}
verifyRuntime();
const failures = rows.flatMap(row => row.checks.filter(c => !c.pass).map(c => ({case:row.name,...c})));
const negativeChecks = negative.map(n => ({index:n.index,name:n.name,
    pass:JSON.stringify(rows[n.index].hashes)===JSON.stringify(n.hashes),
    expected:n.hashes,actual:rows[n.index].hashes}));
const report = {classification:'source-only ordinary keyboard evidence; original C not run',
    recipeSHA256:lock.files['recipe.json'],runtimeSHA256:sha(runtimeBytes),
    cases:rows.length,checks:rows.reduce((n,row) => n+row.checks.length,0),failures,negativeChecks,rows};
writeFileSync(new URL('review/ordinary-baseline.json',root),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:rows.length,checks:report.checks,passed:report.checks-failures.length,
    failures:failures.map(f => ({case:f.case,name:f.name,error:f.error})),
    negativeHashesMatched:negativeChecks.filter(n => n.pass).length*5}));
if (failures.length || negativeChecks.some(n => !n.pass)) process.exitCode=1;
