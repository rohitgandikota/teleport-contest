// Current installed runtime. Check immutable source and original C before gameplay.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const evidence=new URL('tools/gen-sessions/evidence/dochat-direction-targets/',root);
const json=url=>JSON.parse(readFileSync(url,'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const digest=url=>sha(readFileSync(url));
const read=name=>json(new URL(name,evidence));
assert.ok(process.argv.length<=3,'usage: node tools/dochat-direction-targets-input-gate.mjs [new-report.json]');
const reportPath=process.argv[2]||null;
assert.ok(!reportPath||(!reportPath.startsWith('-')&&!existsSync(reportPath)),'report must be a new file');
const contractFile=new URL('source-contract.json',evidence);
assert.equal(digest(contractFile),'d000c20caa63b7c7248dec2585dbeee3ceb95696c0fddf2c2732cf309540e8a3');
const contract=json(contractFile);
for(const [name,hash] of Object.entries(contract.evidencePins))
    assert.equal(digest(new URL(name,evidence)),hash,name);
for(const [name,hash] of Object.entries(contract.portableDependencyPins))
    assert.equal(digest(new URL(name,root)),hash,name);
for(const [label,pin] of Object.entries(contract.sealedPackets)) {
    assert.equal(digest(new URL(label+'/SEAL.json',evidence)),pin.sha256);
    const seal=read(label+'/SEAL.json'),manifest=read(label+'/manifest.json');
    assert.equal(seal.members,pin.members);
    assert.equal(Object.keys(manifest.members).length,pin.members);
    assert.equal(digest(new URL(label+'/manifest.json',evidence)),seal.manifestSha256);
}
for(const [name,origin] of Object.entries(contract.sealedEvidence))
    assert.equal(digest(new URL(name,evidence)),read(origin.packet+'/manifest.json').members[origin.member].sha256);
const recipe=read('source28/recipe.json'),lock=read('source28/input-lock.json');
const predictions=read('source28/predictions.json');
const sourceReport=read('source28/observation.json');
const originalReport=read('clear26/observation.json');
const previousPredictions=read('clear26/predictions.json');
const diagnostic=read('candidate316/observation.json');
const accounting=read('candidate316/contract-accounting.json');
const negativeHashes=read('source28/negative-hashes.json'),negativeIndexes=[1,4,7,9,10];
assert.equal(digest(new URL('source28/recipe.json',evidence)),lock.recipeSha256);
assert.equal(digest(new URL('source28/predictions.json',evidence)),lock.predictionsSha256);
assert.deepEqual(lock.fields,['name','seed','datetime','nethackrc','moves']);
for(const [label,checks,failed] of [['original23',80,12],['corrected22',92,14],
    ['clear26',99,18],['source28',99,9],['candidate316',99,8]]) {
    const r=read(label+'/observation.json');
    assert.equal(r.summary.checks,checks);assert.equal(r.summary.failures.length,failed);
    assert.equal(r.summary.observerRestored,true);assert.equal(r.workerFailure,undefined);
}
const originalBody=readFileSync(new URL('source28/observe.mjs',evidence),'utf8');
const candidateBody=readFileSync(new URL('candidate316/observe.mjs',evidence),'utf8');
const marker='        const check=';
assert.equal(originalBody.slice(originalBody.indexOf(marker)),candidateBody.slice(candidateBody.indexOf(marker)));
assert.equal(sha(originalBody.slice(originalBody.indexOf(marker))),
    read('candidate316/assertion-preservation.json').assertionBlockAndTailSha256);
assert.equal(digest(new URL('candidate316/observation.json',evidence)),accounting.ordinaryReportSha256);
assert.equal(digest(new URL('candidate316/native.json',evidence)),accounting.nativeReportSha256);
assert.deepEqual(diagnostic.rows.flatMap((r,i)=>r.checks.filter(c=>!c.pass).map(c=>({index:i,name:c.name,category:c.category}))),
    accounting.originalDiagnostic.failures);
assert.deepEqual(predictions.unchangedIndexes,[0,1,2,3,4,5,8,9,10]);
const historicalChecks=predictions.unchangedIndexes.map(i=>{
    const row=sourceReport.rows[i];
    assert.equal(row.checks.filter(c=>c.category==='history').length,1);
    assert.ok(row.checks.find(c=>c.category==='history').pass);
    assert.deepEqual(row.hashes,originalReport.rows[i].hashes);
    return {index:i,pass:true};
});
const nativeBefore=read('parent/baseline-native.json'),nativeAfter=read('candidate316/native.json');
const exact=r=>r.fullStyleExact&&r.frozenScreenCursorExact&&r.fullRngExact&&r.animationExact;
assert.equal(nativeBefore.length,11);assert.equal(nativeAfter.length,11);
assert.deepEqual(nativeBefore.filter(exact).map(r=>r.segment),negativeIndexes);
assert.ok(nativeAfter.every(exact));
assert.deepEqual(negativeHashes.rows.map(r=>r.index),negativeIndexes);
for(const i of negativeIndexes) {
    assert.deepEqual(diagnostic.rows[i],sourceReport.rows[i]);
    assert.deepEqual(nativeAfter[i],nativeBefore[i]);
    assert.deepEqual(diagnostic.rows[i].hashes,negativeHashes.rows.find(r=>r.index===i).hashes);
}
const primary=read('parent/primary-recipe.json');
const publicFile=new URL('tools/gen-sessions/recipes/dochat-direction-targets.json',root);
assert.equal(digest(publicFile),contract.primaryRecipeSha256);
assert.deepEqual(json(publicFile),primary,'public recipe retains original primary bytes and metadata');
assert.deepEqual(primary.segments,recipe.segments);
const parentLock=read('parent/input-lock.json'),recording=read('parent/recording.json');
assert.equal(parentLock.sourceSealSHA256,digest(new URL('source28/SEAL.json',evidence)));
assert.equal(parentLock.sourceManifestSHA256,digest(new URL('source28/manifest.json',evidence)));
assert.equal(parentLock.sourceRecipeSHA256,lock.recipeSha256);
assert.equal(parentLock.sourcePredictionsSHA256,lock.predictionsSha256);
assert.equal(parentLock.sourceNegativeSHA256,digest(new URL('source28/negative-hashes.json',evidence)));
assert.equal(parentLock.primaryRecipeSHA256,contract.primaryRecipeSha256);
assert.equal(recording.primaryRecipeSHA256,contract.primaryRecipeSha256);
assert.equal(recording.inputSHA256,parentLock.minimalSHA256);
assert.equal(recording.rawSha256,contract.native.sha256);
assert.equal(recording.cPin,contract.cPin);
assert.equal(recording.binarySha256,contract.recordedBinarySha256);
assert.equal(recording.recorderSha256,contract.recorderSha256);
assert.equal(recording.exit,0);assert.equal(recording.cExecutedOnce,true);
const rawBytes=readFileSync(new URL(contract.native.path,root));
assert.equal(sha(rawBytes),contract.native.sha256);assert.equal(rawBytes.length,1857649);
const raw=JSON.parse(rawBytes);
assert.equal(raw.source,'c');assert.equal(raw.version,5);assert.equal(raw.segments.length,11);
for(const key of Object.keys(primary)) if(key!=='segments') assert.deepEqual(raw[key],primary[key]);
let keys=0,boundaries=0,rngCalls=0,frames=0;
for(const [i,part] of recipe.segments.entries()) {
    const frozen=lock.segments[i];
    for(const field of lock.fields) for(const tuple of [part,primary.segments[i],raw.segments[i]]) {
        assert.equal(Object.hasOwn(tuple,field),frozen.fields[field].present,`${i}/${field} presence`);
        assert.deepEqual(tuple[field],frozen.fields[field].value,`${i}/${field}`);
    }
    assert.deepEqual(Array.from(part.moves,c=>c.charCodeAt(0)),frozen.keys);
    assert.deepEqual(raw.segments[i].steps.map(s=>s.key),[null,...part.moves]);
    keys+=frozen.keys.length;
    for(const step of raw.segments[i].steps) {
        boundaries++;rngCalls+=(step.rng||[]).length;frames+=(step.animation_frames||[]).length;
    }
}
assert.deepEqual({keys,boundaries,rngCalls,frames},{keys:1056,boundaries:1067,rngCalls:31031,frames:0});
// Decoder/assertion imports read evidence only and cannot start gameplay.
const {branchAssertionErrors,recordingIntegrityErrors}=await import('./gen-sessions/assertions.mjs');
const {decodeScreen,renderCell}=await import('../frozen/screen-decode.mjs');
assert.equal(primary.requireBranchAssertions,true);assert.equal(primary.branchAssertions.length,11);
assert.deepEqual(recordingIntegrityErrors(raw),[]);assert.deepEqual(branchAssertionErrors(primary,raw),[]);
const styles=screen=>decodeScreen(screen).map(row=>row.map(c=>({ch:renderCell(c),color:c.color,attr:c.attr})));
const correctedC=[];
for(const i of [2,3]) {
    const plan=predictions.cases[i];
    const text=decodeScreen(raw.segments[i].steps[plan.after].screen)[0].map(renderCell).join('').trimEnd();
    assert.notEqual(text,plan.expected,'retained old equality rejects original C');
    assert.ok(text.startsWith(plan.expected));
    assert.equal(text.slice(plan.expected.length,plan.expected.length+2),'  ');
    assert.equal(text,accounting.mountedMessageAttribution.find(r=>r.index===i).originalCRow);
    correctedC.push({index:i,step:plan.after,expected:plan.expected,text,oldPredicateRejectsC:true,correctedPass:true});
}
const petPlan=predictions.cases[8],petBefore=sourceReport.rows[8].states[petPlan.before];
const [x,y]=petBefore.target;
assert.deepEqual([x,y],[3,8]);
const grid=decodeScreen(raw.segments[8].steps[petPlan.after].screen);
assert.notEqual(renderCell(grid[y+1][x]),'I','retained old coordinate rejects original C');
assert.equal(renderCell(grid[y+1][x-1]),'I');
assert.equal(renderCell(grid[y+1][x]),accounting.markerCoordinateAttribution.originalCAtOldCoordinate);
correctedC.push({index:8,step:petPlan.after,map:[x,y],decoded:[x-1,y+1],oldDecoded:[x,y+1],
    oldPredicateRejectsC:true,correctedPass:true});
const calls=values=>values.map(value=>{
    const call=String(value).replace(/\s*@\s.*$/,'').replace(/^\d+\s+/,'').trim();
    assert.match(call,/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/,'retain every core RNG call');
    return call;
});
const nativePreflight={sha256:contract.native.sha256,source:'c',version:5,cases:11,keys,boundaries,
    calls:rngCalls,frames,fieldsAndPresence:true,allKeysExact:true,primaryAssertions:11,
    integrityErrors:[],branchErrors:[],correctedC,allBeforeGameplayImports:true};
const sourcePreflight={evidenceFiles:Object.keys(contract.evidencePins).length,historicalChecks,
    originalDiagnostic:'91/99 exit1 retained',originalBodies:99,currentContracts:90,
    negativeHashes:25,sourceSeals:contract.sealedPackets,reviewedCProvenanceOnly:true};

// Gameplay begins only after all immutable evidence and original C checks pass.
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {CQ_REPEAT,W_RINGL,W_TOOL,G_GENOD} = await import('../js/const.js');
const {PMNAMES} = await import('../js/monst_data.js');
const {ONAMES} = await import('../js/objects_data.js');
const {Blind,Deaf,Hallucination,Free_action,Confusion} = await import('../js/youprop.js');
const {canspotmon,vobj_at} = await import('../js/display.js');
const {m_at} = await import('../js/mon.js');
const {helpless} = await import('../js/monst.js');
const {outputs,hashes,deferred} = await import('./half-damage-reader-observe.mjs');
const typeNames = Object.fromEntries(Object.entries(ONAMES).map(([k,v])=>[v,k]));
const speciesNames = Object.fromEntries(Object.entries(PMNAMES).map(([k,v])=>[v,k]));
const lines = screen => decodeScreen(screen).map(r=>r.map(renderCell).join('').trimEnd());
const prior = Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
const report = {sourcePreflight,nativePreflight,recipeSha256:lock.recipeSha256,
    rows:[],nativeRows:[],negativeControls:[]};
const mon = m => m ? {id:m.m_id,species:speciesNames[m.mnum],xy:[m.mx,m.my],
    tame:m.mtame,hp:m.mhp,sleeping:!!m.msleeping,canmove:!!m.mcanmove,
    frozen:m.mfrozen||0,eating:m.meating||0,helpless:helpless(m),
    undetected:!!m.mundetected,appearance:m.m_ap_type||0,spotted:canspotmon(m),
    hungrytime:m.edog?.hungrytime,customName:m.mgivenname||null} : null;
function snapshot(g,clearTarget) {
    const target=[g.u.ux-1,g.u.uy], object=vobj_at(...target);
    return {turn:g.moves,xy:[g.u.ux,g.u.uy],hp:g.u.uhp,multi:g.multi,
        afternmv:g.afternmv?.name||null,gameover:!!g.program_state?.gameover,
        blind:!!Blind(),deaf:!!Deaf(),hallu:!!Hallucination(),
        freeAction:!!Free_action(),freeActionMask:g.u.uprops?.FREE_ACTION||0,
        swallowed:!!g.u.uswallow,underwater:!!g.u.uinwater,
        strangled:!!g.u.intrinsic?.HStrangled,form:g.u.umonnum,
        shop:g.u.ushops||'',heroMemory:!!g.level.flags?.hero_memory,
        steed:mon(g.u.usteed),target,monster:mon(m_at(...target)),
        topObject:object ? {type:typeNames[object.otyp],species:speciesNames[object.corpsenm]} : null,
        marker:g.level.at(...target)?.remembered_glyph?.glyph?.kind||null,
        inventory:(g.invent||[]).map(o=>({letter:o.invlet,type:typeNames[o.otyp],
            cursed:!!o.cursed,blessed:!!o.blessed,worn:o.owornmask||0})),
        ...(clearTarget ? {clearEvidence:{
            confused:!!Confusion(),ratVitals:{...g.mvitals[PMNAMES.PM_SEWER_RAT]},
            rawTarget:mon(g.level.monAt?.get(target.join(','))),
            monsters:(g.level.monsters||[]).map(m=>({id:m.m_id,
                species:speciesNames[m.mnum],xy:[m.mx,m.my],hp:m.mhp,
                cham:m.cham,generatedWithLevel:!!m.mgenmklev,
                inventory:(m.minvent||[]).map(o=>({id:o.o_id,type:typeNames[o.otyp]}))}))}} : {}),
        repeat:(g.command_queue?.[CQ_REPEAT]||[]).map(q=>({type:q.typ,
            command:q.ec_entry?.ef_txt||null,key:q.key??null}))};
}
try {
    for (const [i,part] of recipe.segments.entries()) {
        const plan=predictions.cases[i], states={};
        const wanted=new Set([plan.before,plan.prompt,plan.after,plan.repeated,
            ...(plan.extraSteps||[])].filter(Number.isInteger));
        globalThis.__step_snapshot={step:'*',cb(g,step){
            if(wanted.has(step)) states[step]=snapshot(g,i===6||i===7);
        }};
        const run=await runSegment({...part,storage:new InMemoryStorage()});
        delete globalThis.__step_snapshot;
        const output=structuredClone(outputs(run));
        const row={name:part.name,kind:plan.kind,negative:plan.negative,
            keys:part.moves.length,boundaries:output.screens.length,hashes:hashes(output),
            states,texts:Object.fromEntries([...wanted].map(s=>[s,lines(output.screens[s]).slice(0,2)])),checks:[]};
        report.rows.push(row);
        const check=(name,body,category='source-prediction')=>{
            try{body();row.checks.push({name,category,pass:true});}
            catch(error){row.checks.push({name,category,pass:false,error:error.message});}
        };
        const before=states[plan.before], after=states[plan.after];
        const feedback=row.texts[plan.after][0];
        check('all boundaries and RNG slices',()=>{
            assert.equal(output.screens.length,part.moves.length+1);
            assert.deepEqual(output.slices.flat(),output.calls);
        },'integrity');
        check('actual hero ready for chat',()=>{
            assert.ok(before.hp>0);assert.equal(before.gameover,false);
            assert.equal(before.multi,0);assert.equal(before.afternmv,null);
            assert.equal(before.swallowed,false);assert.equal(before.underwater,false);
            assert.equal(before.strangled,false);assert.equal(before.shop,'');
            assert.ok(row.texts[plan.prompt][0].includes('Talk to whom? (in what direction)'));
        },'setup');
        if(plan.kind==='cancel') {
            check('cancel clears repeat',()=>assert.deepEqual(after.repeat,[]));
            check('Ctrl-A reports no command',()=>assert.ok(row.texts[plan.repeated][0].includes(plan.expected)));
        } else if(plan.kind==='self') {
            check('self response',()=>assert.equal(feedback,plan.expected));
            check('successful chat retains repeat',()=>{
                assert.ok(after.repeat.some(q=>q.command==='chat'));
                assert.ok(row.texts[plan.repeated][0].includes(plan.expected));
            });
        } else if(plan.kind.startsWith('mounted-')) {
            check('actual mounted pony producer',()=>{
                assert.equal(before.steed?.species,'PM_PONY');assert.ok(before.steed.hp>0);
                assert.equal(before.blind,false);assert.equal(before.hallu,false);
                assert.equal(before.steed.helpless,plan.kind==='mounted-helpless');
                if(plan.kind==='mounted-awake') {
                    assert.ok(before.steed.tame>=5);assert.ok(before.steed.hungrytime>=before.turn);
                }
            },'setup');
            check('mounted source feedback',()=>{
                if(plan.kind==='mounted-awake'||plan.kind==='mounted-helpless') {
                    assert.ok(feedback.startsWith(plan.expected));
                    assert.deepEqual(styles(output.screens[plan.after]),
                        styles(raw.segments[i].steps[plan.after].screen));
                } else assert.equal(feedback,plan.expected);
            });
        } else if(plan.kind.startsWith('statue')) {
            check('actual statue and perception producer',()=>{
                assert.equal(before.topObject?.type,'STATUE');
                assert.equal(before.topObject.species,'PM_GRID_BUG');
                assert.ok(!before.monster||before.monster.undetected);
                assert.equal(before.blind,plan.kind==='statue-blind');
                assert.equal(before.hallu,plan.kind==='statue-hallu');
            },'setup');
            check('statue source feedback',()=>{
                if(plan.kind==='statue-hallu') assert.match(feedback,new RegExp(plan.expected));
                else assert.equal(feedback,plan.expected);
            });
        } else {
            check('actual adjacent eating pet and perception producer',()=>{
                assert.ok(before.monster?.tame>0);assert.ok(before.monster.hp>0);
                assert.ok(before.monster.eating>0);assert.equal(before.monster.helpless,false);
                assert.equal(before.monster.undetected,false);
                assert.equal(before.monster.appearance,0);
                assert.equal(before.blind,plan.kind!=='pet-visible');
                assert.equal(before.deaf,plan.kind==='pet-deaf');
                assert.equal(before.monster.spotted,plan.kind==='pet-visible');
                assert.equal(before.heroMemory,true);assert.notEqual(before.marker,'invis');
            },'setup');
            check('eating or deaf response',()=>assert.equal(feedback,plan.expected));
            check('C invisible-marker condition',()=>{
                const [x,y]=before.target;
                const actual=renderCell(decodeScreen(output.screens[plan.after])[y+1][x-1]);
                if(plan.kind==='pet-blind') {
                    assert.equal(after.marker,'invis');assert.equal(actual,'I');
                } else {
                    assert.notEqual(after.marker,'invis');assert.notEqual(actual,'I');
                }
            });
        }
        check('C command time and position',()=>{
            assert.deepEqual(after.xy,before.xy);
            assert.equal(after.turn,before.turn+(['mounted-awake','mounted-helpless'].includes(plan.kind)?1:0));
        });
        if(i===3) {
            check('actual free-action ring precedes potion throw',()=>{
                const start=states[plan.ringStart], ready=states[plan.preUse];
                assert.equal(start.freeAction,false);
                assert.equal(ready.freeAction,true);
                assert.ok(ready.freeActionMask&W_RINGL);
                assert.ok(ready.inventory.some(o=>o.letter==='a'&&o.type==='RIN_FREE_ACTION'&&(o.worn&W_RINGL)));
                assert.ok(ready.inventory.some(o=>o.letter==='b'&&o.type==='POT_PARALYSIS'));
            },'setup');
            check('paralysis transition with ready hero',()=>{
                const ready=states[plan.preUse];
                assert.equal(ready.steed.helpless,false);
                assert.equal(before.freeAction,true);
                assert.equal(before.multi,0);
                assert.equal(before.steed.id,ready.steed.id);
                assert.equal(before.steed.canmove,false);
                assert.ok(before.steed.frozen>0);
                assert.equal(before.turn,ready.turn+1);
                assert.ok(!before.inventory.some(o=>o.type==='POT_PARALYSIS'));
                assert.ok(plan.extraSteps.some(s=>states[s].steed?.frozen>0));
            },'setup');
        }
        if(i===6||i===7) {
            check('corrected actual inventory letter producer',()=>{
                const ready=states[plan.preUse];
                const item=ready.inventory.find(o=>o.letter==='b');
                assert.ok(item);
                if(i===6) {
                    assert.equal(item.type,'POT_HALLUCINATION');assert.equal(item.cursed,true);
                    assert.equal(ready.hallu,false);assert.equal(before.hallu,true);
                    assert.ok(!before.inventory.some(o=>o.type==='POT_HALLUCINATION'));
                } else {
                    assert.equal(item.type,'BLINDFOLD');assert.equal(ready.blind,false);
                    assert.ok(before.inventory.some(o=>o.letter==='b'&&o.type==='BLINDFOLD'&&(o.worn&W_TOOL)));
                    assert.equal(before.blind,true);
                }
            },'setup');
        }
        if(i===6||i===7) {
            check('actual earlier rat and scroll before clear',()=>{
                const initial=states[0].clearEvidence;
                const ready=states[plan.preRead];
                const earlier=originalReport.rows[i].states[
                    previousPredictions.cases[i].before].monster;
                const rat=ready.clearEvidence.monsters.find(m=>m.id===earlier.id);
                assert.ok(rat&&rat.hp>0);assert.equal(rat.species,'PM_SEWER_RAT');
                assert.equal(rat.cham,-1);
                assert.ok(initial.monsters.some(m=>m.id===rat.id&&m.hp>0));
                assert.equal(rat.generatedWithLevel,true);
                assert.equal(ready.clearEvidence.ratVitals.mvflags&G_GENOD,0);
                assert.equal(ready.clearEvidence.confused,false);
                assert.equal(ready.blind,false);assert.equal(ready.hallu,false);
                const scroll=ready.inventory.find(o=>o.letter==='c');
                assert.equal(scroll?.type,'SCR_GENOCIDE');
                assert.equal(scroll.blessed,false);assert.equal(scroll.cursed,false);
            },'setup');
            check('ordinary genocide removes actual rat before perception',()=>{
                const ready=states[plan.preRead], cleared=states[plan.clearDone];
                assert.ok(cleared.clearEvidence.ratVitals.mvflags&G_GENOD);
                assert.ok(!cleared.clearEvidence.monsters.some(m=>m.species==='PM_SEWER_RAT'&&m.hp>0));
                assert.ok(!cleared.inventory.some(o=>o.type==='SCR_GENOCIDE'));
                assert.equal(cleared.turn,ready.turn+1);
                assert.equal(cleared.blind,false);assert.equal(cleared.hallu,false);
                assert.ok(plan.extraSteps.some(s=>row.texts[s].some(t=>t.includes(plan.genocideMessage))));
            },'setup');
            check('raw target grid clear and statue retained',()=>{
                for(const step of [plan.clearDone,plan.before,plan.after]) {
                    const state=states[step];
                    assert.equal(state.clearEvidence.rawTarget,null);
                    assert.equal(state.monster,null);
                    assert.equal(state.topObject?.type,'STATUE');
                    assert.equal(state.topObject.species,'PM_GRID_BUG');
                    assert.ok(state.clearEvidence.ratVitals.mvflags&G_GENOD);
                }
            },'setup');
        }
        const plain=await runSegment({...part,storage:new InMemoryStorage()});
        check('observer-free five streams unchanged',()=>assert.deepEqual(hashes(outputs(plain)),row.hashes),'neutrality');
        const late=await deferred(part);
        check('deferred five streams unchanged',()=>assert.deepEqual(hashes(late),row.hashes),'neutrality');
        if(negativeIndexes.includes(i)) {
            const priorRow=structuredClone(sourceReport.rows[i]);
            priorRow.checks=priorRow.checks.filter(c=>c.category!=='history');
            assert.equal(JSON.stringify(row),JSON.stringify(priorRow),'complete negative JSON observation fields and current check rows');
            assert.deepEqual(row.hashes,negativeHashes.rows.find(r=>r.index===i).hashes);
            report.negativeControls.push({index:i,hashes:row.hashes,completeObservationUnchanged:true});
        }
        const native=raw.segments[i];
        assert.equal(output.screens.length,native.steps.length);
        for(const [step,screen] of output.screens.entries())
            assert.deepEqual(styles(screen),styles(native.steps[step].screen),`${part.name} full styled boundary ${step}`);
        assert.deepEqual(output.cursors,native.steps.map(s=>s.cursor));
        const cSlices=native.steps.map(s=>calls(s.rng||[]));
        assert.deepEqual(calls(output.calls),cSlices.flat());
        assert.deepEqual(output.slices.map(calls),cSlices);
        assert.deepEqual(output.frames,native.steps.map(s=>s.animation_frames||[]));
        report.nativeRows.push({index:i,boundaries:native.steps.length,calls:output.calls.length,
            fullStyleExact:true,cursorsExact:true,rngSlicesExact:true,framesExact:true,discardedEntries:0});
        console.log(JSON.stringify({name:row.name,checks:row.checks.length,failures:row.checks.filter(c=>!c.pass).map(c=>c.name)}));
    }
} catch(error) {
    report.workerFailure={message:error.message,stack:error.stack};
} finally {
    if(prior) Object.defineProperty(globalThis,'__step_snapshot',prior);
    else delete globalThis.__step_snapshot;
    report.summary={cases:report.rows.length,checks:report.rows.reduce((n,r)=>n+r.checks.length,0),
        failures:report.rows.flatMap(r=>r.checks.filter(c=>!c.pass).map(c=>({case:r.name,...c}))),
        observerRestored:JSON.stringify(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'))===JSON.stringify(prior)};
    if(reportPath) writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
}
const passed=!report.workerFailure&&report.summary.cases===11&&report.summary.checks===90
    &&report.summary.failures.length===0&&report.summary.observerRestored
    &&report.nativeRows.length===11&&report.negativeControls.length===5;
console.log(JSON.stringify({passed,currentContracts:`${90-report.summary.failures.length}/90`,
    historicalContracts:'9/9',primary:'11/11',negativeHashes:report.negativeControls.length*5,
    neutrality:report.rows.flatMap(r=>r.checks).filter(c=>c.category==='neutrality'&&c.pass).length,
    native:report.nativeRows.length+'/11',originalDiagnostic:'91/99 exit1 retained'}));
process.exitCode=passed?0:1;
