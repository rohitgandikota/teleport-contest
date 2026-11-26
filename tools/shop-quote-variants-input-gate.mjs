// C shk.c:5386-5503 and invent.c:1521-1554, ordinary quote variants.
// Coverage only. Compiled argument order is observed for the pinned binary/call.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const hash=v=>sha(JSON.stringify(v ?? null));
assert(process.argv.length<=3&&!process.argv[2]?.startsWith('--'),
    'usage: shop-quote-variants-input-gate.mjs [new-report.json]');
const reportFile=process.argv[2];
assert(!reportFile||!existsSync(reportFile),'report must be a new file');
const evidence=new URL('gen-sessions/evidence/shop-quote-variants/',import.meta.url);
const evidencePins={
    "compiled-order.json": "2d9d879b5f1e53fc27897586f98dab69d9e4ee2c8a185380032ef2b00288b4b3",
    "gate-derivation.json": "95cba6a4a6703750f8a1c255ebaf2aba0f7cac6c129513393d58b11255d43d4e",
    "input-lock.json": "e1669b668fde88e6fd7294c84fd9465939ee03c32675090dcdb73bd2a03a8cbe",
    "native-preflight.json": "d90dfd35de9e90c0044b609c2208da3e609d5786b479fbe22e4f0aa7fe7869b5",
    "native-result-command.json": "4e151a46a53eccad23bd9e81037184d104ed5674cb19725691d157c0ce354ff5",
    "native-result.json": "57b635dde6af7c43b367220e264fcaa9c55eb68357c5368e5c1fc176b7549bce",
    "negative-output-lock.json": "2202e75bec55a1f31b40084d14025a3078ee2a2f92a3df7858a532a5fbef7a5c",
    "ordinary-original.mjs": "e81f65fa810eebae0d047057c38c5cd6c8aaaabb00c60f37f92447843a2e4281",
    "parent-input-lock.json": "47228f2487f038726c5e03f0bc8d37ccbca82613b39123d5744fffee7859db29",
    "proposal-original.json": "a3b8b5799599bb524c40b55ebd03a8434fde9a0b48c24e989644059c128c7420",
    "recording-receipt.json": "936973707aa03eaab3517c34227813263f8a091a0c68c4ccbe562c2872ca73cc",
    "source-observation-run.json": "551acb6588781d54d838bab7109714a70e093f3c42a6b1ddc27a544bfae51c9b",
    "source-observation.json": "773346152d385afe8fc3ed9e46fa8622e1875698df465a6cb82d741169396ec3",
    "source-review-original.md": "9e4a8ffe34d20fb2cada99f21dc486a7ccfeb1549696e61e39a5e19e1ac7fc36",
    "source-seal.json": "d5116395c46abe24601fad30c36928502254fc370fdef1d79d035c999af67acb"
};
for(const [name,expected] of Object.entries(evidencePins))
    assert.equal(sha(readFileSync(new URL(name,evidence))),expected,name);
