// C shk.c:2995-3042,5386-5503, real container and floor-coin quote coverage.
// No runtime change. Every original source assertion is retained below.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const hash=v=>sha(JSON.stringify(v ?? null));
assert(process.argv.length<=3&&!process.argv[2]?.startsWith('--'),
    'usage: shop-chat-quote-container-coins-input-gate.mjs [new-report.json]');
const reportFile=process.argv[2];
assert(!reportFile||!existsSync(reportFile),'report must be a new file');
const evidence=new URL('gen-sessions/evidence/shop-chat-quote-container-coins/',import.meta.url);
const evidencePins={
    "gate-derivation.json": "6a669166e97dd2e819829f6875a08b8ae2738b747c082be70bfeb923bb6294e4",
    "input-lock.json": "2e4cec08774865b0ce7b4eacfbc37f26ef990ce15b35c7933e1b3bca33b93027",
    "native-preflight.json": "1d97ce72d660241c1ecca5a1ba2878eaad75b1acc320ef4ea7c108f8184605d9",
    "native-result-command.json": "6f1f392530de88786a62d0d3b747ea7c5edca2bc69d2c2d7e80452437c6ba14b",
    "native-result.json": "6e97f16c72cb37b07391ebfd19f7b606bdff4f2347663fa046223c434ecdd0cc",
    "negative-output-lock.json": "897e1dfa279b5c2a313f33c0bbe1c4802442672dc182441eba914444f1c919ef",
    "ordinary-original.mjs": "8c3f6fd88bb8d6ea70f5dc494f821416c99cb3df5a3c90031c4761415f2f8d09",
    "parent-input-lock.json": "37f817c3e200ccdc8115ed28410b11d4e19283c7dc1406b7782ff06b8b24cf7f",
    "prior-ranges-revalidated.json": "79d7be64c7f0cc225bf10fdac01c3ff96741e203a655f1c23eb59fc1fc7299ef",
    "proposal-original.json": "fe11658e1b5d300ef53b8e9bc8bd0c22e23e7ff09c13d77faa5d65b9126e61f9",
    "recording-receipt.json": "393aff80f17d06c7dd2fd4f1b682afd2b8d99d766d6c3f775de2f80f8afaeacd",
    "source-observation-run.json": "e0bcbd508f5fc1e87a8a2030c3719ed161cdc57cb129684532ddbbeb94109501",
    "source-observation.json": "e4d4cc01db345021677029ce5fde90c1cbfbaebbbf019491c3ff4092291a0c26",
    "source-pins.json": "35c40d34c594236fe50e49cf1b26bc883c1e59043cbfa7aa2fee851c7df776a7",
    "source-ranges.json": "6cbcca98d56499f411c06e1a887964117dca5fcf05ba5032fdfc157bcb2c3598",
    "source-review-original.md": "60d9f93c7199d12641b1a7bbc011aa3fa8aad6c802b6b7c877a92e8daac04353",
    "source-seal.json": "1c088664d68120be7de45b90f08609f9935fbf497d2e31e7c7619ed1914cc8ce"
};
for(const [name,expected] of Object.entries(evidencePins))
    assert.equal(sha(readFileSync(new URL(name,evidence))),expected,name);
const read=name=>JSON.parse(readFileSync(new URL(name,evidence)));
const proposal=read('proposal-original.json'),lock=read('input-lock.json');
const negative=read('negative-output-lock.json'),parentLock=read('parent-input-lock.json');
const receipt=read('recording-receipt.json'),sourceSeal=read('source-seal.json');
const sourcePins=read('source-pins.json'),sourceObservation=read('source-observation.json');
for(const [original,copy] of Object.entries({
    'tools/probe.mjs':'ordinary-original.mjs','SOURCE-REVIEW.md':'source-review-original.md',
    'source-ranges.json':'source-ranges.json','prior-ranges-revalidated.json':'prior-ranges-revalidated.json',
    'proposals/proposal01.json':'proposal-original.json','input-lock.json':'input-lock.json'}))
    assert.equal(sourcePins.files[original],evidencePins[copy],original);
