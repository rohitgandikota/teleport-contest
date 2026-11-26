// Shop chat price quotes: C sounds.c:1280 and shk.c:5386-5503.
// Historical85-check diagnostics are retained separately from C acceptance.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = value => sha(JSON.stringify(value ?? null));
assert(process.argv.length <= 3 && !process.argv[2]?.startsWith('--'),
    'usage: shop-chat-quote-input-gate.mjs [new-report.json]');
const reportFile = process.argv[2];
assert(!reportFile || !existsSync(reportFile), 'report must be a new file');
const evidence = new URL('gen-sessions/evidence/shop-chat-quote/', import.meta.url);
const evidencePins = {
    "candidate-ordinary-derivation.json": "539edce6f2fbd4e882fb1845caf712ecbed073e3491d109716949760439c30f8",
    "candidate-review.json": "30732520cb33c5e8e1243a33c3d9dc5b4616bd8926ba8077ca3e71a02b9b249c",
    "candidate-seal.json": "986139c60d246abf6b3d93c0755170a5f8660018d0b75a490ffa8e3238e169c5",
    "currency-order-review.json": "faae82daef0b6629dee00f41d3b5324a8bfc07719a552beba5edcf8aece61b38",
    "diagnostics.json": "752768e885c0a641fb0e6f194308e8f0da6dbb472618d345a21205b00adfe5ec",
    "first-launch-failure.json": "882c8b4540d643691be0b49c474b8b4812e142c276ba085212885a668014fa1d",
    "input-lock.json": "e5c1314920cbcbc4c716bee421d054a6ebfce3a2a91f9ce68406b02cccc5c223",
    "loader-fix.json": "49587ee8f3438dc596e12e4354502fa15d9705f225b071b0232a5090159d4c5f",
    "negative-output-lock.json": "787a7d72b308a2045c5ae9b99ba3400360cec9e0e3a96611b3a837621c9ada91",
    "original-probe.mjs": "25e463604cd11b4f4405a1a7d5acba667a8b224582ed67ddab5ab0aa5eaf6434",
    "parent-input-lock.json": "e9083284425e2d2cac36cd0728b594d7dbd49e1ae09782240ff91388530d6c89",
    "proposal-original.json": "d6ec42ace056443d1821b90707f1dd8d1d75851c76d1f42ab37775a41cd6829a",
    "recording-receipt.json": "ec5b13dba1f02391026ff37495fce5b8d74780ba4cb6205cfb083249bc0f8449",
    "source-seal.json": "1265f944e536a71056de53f14e0f70c52267b8eab52f33f6c11a22e75171de75"
};
for (const [name, expected] of Object.entries(evidencePins))
    assert.equal(sha(readFileSync(new URL(name, evidence))), expected, name);
