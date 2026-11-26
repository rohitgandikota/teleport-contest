// Original 99-check diagnostic, with all assertion bodies and snapshot unchanged.
import assert from 'node:assert/strict';
import {writeFileSync,existsSync} from 'node:fs';
import {packet,json,pins,lock,recipe,predictions,originalReport,preflight} from './preflight.mjs';
assert.equal(existsSync(new URL('reports/observation.json',packet)),false,'one candidate ordinary batch');
writeFileSync(new URL('reports/ordinary-preflight.json',packet),JSON.stringify(preflight,null,2)+'\n');

const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {CQ_REPEAT,W_RINGL,W_TOOL,G_GENOD} = await import('../js/const.js');
const {PMNAMES} = await import('../js/monst_data.js');
const {ONAMES} = await import('../js/objects_data.js');
const {Blind,Deaf,Hallucination,Free_action,Confusion} = await import('../js/youprop.js');
const {canspotmon,vobj_at} = await import('../js/display.js');
const {m_at} = await import('../js/mon.js');
const {helpless} = await import('../js/monst.js');
const {outputs,hashes,deferred} = await import('../tools/half-damage-reader-observe.mjs');
const {decodeScreen,renderCell} = await import('../frozen/screen-decode.mjs');
const typeNames = Object.fromEntries(Object.entries(ONAMES).map(([k,v])=>[v,k]));
const speciesNames = Object.fromEntries(Object.entries(PMNAMES).map(([k,v])=>[v,k]));
const lines = screen => decodeScreen(screen).map(r=>r.map(renderCell).join('').trimEnd());
const prior = Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
const report = {runtimeMapSha256:pins.runtimeMapSha256,recipeSha256:lock.recipeSha256,
    nativeRecorded:true,runtimeChanged:true,rows:[]};
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
            check('mounted source feedback',()=>assert.equal(feedback,plan.expected));
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
                const actual=renderCell(decodeScreen(output.screens[plan.after])[y+1][x]);
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
                    json(new URL('previous/proposals/predictions.json',packet)).cases[i].before].monster;
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
        if(predictions.unchangedIndexes.includes(i))
            check('unchanged original tuple retains all five hashes',()=>
                assert.deepEqual(row.hashes,originalReport.rows[i].hashes),'history');
        const plain=await runSegment({...part,storage:new InMemoryStorage()});
        check('observer-free five streams unchanged',()=>assert.deepEqual(hashes(outputs(plain)),row.hashes),'neutrality');
        const late=await deferred(part);
        check('deferred five streams unchanged',()=>assert.deepEqual(hashes(late),row.hashes),'neutrality');
        writeFileSync(new URL('reports/observation.json',packet),JSON.stringify(report,null,2)+'\n');
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
    writeFileSync(new URL('reports/observation.json',packet),JSON.stringify(report,null,2)+'\n');
}
process.exitCode=report.workerFailure||report.summary.failures.length?1:0;