assert.equal(sourcePins.runtimeSHA256,sourceSeal.runtimeSHA256);
assert.equal(sourceSeal.driverSHA256,evidencePins['ordinary-original.mjs']);
assert.equal(sourceSeal.inputLockSHA256,evidencePins['input-lock.json']);
assert.equal(sourceSeal.negativeLockSHA256,evidencePins['negative-output-lock.json']);
assert.equal(sourceSeal.proposalSHA256,evidencePins['proposal-original.json']);
assert.equal(lock.proposalSHA256,sourceSeal.proposalSHA256);
assert.equal(lock.lockedBeforeProbe,true);
assert.equal(negative.proposalSHA256,lock.proposalSHA256);
assert.equal(negative.reportSHA256,sourceSeal.reportSHA256);
assert.equal(sourceObservation.reportSHA256,sourceSeal.reportSHA256);
const recipeBytes=readFileSync(new URL('gen-sessions/recipes/shop-chat-quote-container-coins.json',import.meta.url));
assert.equal(sha(recipeBytes),'b081d06aa2772de90233b0e05d8da34acf33045008d64153c966504035dc383e','primary recipe SHA');
const recipe=JSON.parse(recipeBytes);
assert.equal(parentLock.beforeC,true);
assert.equal(parentLock.sourceSealSHA256,evidencePins['source-seal.json']);
for(const field of ['sourceRecipeSHA256','primaryRecipeSHA256','minimalSHA256'])
    assert.equal(parentLock[field],sha(recipeBytes),field);
assert.equal(sourceSeal.primaryRecipeSHA256,sha(recipeBytes));
assert.equal(receipt.exit,0);assert.equal(receipt.cExecutedOnce,true);
assert.equal(receipt.sourceSealSHA256,evidencePins['source-seal.json']);
assert.equal(receipt.inputSHA256,sha(recipeBytes));
assert.equal(receipt.primaryRecipeSHA256,sha(recipeBytes));
const rawBytes=readFileSync(new URL('gen-sessions/generated/shop-chat-quote-container-coins.session.json',import.meta.url));
assert.equal(sha(rawBytes),'3451c03e9184ea8e10da7efa9a131c9b9107d29d6da704cf003115cf8a63a17c','canonical C raw SHA');
assert.equal(rawBytes.length,3013909);assert.equal(receipt.rawSha256,sha(rawBytes));
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
    recipe.branches,recipe.branchAssertions]) assert.equal(value.length,6);
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
        [...proposal.predictions[i].C.producerPhrases,...proposal.predictions[i].C.requiredPhrases]);
    keys+=part.moves.length;boundaries+=native.segments[i].steps.length;
}
assert.equal(keys,605);assert.equal(keys,lock.totalKeys);assert.equal(boundaries,611);
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(recipe,native),[]);
assert.equal(native.segments.flatMap(s=>s.steps).flatMap(s=>s.rng||[]).length,32241);
assert.equal(native.segments.flatMap(s=>s.steps).flatMap(s=>s.animation_frames||[]).length,0);
assert.equal(negative.rows.length,3);
assert.equal(negative.rows.reduce((n,r)=>n+Object.keys(r.outputHashes).length,0),15);
assert.deepEqual(negative.rows.map(r=>r.name),proposal.segments
    .filter((_s,i)=>proposal.predictions[i].negative).map(s=>s.name));
const parentNative=read('native-result.json');
assert.equal(parentNative.length,6);
for(const [i,row] of parentNative.entries()) {
    assert.equal(row.name,proposal.segments[i].name);
    for(const field of ['frozenScreenCursorExact','fullRngExact','fullStyleExact','animationExact'])
        assert.equal(row[field],true,field);
}
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
    source:'c',version:5,cases:6,keys,boundaries,primaryPredicates:6,
    rootMetadata:true,fiveFieldsAndPresence:true,allBoundaryKeys:true,
    integrityErrors:0,sourceBodyUnchanged:true,beforeGameImports:true};