const read = name => JSON.parse(readFileSync(new URL(name, evidence)));
const proposal = read('proposal-original.json');
const lock = read('input-lock.json');
const parentLock = read('parent-input-lock.json');
const negative = read('negative-output-lock.json');
const history = read('diagnostics.json');
const receipt = read('recording-receipt.json');
const recipeBytes = readFileSync(new URL('gen-sessions/recipes/shop-chat-quote.json', import.meta.url));
assert.equal(sha(recipeBytes), '2c3dc7b3271204601f0dbb9caee2e43ba9f9b862bc4949df81c1c83b42e1f512');
const recipe = JSON.parse(recipeBytes);
assert.equal(parentLock.primaryRecipeSHA256, sha(recipeBytes));
assert.equal(parentLock.originalRecipeSHA256, evidencePins['proposal-original.json']);
assert.equal(lock.proposalSHA256, parentLock.originalRecipeSHA256);
assert.equal(parentLock.sourceInputLockSHA256, evidencePins['input-lock.json']);
assert.equal(parentLock.negativeHashesSHA256, evidencePins['negative-output-lock.json']);
assert.equal(parentLock.sourceSealSHA256, evidencePins['source-seal.json']);
assert.equal(negative.proposalSHA256, lock.proposalSHA256);
assert.equal(negative.reportSHA256, history.sourceDiagnosticSHA256);
assert.equal(lock.lockedBeforeProbe, true);
assert.equal(parentLock.beforeCAndCandidate, true);
assert.equal(receipt.exit, 0);
assert.equal(receipt.primaryRecipeSHA256, sha(recipeBytes));
assert.equal(receipt.inputSHA256, parentLock.minimalInputSHA256);
const raw = readFileSync(new URL('gen-sessions/generated/shop-chat-quote.session.json', import.meta.url));
assert.equal(sha(raw), 'bd1772e4400523a302e55c764045dd54e85464b451c74323a257c2529645dfd1');
assert.equal(raw.length, 1983407);
assert.equal(receipt.rawSha256, sha(raw));
const native = JSON.parse(raw);
assert.equal(native.source, 'c');
assert.equal(native.version, 5);
assert.equal(native.name, recipe.name);
assert.deepEqual(native.coverage, recipe.coverage);
assert.deepEqual(native.branches, recipe.branches);
assert.equal(recipe.segments.length, 5);
assert.equal(proposal.segments.length, 5);
assert.equal(lock.segments.length, 5);
assert.equal(native.segments.length, 5);
assert.equal(recipe.branchAssertions.length, 5);
assert.equal(recipe.branches.length, 5);
assert.deepEqual(lock.fields, ['name','seed','datetime','nethackrc','moves']);
let keys = 0, boundaries = 0;
for (const [i, part] of proposal.segments.entries()) {
    const fields = lock.fields.map(field => ({field, present:Object.hasOwn(part,field), value:part[field]}));
    assert.deepEqual(fields, lock.segments[i].fields);
    assert.equal(hash(fields), lock.segments[i].fieldsSHA256);
    assert.deepEqual([...Buffer.from(part.moves)], lock.segments[i].keys);
    assert.equal(sha(part.moves), lock.segments[i].movesSHA256);
    assert.equal(part.moves.length, lock.segments[i].keyCount);
    for (const field of lock.fields) {
        for (const actual of [recipe.segments[i], native.segments[i]]) {
            assert.equal(Object.hasOwn(actual,field), Object.hasOwn(part,field));
            assert.deepEqual(actual[field], part[field]);
        }
    }
    assert.deepEqual(native.segments[i].steps.map(s=>s.key), [null,...part.moves]);
    assert.equal(recipe.branchAssertions[i].branch, recipe.branches[i]);
    assert.equal(recipe.branchAssertions[i].segment, i);
    assert.deepEqual(recipe.branchAssertions[i].screenIncludes, proposal.predictions[i].C.requiredPhrases);
    keys += part.moves.length;
    boundaries += native.segments[i].steps.length;
}
assert.equal(keys, 326);
assert.equal(boundaries, 331);
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(recipe, native), []);
assert.equal(negative.rows.length, 2);
assert.equal(negative.rows.reduce((n,r)=>n+Object.keys(r.outputHashes).length,0), 10);
assert.deepEqual(negative.rows.map(r=>r.name), proposal.segments.filter((_s,i)=>proposal.predictions[i].negative).map(s=>s.name));
const original = readFileSync(new URL('original-probe.mjs', evidence), 'utf8');
const current = readFileSync(new URL(import.meta.url), 'utf8');
for (const [start, end, expected] of [
    ['    const checks = [], cChecks = [];', '    rows.push(', history.originalDiagnosticBodySHA256],
    ['        globalThis.__step_snapshot', '    const before = states.find', history.originalObserverBodySHA256]
]) {
    const body = script => {
        const begin = script.indexOf('\n'+start)+1;
        const finish = script.indexOf('\n'+end,begin)+1;
        assert(begin > 0 && finish > begin);
        return script.slice(begin,finish);
    };
    assert.equal(sha(body(original)), expected);
    assert.equal(body(current), body(original));
}
const preflight = {nativeSHA256:sha(raw), primaryRecipeSHA256:sha(recipeBytes),
    source:'c',version:5,segments:5,keys,boundaries,primaryBranches:5,
    fiveFieldsAndPresence:true,allBoundaryKeys:true,integrityErrors:0,beforeGameImports:true};

// Tested game imports occur only after the complete data preflight above.
const root = new URL('../', import.meta.url);
const importGame = name => import(new URL('js/'+name,root));
const {runSegment,NethackGame}=await importGame('jsmain.js');
const {InMemoryStorage}=await importGame('storage.js');
const {ONAMES,OCLASSES}=await importGame('objects_data.js');
const {MSOUND}=await importGame('monst_data.js');
const {SHOPBASE,ROOMOFFSET}=await importGame('const.js');
const {Blind,Deaf,Hallucination,Underwater}=await importGame('youprop.js');
const {helpless,is_silent}=await importGame('mondata.js');
const {inside_shop}=await importGame('shk.js');
const {in_rooms}=await importGame('hack.js');
const {inhishop}=await importGame('monmove.js');
const {game}=await importGame('gstate.js');
const {GameDisplay}=await importGame('game_display.js');
const {moveloop_core}=await importGame('allmain.js');
const {decodeScreen,renderCell}=await import(new URL('frozen/screen-decode.mjs',root));
const types=Object.fromEntries(Object.entries(ONAMES).map(([name,value])=>[value,name]));
const baselineBehaviorNames=['fixed JS asks for direction','fixed JS produces no quote',
    'fixed JS spends zero turns','fixed JS post-chat RNG is empty'];