const read=name=>JSON.parse(readFileSync(new URL(name,evidence)));
const proposal=read('proposal-original.json'),lock=read('input-lock.json');
const negative=read('negative-output-lock.json'),parentLock=read('parent-input-lock.json');
const receipt=read('recording-receipt.json'),orderEvidence=read('compiled-order.json');
const sourceSeal=read('source-seal.json'),sourceObservation=read('source-observation.json');
const recipeBytes=readFileSync(new URL('gen-sessions/recipes/shop-chat-quote-variants.json',import.meta.url));
assert.equal(sha(recipeBytes),'10663b6efb6ee81126111b46adaa71fda5d28b7e15bdfbce0c01472517b311da','primary recipe SHA');
const recipe=JSON.parse(recipeBytes);
assert.equal(lock.proposalSHA256,evidencePins['proposal-original.json']);
assert.equal(lock.lockedBeforeProbe,true);
assert.equal(parentLock.beforeC,true);
assert.equal(parentLock.sourceSealSHA256,evidencePins['source-seal.json']);
assert.equal(parentLock.sourceManifestSHA256,sourceSeal.manifestSHA256);
assert.equal(parentLock.primaryRecipeSHA256,sha(recipeBytes));
assert.equal(parentLock.minimalSHA256,sha(recipeBytes));
assert.equal(parentLock.negativeSHA256,evidencePins['negative-output-lock.json']);
assert.equal(sourceSeal.inputLockSHA256,evidencePins['input-lock.json']);
assert.equal(sourceSeal.proposalSHA256,lock.proposalSHA256);
assert.equal(negative.proposalSHA256,lock.proposalSHA256);
assert.equal(negative.reportSHA256,sourceSeal.reportSHA256);
assert.equal(sourceObservation.reportSHA256,sourceSeal.reportSHA256);
assert.equal(receipt.exit,0);
assert.equal(receipt.cExecutedOnce,true);
assert.equal(receipt.inputSHA256,sha(recipeBytes));
assert.equal(receipt.primaryRecipeSHA256,sha(recipeBytes));
const rawBytes=readFileSync(new URL('gen-sessions/generated/shop-chat-quote-variants.session.json',import.meta.url));
assert.equal(sha(rawBytes),'5f2300ac9bd795957e260d1f990b2b443384aeba86cadf0d3ba434afa331d491','canonical C raw SHA');
assert.equal(rawBytes.length,1798206);
assert.equal(receipt.rawSha256,sha(rawBytes));
const native=JSON.parse(rawBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);
for(const field of Object.keys(recipe)) {
    if(field==='segments') continue;
    assert.equal(Object.hasOwn(native,field),true,field);
    assert.deepEqual(native[field],recipe[field],field);
}
assert.equal(recipe.requireBranchAssertions,true);
assert.deepEqual(recipe.segments,proposal.segments);
for(const value of [recipe.segments,proposal.segments,lock.segments,native.segments,
    recipe.branches,recipe.branchAssertions]) assert.equal(value.length,4);
assert.deepEqual(lock.fields,['name','seed','datetime','nethackrc','moves']);
let keys=0,boundaries=0;
for(const [i,part] of proposal.segments.entries()) {
    const fields=lock.fields.map(field=>({field,present:Object.hasOwn(part,field),value:part[field]}));
    assert.deepEqual(fields,lock.segments[i].fields);
    assert.equal(hash(fields),lock.segments[i].fieldsSHA256);
    assert.equal(sha(part.moves),lock.segments[i].movesSHA256);
    assert.deepEqual([...Buffer.from(part.moves)],lock.segments[i].keys);
    assert.equal(part.moves.length,lock.segments[i].keyCount);
    for(const field of lock.fields) {
        assert.equal(Object.hasOwn(native.segments[i],field),Object.hasOwn(part,field));
        assert.deepEqual(native.segments[i][field],part[field]);
    }
    assert.deepEqual(native.segments[i].steps.map(s=>s.key),[null,...part.moves]);
    assert.equal(recipe.branchAssertions[i].branch,recipe.branches[i]);
    assert.equal(recipe.branchAssertions[i].segment,i);
    assert.deepEqual(recipe.branchAssertions[i].screenIncludes,
        [proposal.predictions[i].C.producerPhrase,...proposal.predictions[i].C.requiredPhrases]);
    keys+=part.moves.length;boundaries+=native.segments[i].steps.length;
}
assert.equal(keys,332);assert.equal(keys,lock.totalKeys);assert.equal(boundaries,336);
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(recipe,native),[]);
assert.equal(negative.rows.length,3);
assert.equal(negative.rows.reduce((n,r)=>n+Object.keys(r.outputHashes).length,0),15);
assert.deepEqual(negative.rows.map(r=>r.name),proposal.segments
    .filter((_s,i)=>proposal.predictions[i].negative).map(s=>s.name));