// Retain every RNG entry; remove only recording annotations and numeric prefixes.
// Screen equality includes color/attributes on blank cells, as in the native gate.
const nativeChecks=[];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const coreCalls=entries=>entries.map(entry=>{
    const call=String(entry).replace(/\s*@\s.*$/,'').replace(/^\d+\s+/,'').trim();
    assert.match(call,/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/,'every entry is a retained core RNG call');
    return call;
});
function firstDifference(expected,actual) {
    for(let i=0;i<Math.max(expected.length,actual.length);i++)
        if(!same(expected[i],actual[i])) return {index:i,expected:expected[i]??null,actual:actual[i]??null};
    return null;
}
function screenDifference(expected,actual) {
    if(actual===undefined) return {missing:true};
    const c=decodeScreen(expected),j=decodeScreen(actual);
    for(let y=0;y<24;y++)for(let x=0;x<80;x++) {
        const a=[renderCell(c[y][x]),c[y][x].color,c[y][x].attr];
        const b=[renderCell(j[y][x]),j[y][x].color,j[y][x].attr];
        if(!same(a,b)) return {x,y,expected:a,actual:b};
    }
    return null;
}
function compareNative(part,actual) {
    if(!actual) return {name:part.name,pass:false,error:'no observed output'};
    const steps=part.steps,calls=coreCalls(steps.flatMap(s=>s.rng||[]));
    const slices=steps.map(s=>coreCalls(s.rng||[]));
    const actualCalls=coreCalls(actual.calls),actualSlices=actual.slices.map(coreCalls);
    let firstStyle=null,firstFrame=null;
    for(const [step,c] of steps.entries()) {
        const style=screenDifference(c.screen,actual.screens[step]);
        if(style) firstStyle??={step,...style};
        const cf=c.animation_frames||[],jf=actual.frames[step]||[];
        if(cf.length!==jf.length) firstFrame??={step,expected:cf.length,actual:jf.length};
        for(const [frame,value] of cf.entries()) {
            const d=screenDifference(value.screen,jf[frame]?.screen);
            if(d||!same(value.cursor,jf[frame]?.cursor))
                firstFrame??={step,frame,style:d,expectedCursor:value.cursor,actualCursor:jf[frame]?.cursor??null};
        }
    }
    const cursorDifference=firstDifference(steps.map(s=>s.cursor),actual.cursors);
    const callDifference=firstDifference(calls,actualCalls);
    let sliceDifference=null;
    for(let step=0;step<Math.max(slices.length,actualSlices.length);step++) {
        if(same(slices[step],actualSlices[step])) continue;
        sliceDifference={step,expected:slices[step]?.length??null,actual:actualSlices[step]?.length??null,
            firstCall:firstDifference(slices[step]||[],actualSlices[step]||[])};
        break;
    }
    const frameCount=steps.flatMap(s=>s.animation_frames||[]).length;
    const result={name:part.name,boundaries:{expected:steps.length,actual:actual.screens.length},
        fullStyleExact:steps.length===actual.screens.length&&!firstStyle,firstStyle,
        cursorsExact:!cursorDifference,cursorDifference,
        fullRngExact:!callDifference&&!sliceDifference,
        calls:{expected:calls.length,actual:actualCalls.length,discardedEntries:0,firstDifference:callDifference},
        slices:{expected:slices.length,actual:actualSlices.length,firstDifference:sliceDifference},
        animationExact:actual.frames.length===steps.length&&!firstFrame,
        frames:{expected:frameCount,actual:actual.frames.flat().length,firstDifference:firstFrame},
        normalizedHashes:{c:{calls:hash(calls),slices:hash(slices)},js:{calls:hash(actualCalls),slices:hash(actualSlices)}}};
    result.pass=result.fullStyleExact&&result.cursorsExact&&result.fullRngExact&&result.animationExact;
    return result;
}