const acceptanceRows=[],neutralityRows=[];
assert.equal(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),undefined);
function outputs(run) {
    return {screens:run.getScreens(),cursors:run.getCursors(),calls:run.getRngLog(),
        slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()};
}
const outputHashes=out=>Object.fromEntries(Object.entries(out).map(([k,v])=>[k,hash(v)]));

// tools/deferred-input-gate.mjs public interactive API, also retaining slices
// and checking that the final pending read does not change outputs.
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
const rows = [];
for (const [i, part] of proposal.segments.entries()) {
    const plan = proposal.predictions[i], states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run, error;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            if (!g.u || !g.level || g.u.uz.dnum !== 0 || g.u.uz.dlevel !== 2) return;
            const x = g.u.ux, y = g.u.uy;
            const roomNumber = in_rooms(x, y, SHOPBASE).charCodeAt(0);
            // Read the resident directly: shop_keeper may rile an angry keeper.
            const resident = g.level.rooms[roomNumber - ROOMOFFSET]?.resident;
            const e = resident?.eshk;
            const shop = inside_shop(x, y);
            const inShop = !!(resident && e && inhishop(resident));
            const costly = !!(g.level.flags.has_shop && shop && inShop
                && !(x === e.shk.x && y === e.shk.y));
            const object = o => ({id:o.o_id, type:types[o.otyp], otyp:o.otyp,
                quantity:o.quan, class:o.oclass, noCharge:!!o.no_charge,
                unpaid:!!o.unpaid, letter:o.invlet, known:!!o.known,
                dknown:!!o.dknown, bknown:!!o.bknown, blessed:!!o.blessed,
                cursed:!!o.cursed, contents:o.cobj?.length || 0,
                artifact:o.oartifact || 0, weight:o.owt, globby:!!o.globby,
                baseCost:g.objects[o.otyp].oc_cost,
                typeKnown:!!g.objects[o.otyp].oc_name_known});
            const floor = g.level.objectsAt(x, y).map(object);
            const keeper = resident && e ? {id:resident.m_id, xy:[resident.mx,resident.my],
                inShop, peaceful:!!resident.mpeaceful, helpless:helpless(resident),
                sound:resident.data.msound, mute:helpless(resident)
                    || resident.data.msound <= MSOUND.MS_ANIMAL,
                home:[e.shk.x,e.shk.y], billCount:e.billct, robbed:e.robbed || 0} : null;
            const blind = !!Blind(), deaf = !!Deaf();
            const silent = !!is_silent(g.youmonst.data);
            const strangled = !!g.u.intrinsic?.HStrangled;
            const swallowed = !!g.u.uswallow, underwater = !!Underwater();
            const eligible = !blind && !deaf && !silent && !strangled && !swallowed
                && !underwater && costly && keeper?.peaceful && !keeper.mute
                && floor.some(o => o.class !== OCLASSES.COIN_CLASS);
            states.push({step,turn:g.moves,hero:[x,y],hp:g.u.uhp,
                mortality:g.u.umortality || 0,blind,deaf,hallucinating:!!Hallucination(),
                silent,strangled,swallowed,underwater,shop,costly,keeper,floor,
                eligible:!!eligible,wearingBlindfold:g.u.ublindf?.otyp === ONAMES.BLINDFOLD,
                inventory:(g.invent || []).filter(o => [ONAMES.PICK_AXE,ONAMES.APPLE,
                    ONAMES.BLINDFOLD].includes(o.otyp)).map(object)});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } catch (e) { error = String(e.stack || e).split('\n').slice(0,5).join('\n'); }
    finally {
        if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    const before = states.find(s=>s.step===plan.phases.chatStart), last = states.at(-1);
    const checks = [], cChecks = [];
    const check = (name, condition) => checks.push({name,pass:!!condition});
    const cCheck = (name, condition) => cChecks.push({name,pass:!!condition});
    check('one complete pass and every key consumed',run && !error && last?.step===part.moves.length);
    check('maintained shop position',hash(before?.hero)===hash(plan.beforeChat.hero));
    check('peaceful able resident in costly shop square',before?.costly && before.keeper?.inShop
        && before.keeper.peaceful && !before.keeper.mute && before.keeper.robbed===0);
    check('exact floor chain and ownership',hash(before?.floor.map(o=>[o.type,o.quantity,o.noCharge]))
        ===hash(plan.beforeChat.floorChain));
    check('real unpaid pickup when required',!!before?.inventory.some(o=>o.type==='PICK_AXE'&&o.unpaid)
        ===plan.beforeChat.carriedUnpaidPickaxe);
    check('actual sight and other speech predicates',before && before.blind===plan.beforeChat.blind
        && !before.deaf && !before.hallucinating && !before.silent && !before.strangled
        && !before.swallowed && !before.underwater);
    check('blindness produced by worn blindfold when selected',plan.kind!=='blind' || before?.wearingBlindfold);
    check('C quote eligibility reached',before?.eligible===plan.C.quote);
    check('survived without mortality',states.length && states.every(s=>s.hp>0&&s.mortality===0));
    let output, messages=[], relevantLines=[], chatCalls=[], directionPrompt=false, quote=false;
    if (run) {
        output={screens:run.getScreens(),cursors:run.getCursors(),calls:run.getRngLog(),
            slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()};
        check('every output boundary present',['screens','cursors','slices','frames']
            .every(k=>output[k].length===part.moves.length+1));
        check('ordered RNG slices equal full log',hash(output.slices.flat())===hash(output.calls));
        let prior;
        output.screens.forEach((screen,step)=>{
            if(step<31) return;
            const lines=decodeScreen(screen).map(row=>row.map(renderCell).join('').trimEnd());
            if(lines[0]!==prior) messages.push({step,text:lines[0]});
            prior=lines[0];
            if(step>=plan.phases.chatEnter) {
                directionPrompt ||= lines[0].includes('Talk to whom? (in what direction)');
                quote ||= lines.some(line=>/Fine goods for sale:|, price 67 zorkmids|An apple, no charge!/.test(line));
                relevantLines.push(...lines.filter(line=>/Fine goods for sale:|pick-axe,|apple,|Talk to whom/.test(line)));
            }
        });
        relevantLines=[...new Set(relevantLines)];
        chatCalls=output.slices.slice(plan.phases.chatStart+1).flat();
        check('declined-sale prompt produced when required',!plan.beforeChat.declinedSale
            || messages.some(m=>/Sell it\?/.test(m.text)));
        check('fixed JS asks for direction',directionPrompt===plan.fixedJS.directionPrompt);
        check('fixed JS produces no quote',quote===plan.fixedJS.quote);
        check('fixed JS spends zero turns',last?.turn-before?.turn===plan.fixedJS.turns);
        check('fixed JS post-chat RNG is empty',chatCalls.length===plan.fixedJS.postChatCalls);
        cCheck('source-predicted phrases',plan.C.requiredPhrases.every(s=>relevantLines.some(line=>line.includes(s))));
        cCheck('source-predicted direction behavior',directionPrompt===plan.C.directionPrompt);
        cCheck('source-predicted turn cost',last?.turn-before?.turn===plan.C.turns);
        cCheck('source-predicted owner RNG',plan.kind==='single'
            ? chatCalls.some(c=>/^rn2\(3\)=/.test(c)) : chatCalls.length===0);
    }
    check('chat cancellation preserves scoped object state',before && last
        && hash([before.floor,before.inventory])===hash([last.floor,last.inventory]));
    rows.push({name:part.name,negative:plan.negative,reachAndFixedPredictionPass:checks.every(c=>c.pass),
        checks,CSourceBehaviorPass:cChecks.every(c=>c.pass),CSourceBehaviorChecks:cChecks,error,
        keys:part.moves.length,boundaries:output?.screens.length,calls:output?.calls.length,
        frames:output?.frames.flat().length,outputHashes:output
            ? Object.fromEntries(Object.entries(output).map(([k,v])=>[k,hash(v)])) : null,
        beforeChat:before,final:last,turnDelta:last?.turn-before?.turn,chatCalls,
        messages,relevantLines,stateCount:states.length,statesSHA256:hash(states),observerRestored:true,
        observerNeutralityMeasured:false,deferredEqualityMeasured:false,nativeParityClaimed:false});
    const row = rows.at(-1);
    const preservedContract = checks.filter(c => !baselineBehaviorNames.includes(c.name));
    const acceptance = [];
    const accept = (name, condition) => acceptance.push({name, pass:!!condition});
    accept('all original setup, ownership, survival and output contracts', preservedContract.every(c=>c.pass));
    accept('C primary phrases from the original pre-run prediction',
        plan.C.requiredPhrases.every(s=>relevantLines.some(line=>line.includes(s))));
    accept('C ordered direction exclusion', directionPrompt === plan.C.directionPrompt);
    accept('C command turn cost', last?.turn-before?.turn === plan.C.turns);
    accept('multiple-goods menu suspends before spending its turn', plan.kind !== 'multiple'
        || states.find(s=>s.step===plan.phases.chatEnter)?.turn===before?.turn);
    accept('priced single invokes embellishment before ordinary turn RNG', plan.kind !== 'single'
        || (/^rn2\(3\)=/.test(chatCalls[0])
            && (!/^rn2\(3\)=0$/.test(chatCalls[0]) || /^rn2\(5\)=/.test(chatCalls[1]))));
    accept('complete negative ordinary row unchanged', !plan.negative
        || hash(row)===history.negativeRows.find(r=>r.name===part.name).rowSHA256);
    accept('all ten original negative output hashes unchanged', !plan.negative
        || hash(row.outputHashes)===hash(negative.rows.find(r=>r.name===part.name).outputHashes));
    const observed = structuredClone(output);
    const plainRun = await runSegment({...part,storage:new InMemoryStorage()});
    const plain = structuredClone(outputs(plainRun));
    const deferred = await deferredSegment(part);
    const neutral = {name:part.name, observedEqualsPlain:hash(observed)===hash(plain),
        plainEqualsDeferred:hash(plain)===hash(deferred.output),
        eofStable:deferred.eofStable, consumed:deferred.consumed,
        expectedConsumed:part.moves.length-plainRun._display.inputQueueLength,
        hashes:{observed:outputHashes(observed),plain:outputHashes(plain),
            deferred:outputHashes(deferred.output)}};
    neutral.pass = neutral.observedEqualsPlain && neutral.plainEqualsDeferred
        && neutral.eofStable && neutral.consumed===neutral.expectedConsumed
        && neutral.consumed===part.moves.length;
    acceptanceRows.push({name:part.name, pass:acceptance.every(c=>c.pass), checks:acceptance});
    neutralityRows.push(neutral);
}
const shared = rows.flatMap(r=>r.checks.filter(c=>!baselineBehaviorNames.includes(c.name)));
const negativeRows = rows.filter(r=>r.negative);
const negativeHashes = negativeRows.reduce((n,r)=>n+Object.entries(r.outputHashes || {})
    .filter(([k,v])=>negative.rows.find(p=>p.name===r.name).outputHashes[k]===v).length,0);
