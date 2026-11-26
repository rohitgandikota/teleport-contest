// Source-only ordinary shop quote family. All state changes come from keys.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url);
const sha=b=>createHash('sha256').update(b).digest('hex');
const hash=v=>sha(JSON.stringify(v ?? null));
const read=n=>JSON.parse(readFileSync(new URL(n,root)));
const pins=read('pins.json'),proposal=read('proposals/proposal01.json'),lock=read('input-lock.json');
assert(process.execArgv.includes('--preserve-symlinks')&&process.execArgv.includes('--preserve-symlinks-main'));
assert(!existsSync(new URL('reports/probe01.json',root))&&!existsSync(new URL('reports/probe01-progress.ndjson',root)));
for(const [name,h] of Object.entries(pins.files))
    assert.equal(sha(readFileSync(new URL(name,root))),h,name);
const runtime=read('runtime.json');assert.equal(Object.keys(runtime).length,280);
for(const [name,h] of Object.entries(runtime))
    assert.equal(sha(readFileSync(new URL('baseline/'+name,root))),h,name);
for(const [name,h] of Object.entries(pins.priorSeals))
    assert.equal(sha(readFileSync(new URL(name+'/SEAL.json',root))),h,name);
const recipe=read('primary-recipe.json');assert.deepEqual(recipe.segments,proposal.segments);
assert.equal(lock.totalKeys,605);assert.equal(recipe.branchAssertions.length,6);
for(const [i,s] of proposal.segments.entries()) {
    const fields=lock.fields.map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
    assert.deepEqual(fields,lock.segments[i].fields);
    assert.equal(hash(fields),lock.segments[i].fieldsSHA256);
    assert.equal(sha(s.moves),lock.segments[i].movesSHA256);
    assert.deepEqual([...Buffer.from(s.moves)],lock.segments[i].keys);
    assert.deepEqual(recipe.branchAssertions[i].screenIncludes,
        [...proposal.predictions[i].C.producerPhrases,...proposal.predictions[i].C.requiredPhrases]);
}
writeFileSync(new URL('reports/probe01-preflight.json',root),JSON.stringify({
    runtimeSHA256:pins.files['runtime.json'],proposalSHA256:pins.files['proposals/proposal01.json'],
    driverSHA256:pins.files['tools/probe.mjs'],inputLockSHA256:pins.files['input-lock.json'],
    runtimeFiles:280,cases:6,keys:605,fiveFieldsAndPresence:true,allKeys:true,
    priorSealsExact:true,beforeTestedImports:true,referenceCExecutions:0},null,2)+'\n',{flag:'wx'});
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
    appendFileSync(new URL('reports/probe01-progress.ndjson',root),JSON.stringify({name:row.name,pass:row.pass,
        checks:checks.filter(c=>c.pass).length,total:checks.length,firstUnmet:row.firstUnmet,neutrality:neutrality.pass})+'\n');
}
const report={runtimeSHA256:pins.files['runtime.json'],proposalSHA256:pins.files['proposals/proposal01.json'],
    inputLockSHA256:pins.files['input-lock.json'],driverSHA256:pins.files['tools/probe.mjs'],
    pass:rows.every(r=>r.pass),cases:rows.length,passed:rows.filter(r=>r.pass).length,
    checks:rows.flatMap(r=>r.checks).filter(c=>c.pass).length,totalChecks:rows.flatMap(r=>r.checks).length,
    neutrality:rows.filter(r=>r.neutrality.pass).length,runtimeCandidate:false,referenceCExecutions:0,rows};
writeFileSync(new URL('reports/probe01.json',root),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
writeFileSync(new URL('negative-output-lock.json',root),JSON.stringify({
    runtimeSHA256:report.runtimeSHA256,proposalSHA256:report.proposalSHA256,
    reportSHA256:sha(readFileSync(new URL('reports/probe01.json',root))),
    rows:rows.filter(r=>r.negative).map(r=>({name:r.name,completeRowSHA256:hash(r),outputHashes:r.outputHashes,
        reached:r.pass,neutrality:r.neutrality.pass}))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:report.pass,cases:report.passed,total:report.cases,checks:report.checks,
    totalChecks:report.totalChecks,neutrality:report.neutrality,failures:rows.filter(r=>!r.pass)
        .map(r=>({name:r.name,firstUnmet:r.firstUnmet,error:r.error,failed:r.checks.filter(c=>!c.pass).map(c=>c.name)}))}));
if(!report.pass) process.exitCode=1;