// All tested game imports follow the complete canonical data preflight.
const {runSegment,NethackGame}=await import('../js/jsmain.js');
const {InMemoryStorage}=await import('../js/storage.js');
const {ONAMES,OCLASSES}=await import('../js/objects_data.js');
const {MSOUND}=await import('../js/monst_data.js');
const {SHOPBASE,ROOMOFFSET,A_CHA,HUNGRY,OBJ_FLOOR,OBJ_INVENT,OBJ_CONTAINED}=await import('../js/const.js');
const {Blind,Deaf,Hallucination,Underwater,Confusion,Stunned,Levitation}=await import('../js/youprop.js');
const {ACURR}=await import('../js/attrib.js');
const {helpless,is_silent,nohands}=await import('../js/mondata.js');
const {inside_shop}=await import('../js/shk.js');
const {in_rooms}=await import('../js/hack.js');
const {inhishop}=await import('../js/monmove.js');
const gstate=await import('../js/gstate.js');
const {GameDisplay}=await import('../js/game_display.js');
const {moveloop_core}=await import('../js/allmain.js');
const {getRngLog}=await import('../js/rng.js');
const {decodeScreen,renderCell}=await import('../frozen/screen-decode.mjs');
const types=Object.fromEntries(Object.entries(ONAMES).map(([name,value])=>[value,name]));
const outputs=run=>({screens:run.getScreens(),cursors:run.getCursors(),calls:run.getRngLog(),
    slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
const outputHashes=out=>Object.fromEntries(Object.entries(out).map(([k,v])=>[k,hash(v)]));
const errorText=e=>String(e.stack||e).split('\n').slice(0,6).join('\n');
async function deferredSegment(part) {
    const display=new GameDisplay(null);
    const run=new NethackGame({...part,storage:new InMemoryStorage()});
    run._pendingDisplay=display;
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
        try {await run.start();while(!gstate.game.program_state?.gameover) await moveloop_core();}
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
            if(!g.u||!g.level||g.u.uz.dnum!==0||g.u.uz.dlevel!==2) return;
            const x=g.u.ux,y=g.u.uy,roomNumber=in_rooms(x,y,SHOPBASE).charCodeAt(0);
            const resident=g.level.rooms[roomNumber-ROOMOFFSET]?.resident,e=resident?.eshk;
            const shop=inside_shop(x,y),inShop=!!(resident&&e&&inhishop(resident));
            const costly=!!(g.level.flags.has_shop&&shop&&inShop&&!(x===e.shk.x&&y===e.shk.y));
            const object=o=>({id:o.o_id,type:types[o.otyp],quantity:o.quan,class:o.oclass,
                where:o.where,parent:o.ocontainer?.o_id??null,position:[o.ox,o.oy],
                nextHere:o.nexthere?.o_id??null,noCharge:!!o.no_charge,unpaid:!!o.unpaid,
                letter:o.invlet||null,known:!!o.known,dknown:!!o.dknown,bknown:!!o.bknown,
                cknown:!!o.cknown,lknown:!!o.lknown,locked:!!o.olocked,trapped:!!o.otrapped,
                cursed:!!o.cursed,blessed:!!o.blessed,artifact:o.oartifact||0,globby:!!o.globby,
                worn:o.owornmask||0,baseCost:g.objects[o.otyp].oc_cost,
                typeKnown:!!g.objects[o.otyp].oc_name_known,contents:(o.cobj||[]).map(object)});
            const floor=g.level.objectsAt(x,y).map(object);
            const wanted=[ONAMES.SACK,ONAMES.PICK_AXE,ONAMES.APPLE,ONAMES.GOLD_PIECE];
            const inventory=(g.invent||[]).filter(o=>wanted.includes(o.otyp)).map(object);
            const keeper=resident&&e?{id:resident.m_id,position:[resident.mx,resident.my],inShop,
                peaceful:!!resident.mpeaceful,mute:helpless(resident)||resident.data.msound<=MSOUND.MS_ANIMAL,
                robbed:e.robbed||0,billCount:e.billct,credit:e.credit||0,debit:e.debit||0,loan:e.loan||0,
                surcharge:!!e.surcharge,bill:e.bill_p?.slice?.(0,e.billct).map(b=>({id:b.bo_id,quantity:b.bquan,price:b.price,used:!!b.useup}))||[]}:null;
            const blind=!!Blind(),deaf=!!Deaf(),hallucinating=!!Hallucination();
            const silent=!!is_silent(g.youmonst.data),strangled=!!g.u.intrinsic?.HStrangled;
            const swallowed=!!g.u.uswallow,underwater=!!Underwater();
            const speech=!blind&&!deaf&&!silent&&!strangled&&!swallowed&&!underwater;
            states.push({step,turn:g.moves,hero:[x,y],hp:g.u.uhp,mortality:g.u.umortality||0,
                terrain:g.level.at(x,y).typ,blind,deaf,hallucinating,silent,strangled,swallowed,underwater,
                confused:!!Confusion(),stunned:!!Stunned(),levitating:!!Levitation(),nohands:!!nohands(g.youmonst.data),
                charisma:ACURR(A_CHA),notHungry:(g.u.uhs??0)<HUNGRY,shop,costly,keeper,floor,inventory,
                speech,eligible:!!(speech&&costly&&keeper?.peaceful&&!keeper.mute&&floor.some(o=>o.class!==OCLASSES.COIN_CLASS)),
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
    const at=name=>states.find(s=>s.step===plan.phases[name]);
    const setup=at('setup'),before=at('chatStart'),entered=at('chatEnter'),last=states.at(-1);
    const sackWish=at('sackWish'),pickup=at('pickup'),appleWish=at('appleWish'),sackDrop=at('sackDrop');
    const goldWish=at('goldWish'),goldDrop=at('goldDrop');
    const container=plan.kind.startsWith('container');
    const bag=before?.floor.find(o=>o.type==='SACK');
    const pickaxe=s=>s&&[...s.floor,...s.inventory,...s.floor.flatMap(o=>o.contents)].find(o=>o.type==='PICK_AXE');
    const stock=pickaxe(setup),currentStock=pickaxe(before);
    const checks=[],check=(name,condition)=>checks.push({name,pass:!!condition});
    check('maintained natural shop prefix reached',setup&&hash(setup.hero)===hash([75,10])
        &&hash(setup.floor.map(o=>[o.type,o.quantity,o.noCharge]))===hash([['PICK_AXE',1,false]]));
    check('all keys consumed without runtime error',run&&!error&&last?.step===part.moves.length);
    check('peaceful able unrobbed resident at costly spot',before?.costly&&before.keeper?.inShop
        &&before.keeper.peaceful&&!before.keeper.mute&&before.keeper.robbed===0);
    check('normal speech and manipulation prerequisites',before?.speech&&!before.hallucinating
        &&!before.confused&&!before.stunned&&!before.levitating&&!before.nohands);
    check('known natural stock price prerequisites',before&&before.charisma>=8&&before.charisma<=10&&before.notHungry
        &&!before.keeper?.surcharge&&currentStock?.baseCost===50&&currentStock.typeKnown&&currentStock.dknown
        &&!currentStock.artifact&&!currentStock.globby);
    check('same actual natural stock survives setup',stock&&currentStock?.id===stock.id&&currentStock.quantity===1);
    check('exact floor chain order and ownership',hash(before?.floor.map(o=>[o.type,o.quantity,o.noCharge]))===hash(plan.floor));
    check('floor linked chain agrees with observed pile',before&&before.floor.every((o,j)=>o.where===OBJ_FLOOR
        &&o.nextHere===(before.floor[j+1]?.id??null)&&hash(o.position)===hash(before.hero)));
    check('real empty sack wish in selected slot',!container||(sackWish?.inventory.some(o=>o.type==='SACK'
        &&o.letter==='o'&&o.quantity===1&&!o.unpaid&&!o.cursed&&!o.blessed&&!o.contents.length)));
    check('real natural pickup preserves bill and identity',!plan.phases.pickup||(pickup&&stock&&pickup.keeper?.billCount===1
        &&pickup.inventory.some(o=>o.id===stock.id&&o.unpaid&&!o.noCharge&&o.where===OBJ_INVENT)));
    check('real two-apple wish in selected slot',!plan.phases.appleWish||appleWish?.inventory.some(o=>o.type==='APPLE'
        &&o.letter===(container?'q':'o')&&o.quantity===2&&!o.unpaid&&!o.cursed&&!o.blessed));
    check('refused sack sale leaves owned empty floor container',!container||(sackDrop?.floor.length===1
        &&sackDrop.floor[0].type==='SACK'&&sackDrop.floor[0].noCharge&&!sackDrop.floor[0].unpaid
        &&sackDrop.floor[0].contents.length===0&&sackDrop.keeper.billCount===1&&sackDrop.gold===setup?.gold));
    check('container remains owned with learned contents',!container||(bag&&bag.noCharge&&!bag.unpaid&&bag.cknown&&!bag.locked&&!bag.trapped));
    check('exact contents identity quantity and ownership',!container||hash(bag?.contents.map(o=>[o.type,o.quantity,o.noCharge,o.unpaid]))===hash(plan.contents));
    check('contained objects have real parent and location',!container||!!bag&&bag.contents.every(o=>o.where===OBJ_CONTAINED&&o.parent===bag.id));
    check('stash uses the actual selected item',plan.kind==='container-stock'?bag?.contents[0]?.id===stock?.id
        :plan.kind==='container-owned'?bag?.contents[0]?.id===appleWish?.inventory.find(o=>o.type==='APPLE')?.id
        :plan.kind==='container-empty'?bag?.contents.length===0:true);
    check('returned stock no longer billed only in contents-only case',before?.keeper?.billCount===plan.billCount
        &&(plan.kind!=='container-stock'||!before.inventory.some(o=>o.id===stock?.id)));
    check('real coin wish and drop preserve gold credit',!plan.phases.goldWish||(goldWish?.gold===100&&goldDrop?.gold===0
        &&goldDrop.keeper?.credit===100&&goldDrop.floor.some(o=>o.type==='GOLD_PIECE'&&o.quantity===100)));
    check('expected credit debit and loan before chat',before?.keeper?.credit===plan.credit
        &&before.keeper.debit===0&&before.keeper.loan===0);
    check('source quote eligibility matches actual floor',before?.eligible===plan.quoteExpected);
    check('survival through ordinary producer',states.length&&states.every(s=>s.hp>0&&s.mortality===0));
    let messages=[],chatLines=[],chatCalls=[],enterCalls=[];
    if(observed) {
        let previousLine;
        observed.screens.forEach((screen,step)=>{
            if(step<31) return;
            const lines=decodeScreen(screen).map(row=>row.map(renderCell).join('').trimEnd());
            if(lines[0]!==previousLine) messages.push({step,text:lines[0]});
            previousLine=lines[0];
            if(step>=plan.phases.chatEnter) chatLines.push(...lines.filter(line=>line.includes('bag')
                ||line.includes('pick-axe')||line.includes('apples,')||line.includes('Fine goods for sale:')
                ||line.includes('Talk to whom?')||line.includes('The contents of ')));
        });
        chatLines=[...new Set(chatLines)];
        chatCalls=observed.slices.slice(plan.phases.chatStart+1).flat();
        enterCalls=observed.slices[plan.phases.chatEnter]||[];
    }
    check('source predicted producer feedback',plan.C.producerPhrases.every(s=>messages.some(m=>m.text.includes(s))));
    check('source predicted chat feedback',plan.C.requiredPhrases.every(s=>chatLines.some(line=>line.includes(s))));
    check('owned zero-cost contents omit contents-only prefix',plan.C.quoteExcludes.every(s=>!chatLines.some(line=>line.includes(s))));
    check('quote or direction branch chosen as predicted',plan.quoteExpected?!chatLines.some(line=>line.includes('Talk to whom?'))
        :chatLines.some(line=>line.includes('Talk to whom?'))&&!chatLines.some(line=>line.includes('Fine goods for sale:')||line.includes(', price ')||line.includes('no charge!')));
    check('source predicted chat turn count',before&&last&&last.turn-before.turn===plan.chatTurnDelta);
    check('interleaved coin skipped in waiting two-item menu',plan.kind!=='interleaved'||(entered?.turn===before?.turn
        &&enterCalls.length===0&&chatLines.some(line=>line.includes('2 apples, no charge'))
        &&chatLines.some(line=>line.includes('a pick-axe, 67 zorkmids'))&&!chatLines.some(line=>/gold pieces,|gold pieces each/.test(line))));
    check('leading coin leaves the single priced owner RNG prefix',plan.kind!=='leading'||/^rn2\(3\)=/.test(chatCalls[0]||''));
    check('coins-only cancellation has no core calls',plan.kind!=='coins-only'||chatCalls.length===0);
    check('quote preserves scoped objects and all billing state',before&&last
        &&hash([before.floor,before.inventory,before.gold,before.keeper?.bill,before.keeper?.billCount,
            before.keeper?.credit,before.keeper?.debit,before.keeper?.loan])
        ===hash([last.floor,last.inventory,last.gold,last.keeper?.bill,last.keeper?.billCount,
            last.keeper?.credit,last.keeper?.debit,last.keeper?.loan]));
    check('all output boundaries present',observed&&['screens','cursors','slices','frames'].every(k=>observed[k].length===part.moves.length+1));
    check('ordered slices equal full core log',observed&&hash(observed.slices.flat())===hash(observed.calls));
    let plain,deferred,plainError,deferredError,plainConsumed;
    try {const r=await runSegment({...part,storage:new InMemoryStorage()});plain=structuredClone(outputs(r));plainConsumed=part.moves.length-r._display.inputQueueLength;}
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
        outputHashes:observed?outputHashes(observed):null,setup,
        stages:Object.fromEntries(Object.entries(plan.phases).filter(([name])=>!name.endsWith('Start')).map(([name,step])=>[name,states.find(s=>s.step===step)||null])),
        beforeChat:before,atChatEnter:entered,final:last,messages,chatLines,
        chatCallCount:chatCalls.length,chatCallPrefix:chatCalls.slice(0,12),enterCallPrefix:enterCalls.slice(0,12),
        statesSHA256:hash(states),stateCount:states.length,neutrality,nativeParityClaimed:false};
    rows.push(row);
    nativeChecks.push(compareNative(native.segments[i],observed));
}

// Historical row metadata remains intact; current native results are separate.
const negatives=rows.filter(row=>row.negative).map(row=>{
    const saved=negative.rows.find(r=>r.name===row.name);
    return {name:row.name,completeRow:hash(row)===saved.completeRowSHA256,
        hashes:Object.keys(saved.outputHashes).filter(key=>row.outputHashes?.[key]===saved.outputHashes[key]).length};
});
const report={pass:rows.every(r=>r.pass)&&negatives.every(r=>r.completeRow&&r.hashes===5)&&nativeChecks.every(r=>r.pass),
    preflight,cases:rows.length,passed:rows.filter(r=>r.pass).length,
    checks:rows.flatMap(r=>r.checks).filter(c=>c.pass).length,
    totalChecks:rows.flatMap(r=>r.checks).length,neutrality:rows.filter(r=>r.neutrality.pass).length,
    negativeHashes:negatives.reduce((n,r)=>n+r.hashes,0),
    completeNegativeRows:negatives.filter(r=>r.completeRow).length,negatives,
    nativePassed:nativeChecks.filter(r=>r.pass).length,nativeChecks,
    parentNative:{cases:6,exact:6,reportSHA256:evidencePins['native-result.json'],
        runtimeSHA256:sourceSeal.runtimeSHA256},runtimeChanges:0,referenceCExecutions:0,
    rows:rows.map(r=>({name:r.name,negative:r.negative,pass:r.pass,checks:r.checks,
        firstUnmet:r.firstUnmet,error:r.error,keys:r.keys,boundaries:r.boundaries,calls:r.calls,frames:r.frames,
        outputHashes:r.outputHashes,completeRowSHA256:hash(r),statesSHA256:r.statesSHA256,
        stateCount:r.stateCount,neutrality:r.neutrality}))};
if(reportFile) writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:report.pass,cases:report.passed,total:report.cases,
    checks:report.checks,totalChecks:report.totalChecks,neutrality:report.neutrality,
    negativeHashes:report.negativeHashes,completeNegativeRows:report.completeNegativeRows,
    nativePassed:report.nativePassed,preflight:6,
    failures:rows.filter(r=>!r.pass).map(r=>({name:r.name,firstUnmet:r.firstUnmet,error:r.error})),
    nativeFailures:nativeChecks.filter(r=>!r.pass),reportFile:reportFile||null}));
if(!report.pass) process.exitCode=1;
