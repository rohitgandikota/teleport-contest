// One locked ordinary family, current fixed graph, passive state only.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url);
const sha=b=>createHash('sha256').update(b).digest('hex');
const hash=v=>sha(JSON.stringify(v ?? null));
const read=n=>JSON.parse(readFileSync(new URL(n,root)));
const pins=read('pins.json'), proposal=read('proposals/proposal01.json'), lock=read('input-lock.json');
assert(process.execArgv.includes('--preserve-symlinks') && process.execArgv.includes('--preserve-symlinks-main'));
assert(!existsSync(new URL('reports/probe01.json',root)) && !existsSync(new URL('reports/probe01-progress.ndjson',root)));
for(const [name,key] of [['runtime.json','runtimeSHA256'],['source-ranges.json','sourceRangesSHA256'],['proposals/proposal01.json','proposalSHA256'],['input-lock.json','inputLockSHA256'],['primary-recipe.json','primaryRecipeSHA256']])
    assert.equal(sha(readFileSync(new URL(name,root))),pins[key],name);
const runtime=read('runtime.json');
assert.equal(Object.keys(runtime).length,280);
for(const [name,h] of Object.entries(runtime))
    assert.equal(sha(readFileSync(new URL('baseline/'+name,root))),h,name);
for(const [name,h] of Object.entries(pins.priorSeals))
    assert.equal(sha(readFileSync(new URL(name+'/SEAL.json',root))),h,name);
const recipe=read('primary-recipe.json');
assert.deepEqual(recipe.segments,proposal.segments);
assert.equal(recipe.requireBranchAssertions,true);
assert.equal(lock.totalKeys,332);
for(const [i,s] of proposal.segments.entries()) {
    const fields=lock.fields.map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
    assert.deepEqual(fields,lock.segments[i].fields);
    assert.equal(hash(fields),lock.segments[i].fieldsSHA256);
    assert.equal(sha(s.moves),lock.segments[i].movesSHA256);
    assert.deepEqual([...Buffer.from(s.moves)],lock.segments[i].keys);
    assert.deepEqual(recipe.branchAssertions[i].screenIncludes,
        [proposal.predictions[i].C.producerPhrase,...proposal.predictions[i].C.requiredPhrases]);
}
writeFileSync(new URL('reports/probe01-preflight.json',root),JSON.stringify({
    runtimeSHA256:pins.runtimeSHA256,proposalSHA256:pins.proposalSHA256,
    inputLockSHA256:pins.inputLockSHA256,primaryRecipeSHA256:pins.primaryRecipeSHA256,
    runtimeFiles:280,cases:4,keys:332,fiveFieldsAndPresence:true,allKeys:true,
    priorSealsExact:true,beforeTestedImports:true,referenceCExecutions:0},null,2)+'\n',{flag:'wx'});