const report = {preflight,
    acceptance:{cases:acceptanceRows.filter(r=>r.pass).length,total:5,
        sharedChecks:shared.filter(c=>c.pass).length,sharedTotal:65,negativeHashes,negativeTotal:10},
    originalDiagnostic:{pass:rows.reduce((n,r)=>n+r.checks.filter(c=>c.pass).length,0),total:85,
        historicalBaseline:85,historicalCandidate:73,acceptanceOracle:false},
    neutrality:{pass:neutralityRows.filter(r=>r.pass).length,total:5,channels:5},
    rows:rows.map((r,i)=>({name:r.name,negative:r.negative,error:r.error || null,
        keys:r.keys,boundaries:r.boundaries,calls:r.calls,frames:r.frames,turnDelta:r.turnDelta,
        outputHashes:r.outputHashes,
        originalDiagnosticVector:r.checks.map(c=>c.pass),
        originalDiagnosticFailures:r.checks.filter(c=>!c.pass).map(c=>c.name),
        auxiliaryDiagnosticVector:r.CSourceBehaviorChecks.map(c=>c.pass),
        sharedPass:r.checks.filter(c=>!baselineBehaviorNames.includes(c.name)&&c.pass).length,
        CAcceptance:acceptanceRows[i],
        neutrality:{...neutralityRows[i],hashes:undefined}})),
    nativeReplayPerformed:false,nativeCExecutions:0};
report.pass = report.acceptance.cases===5 && report.acceptance.sharedChecks===65
    && shared.length===65 && negativeHashes===10 && report.neutrality.pass===5;
if (reportFile) writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));
if (!report.pass) process.exitCode=1;