const nativeResult=read('native-result.json');
assert.equal(nativeResult.length,4);
for(const [i,row] of nativeResult.entries()) {
    assert.equal(row.name,proposal.segments[i].name);
    for(const field of ['frozenScreenCursorExact','fullRngExact','fullStyleExact','animationExact'])
        assert.equal(row[field],true,field);
}
assert.equal(orderEvidence.rawSHA256,sha(rawBytes));
assert.equal(orderEvidence.nativeResultSHA256,evidencePins['native-result.json']);
assert.equal(orderEvidence.binarySHA256,receipt.binarySha256);
assert.equal(orderEvidence.recorderSHA256,receipt.recorderSha256);
assert.equal(orderEvidence.segment,0);
assert.equal(orderEvidence.boundary,proposal.predictions[0].phases.chatEnter);
const recordedCalls=native.segments[0].steps[orderEvidence.boundary].rng.slice(0,3);
assert.deepEqual(recordedCalls,orderEvidence.CAnnotatedPrefix);
const expectedCalls=recordedCalls.map(call=>call.split(' @ ')[0]);
const original=readFileSync(new URL('ordinary-original.mjs',evidence),'utf8');
const current=readFileSync(new URL(import.meta.url),'utf8');
const derivation=read('gate-derivation.json');
const preserved=script=>{
    const first=script.indexOf('\nconst {runSegment,NethackGame}')+1;
    const last=script.indexOf('\n    rows.push(row);',first)+1;
    assert(first>0&&last>first);
    return script.slice(first,last)+'    rows.push(row);\n}\n';
};
assert.equal(sha(preserved(original)),derivation.preservedBodySHA256);
assert.equal(preserved(current),preserved(original));
const preflight={rawSHA256:sha(rawBytes),primaryRecipeSHA256:sha(recipeBytes),
    source:'c',version:5,cases:4,keys,boundaries,primaryPredicates:4,
    rootMetadata:true,fiveFieldsAndPresence:true,allBoundaryKeys:true,
    integrityErrors:0,beforeGameImports:true};

// All tested game imports follow the complete canonical data preflight.
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
}

// Original row bodies and historical metadata stay untouched for hash comparison.
const negatives=rows.filter(row=>row.negative).map(row=>{
    const saved=negative.rows.find(r=>r.name===row.name);
    return {name:row.name,completeRow:hash(row)===saved.completeRowSHA256,
        hashes:Object.keys(saved.outputHashes).filter(key=>row.outputHashes?.[key]===saved.outputHashes[key]).length};
});
const recordedOrder={segment:0,boundary:orderEvidence.boundary,
    expected:expectedCalls,actual:rows[0].enterCallPrefix.slice(0,3),
    pass:hash(rows[0].enterCallPrefix.slice(0,3))===hash(expectedCalls),
    scope:'Observed for the pinned C binary, call and input only'};
const report={pass:rows.every(r=>r.pass)&&negatives.every(r=>r.completeRow&&r.hashes===5)&&recordedOrder.pass,
    preflight,cases:rows.length,passed:rows.filter(r=>r.pass).length,
    checks:rows.flatMap(r=>r.checks).filter(c=>c.pass).length,
    totalChecks:rows.flatMap(r=>r.checks).length,neutrality:rows.filter(r=>r.neutrality.pass).length,
    negativeHashes:negatives.reduce((n,r)=>n+r.hashes,0),
    completeNegativeRows:negatives.filter(r=>r.completeRow).length,negatives,recordedOrder,
    parentNative:{cases:4,exact:4,reportSHA256:evidencePins['native-result.json'],
        runtimeSHA256:orderEvidence.runtimeSHA256,replayedHere:false},
    runtimeChanges:0,referenceCExecutions:0,
    rows:rows.map(r=>({name:r.name,negative:r.negative,pass:r.pass,checks:r.checks,
        firstUnmet:r.firstUnmet,error:r.error,keys:r.keys,boundaries:r.boundaries,calls:r.calls,frames:r.frames,
        outputHashes:r.outputHashes,completeRowSHA256:hash(r),statesSHA256:r.statesSHA256,
        enterCallPrefix:r.enterCallPrefix.slice(0,3),neutrality:r.neutrality}))};
if(reportFile) writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:report.pass,cases:report.passed,total:report.cases,
    checks:report.checks,totalChecks:report.totalChecks,neutrality:report.neutrality,
    negativeHashes:report.negativeHashes,completeNegativeRows:report.completeNegativeRows,
    recordedOrder:recordedOrder.pass,preflight:4,
    failures:rows.filter(r=>!r.pass).map(r=>({name:r.name,firstUnmet:r.firstUnmet,error:r.error})),
    reportFile:reportFile||null}));
if(!report.pass) process.exitCode=1;