const {runSegment,NethackGame}=await import('../js/jsmain.js');
const {InMemoryStorage}=await import('../js/storage.js');
const {ONAMES,OCLASSES}=await import('../js/objects_data.js');
const {MSOUND}=await import('../js/monst_data.js');
const {SHOPBASE,ROOMOFFSET,A_CHA,HUNGRY}=await import('../js/const.js');
const {Blind,Deaf,Hallucination,Halluc_resistance,Underwater}=await import('../js/youprop.js');
const {ACURR}=await import('../js/attrib.js');
const {OBJ_DESCR}=await import('../js/objnam.js');
const {helpless,is_silent}=await import('../js/mondata.js');
const {inside_shop}=await import('../js/shk.js');
const {in_rooms}=await import('../js/hack.js');
const {inhishop}=await import('../js/monmove.js');
const {game}=await import('../js/gstate.js');
const {GameDisplay}=await import('../js/game_display.js');
const {moveloop_core}=await import('../js/allmain.js');
const {getRngLog}=await import('../js/rng.js');
const {decodeScreen,renderCell}=await import('../frozen/screen-decode.mjs');
const types=Object.fromEntries(Object.entries(ONAMES).map(([name,value])=>[value,name]));
const outputs=run=>({screens:run.getScreens(),cursors:run.getCursors(),calls:run.getRngLog(),
    slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
const outputHashes=out=>Object.fromEntries(Object.entries(out).map(([k,v])=>[k,hash(v)]));
const errorText=e=>String(e.stack || e).split('\n').slice(0,6).join('\n');

async function deferredSegment(part) {
    const display=new GameDisplay(null);
    const run=new NethackGame({...part,storage:new InMemoryStorage()});
    run._pendingDisplay=display;
    game.nhDisplay=display;
    const keys=Array.from(part.moves,ch=>ch.charCodeAt(0));
    let consumed=0,stop,atEnd;
    const exhausted=new Promise(resolve=>{atEnd=resolve;});
    const end=new Error('deferred input complete');
    display.onEmptyQueue=async()=>{
        await setImmediate();
        if(consumed<keys.length) return keys[consumed++];
        return new Promise((_resolve,reject)=>{stop=()=>reject(end);atEnd('input');});
    };
    const operation=(async()=>{
        try {await run.start();while(!game.program_state?.gameover) await moveloop_core();}
        catch(error) {if(error!==end) throw error;}
    })();
    try {
        const ended=await Promise.race([exhausted,operation.then(()=>'exit')]);
        assert.equal(ended,'input','Reach a real final pending input read');
        const output=structuredClone(outputs(run));
        await setImmediate();await setImmediate();
        return {output,consumed,eofStable:hash(output)===hash(outputs(run))};
    } finally {if(stop) stop();await operation;}
}

assert.equal(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),undefined);
const rows=[];
for(const [i,part] of proposal.segments.entries()) {
    const plan=proposal.predictions[i],states=[];
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run,error,observed;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step) {
            if(!g.u || !g.level || g.u.uz.dnum!==0 || g.u.uz.dlevel!==2) return;
            const x=g.u.ux,y=g.u.uy,roomNumber=in_rooms(x,y,SHOPBASE).charCodeAt(0);
            const resident=g.level.rooms[roomNumber-ROOMOFFSET]?.resident;
            const e=resident?.eshk,shop=inside_shop(x,y);
            const inShop=!!(resident&&e&&inhishop(resident));
            const costly=!!(g.level.flags.has_shop&&shop&&inShop&&!(x===e.shk.x&&y===e.shk.y));
            const object=o=>({id:o.o_id,type:types[o.otyp],quantity:o.quan,class:o.oclass,
                noCharge:!!o.no_charge,unpaid:!!o.unpaid,letter:o.invlet||null,
                cursed:!!o.cursed,blessed:!!o.blessed,known:!!o.known,dknown:!!o.dknown,
                bknown:!!o.bknown,contents:o.cobj?.length||0,artifact:o.oartifact||0,
                globby:!!o.globby,baseCost:g.objects[o.otyp].oc_cost,
                typeKnown:!!g.objects[o.otyp].oc_name_known,
                potionDescription:o.oclass===OCLASSES.POTION_CLASS?OBJ_DESCR(g.objects[o.otyp]):null});
            const floor=g.level.objectsAt(x,y).map(object);
            const inventory=(g.invent||[]).filter(o=>[ONAMES.PICK_AXE,ONAMES.APPLE,
                ONAMES.POT_HALLUCINATION,ONAMES.POT_FRUIT_JUICE].includes(o.otyp)).map(object);
            const keeper=resident&&e?{id:resident.m_id,inShop,peaceful:!!resident.mpeaceful,
                mute:helpless(resident)||resident.data.msound<=MSOUND.MS_ANIMAL,
                robbed:e.robbed||0,billCount:e.billct,surcharge:!!e.surcharge,
                gold:(resident.minvent||[]).filter(o=>o.oclass===OCLASSES.COIN_CLASS)
                    .reduce((n,o)=>n+o.quan,0)}:null;
            const blind=!!Blind(),deaf=!!Deaf(),hallucinating=!!Hallucination();
            const silent=!!is_silent(g.youmonst.data),strangled=!!g.u.intrinsic?.HStrangled;
            const swallowed=!!g.u.uswallow,underwater=!!Underwater();
            const eligible=!blind&&!deaf&&!silent&&!strangled&&!swallowed&&!underwater
                &&costly&&keeper?.peaceful&&!keeper.mute&&floor.some(o=>o.class!==OCLASSES.COIN_CLASS);
            states.push({step,turn:g.moves,hero:[x,y],hp:g.u.uhp,mortality:g.u.umortality||0,
                blind,deaf,hallucinating,hallucinationResistance:!!Halluc_resistance(),
                hallucinationTimeout:g.u.intrinsic?.HHallucination||0,
                hallucinationProperty:g.u.uprops?.HALLUC||0,charisma:ACURR(A_CHA),
                notHungry:(g.u.uhs??0)<HUNGRY,silent,strangled,swallowed,underwater,
                shop,costly,keeper,floor,inventory,eligible:!!eligible,
                gold:(g.invent||[]).filter(o=>o.oclass===OCLASSES.COIN_CLASS).reduce((n,o)=>n+o.quan,0),
                coreCalls:getRngLog().length});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
        observed=structuredClone(outputs(run));
    } catch(e) {error=errorText(e);}
    finally {
        if(previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    const setup=states.find(s=>s.step===31),action=states.find(s=>s.step===plan.phases.beforeAction);
    const before=states.find(s=>s.step===plan.phases.chatStart),entered=states.find(s=>s.step===plan.phases.chatEnter),last=states.at(-1);
    const item=action?.inventory.find(o=>o.type===plan.wishedType&&o.letter==='o');
    const checks=[],check=(name,condition)=>checks.push({name,pass:!!condition});
    check('original natural shop prefix reached',setup&&hash(setup.hero)===hash([75,10])
        &&hash(setup.floor.map(o=>[o.type,o.quantity,o.noCharge]))===hash([['PICK_AXE',1,false]]));
    check('real wished object held in selected inventory slot',item&&item.quantity===plan.quantity
        &&item.cursed===plan.cursed&&!item.blessed&&!item.unpaid);
    check('all keys consumed without runtime error',run&&!error&&last?.step===part.moves.length);
    check('peaceful able unrobbed resident at costly position',before?.costly&&before.keeper?.inShop
        &&before.keeper.peaceful&&!before.keeper.mute&&before.keeper.robbed===0&&before.keeper.billCount===0);
    check('original price prerequisites and charisma bracket',before&&before.charisma>=8&&before.charisma<=10
        &&before.notHungry&&!before.keeper?.surcharge
        &&before.floor.every(o=>o.typeKnown&&o.dknown&&!o.unpaid&&!o.artifact&&!o.globby&&!o.contents));
    check('exact floor record order quantity and ownership',hash(before?.floor.map(o=>[o.type,o.quantity,o.noCharge]))
        ===hash(plan.beforeChat.floorChain));
    check('actual hallucination and resistance predicates',before&&before.hallucinating===plan.hallucinating
        &&!before.hallucinationResistance&&(plan.hallucinating?before.hallucinationTimeout>0:before.hallucinationTimeout===0));
    check('other speech guards permit quote',before&&!before.blind&&!before.deaf&&!before.silent
        &&!before.strangled&&!before.swallowed&&!before.underwater&&before.eligible);
    check('real item consumed or dropped through selected action',before&&item
        &&!before.inventory.some(o=>o.id===item.id)
        &&(plan.wishedType!=='APPLE'||before.floor.some(o=>o.id===item.id&&o.quantity===2)));
    check('one real action turn before chat',action&&before&&before.turn-action.turn===1);
    check('matched sale payment or absence',action&&before&&before.gold-action.gold===plan.beforeChat.goldDeltaFromAction);
    check('survival throughout ordinary producer',states.length&&states.every(s=>s.hp>0&&s.mortality===0));
    let messages=[],quoteLines=[],chatCalls=[],enterCalls=[];
    if(observed) {
        let previousLine;
        observed.screens.forEach((screen,step)=>{
            if(step<31) return;
            const lines=decodeScreen(screen).map(row=>row.map(renderCell).join('').trimEnd());
            if(lines[0]!==previousLine) messages.push({step,text:lines[0]});
            previousLine=lines[0];
            if(step>=plan.phases.chatEnter)
                quoteLines.push(...lines.filter(line=>/price 67 |Fine goods for sale:|apples,|pick-axe,|Talk to whom/.test(line)));
        });
        quoteLines=[...new Set(quoteLines)];
        chatCalls=observed.slices.slice(plan.phases.chatStart+1).flat();
        enterCalls=observed.slices[plan.phases.chatEnter]||[];
    }
    check('source-derived producer feedback',messages.some(m=>m.text.includes(plan.C.producerPhrase)));
    check('source-derived quote phrases',plan.C.requiredPhrases.every(s=>quoteLines.some(line=>line.includes(s))));
    check('quote preempts direction prompt',quoteLines.length&&!quoteLines.some(line=>line.includes('Talk to whom?')));
    check('quote consumes exactly one turn',before&&last&&last.turn-before.turn===1);
    check('multiple records wait in menu before turn processing',plan.kind!=='multiple'||entered?.turn===before?.turn);
    check('sober menu waits before any core random call',plan.kind!=='multiple'||enterCalls.length===0);
    check('scoped object state survives chat unchanged',before&&last
        &&hash([before.floor,before.inventory])===hash([last.floor,last.inventory]));
    check('all output boundaries present',observed&&['screens','cursors','slices','frames']
        .every(k=>observed[k].length===part.moves.length+1));
    check('ordered slices preserve full core log',observed&&hash(observed.slices.flat())===hash(observed.calls));
    const bounds=chatCalls.map(c=>/^rn2\((\d+)\)=/.exec(c)).map(m=>m?Number(m[1]):null);
    let order='not reached';
    if(plan.hallucinating&&bounds[0]===21) {
        if(bounds[1]===21&&bounds[2]===3) order='currency then embellishment';
        else if(bounds[1]===3&&(bounds[2]===21||bounds[2]===5&&bounds[3]===21)) order='embellishment then currency';
    }
    check('owner RNG prefix respects source constraints',plan.hallucinating?order!=='not reached'
        :plan.kind==='multiple'?enterCalls.length===0:bounds[0]===3);
    // This is a JS observation check only. Neither ordering is a C oracle.
    const jsOrderMatchesSource=plan.hallucinating?order==='currency then embellishment'
        :plan.kind==='multiple'?enterCalls.length===0:bounds[0]===3;
    let plain,deferred,plainError,deferredError,plainConsumed;
    try {const p=await runSegment({...part,storage:new InMemoryStorage()});plain=structuredClone(outputs(p));plainConsumed=part.moves.length-p._display.inputQueueLength;}
    catch(e) {plainError=errorText(e);}
    try {deferred=await deferredSegment(part);}catch(e) {deferredError=errorText(e);}
    const neutrality={observedEqualsPlain:!!observed&&!!plain&&hash(observed)===hash(plain),
        plainEqualsDeferred:!!plain&&!!deferred&&hash(plain)===hash(deferred.output),
        eofStable:!!deferred?.eofStable,plainConsumed,deferredConsumed:deferred?.consumed,
        expectedConsumed:part.moves.length,plainError,deferredError,
        hashes:{observed:observed?outputHashes(observed):null,plain:plain?outputHashes(plain):null,
            deferred:deferred?outputHashes(deferred.output):null}};
    neutrality.pass=neutrality.observedEqualsPlain&&neutrality.plainEqualsDeferred&&neutrality.eofStable
        &&plainConsumed===part.moves.length&&deferred?.consumed===part.moves.length;
    const row={name:part.name,negative:plan.negative,pass:checks.every(c=>c.pass)&&neutrality.pass,
        checks,firstUnmet:checks.find(c=>!c.pass)?.name||null,error,keys:part.moves.length,
        boundaries:observed?.screens.length,calls:observed?.calls.length,frames:observed?.frames.flat().length,
        outputHashes:observed?outputHashes(observed):null,setup,action,beforeChat:before,atChatEnter:entered,final:last,
        messages,quoteLines,chatCallCount:chatCalls.length,chatCallPrefix:chatCalls.slice(0,16),
        enterCallPrefix:enterCalls.slice(0,16),enterCallCount:enterCalls.length,
        statesSHA256:hash(states),stateCount:states.length,neutrality,jsOrderMatchesSource,
        observedJSOrder:order,compiledCArgumentOrder:'unknown',nativeParityClaimed:false};
    rows.push(row);
    appendFileSync(new URL('reports/probe01-progress.ndjson',root),JSON.stringify({name:row.name,pass:row.pass,
        checks:checks.filter(c=>c.pass).length,total:checks.length,firstUnmet:row.firstUnmet,neutrality:neutrality.pass})+'\n');
}
const report={runtimeSHA256:pins.runtimeSHA256,proposalSHA256:pins.proposalSHA256,
    inputLockSHA256:pins.inputLockSHA256,pass:rows.every(r=>r.pass),cases:rows.length,
    passed:rows.filter(r=>r.pass).length,checks:rows.flatMap(r=>r.checks).filter(c=>c.pass).length,
    totalChecks:rows.flatMap(r=>r.checks).length,neutrality:rows.filter(r=>r.neutrality.pass).length,
    compiledCArgumentOrder:'unknown',runtimeCandidate:false,referenceCExecutions:0,rows};
writeFileSync(new URL('reports/probe01.json',root),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const negatives={runtimeSHA256:pins.runtimeSHA256,proposalSHA256:pins.proposalSHA256,
    reportSHA256:sha(readFileSync(new URL('reports/probe01.json',root))),
    rows:rows.filter(r=>r.negative).map(r=>({name:r.name,completeRowSHA256:hash(r),outputHashes:r.outputHashes,
        reached:r.pass,neutrality:r.neutrality.pass}))};
writeFileSync(new URL('negative-output-lock.json',root),JSON.stringify(negatives,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:report.pass,cases:report.passed,total:report.cases,checks:report.checks,
    totalChecks:report.totalChecks,neutrality:report.neutrality,
    failures:rows.filter(r=>!r.pass).map(r=>({name:r.name,firstUnmet:r.firstUnmet,error:r.error,
        failed:r.checks.filter(c=>!c.pass).map(c=>c.name)})),compiledCArgumentOrder:'unknown'}));
if(!report.pass) process.exitCode=1;
