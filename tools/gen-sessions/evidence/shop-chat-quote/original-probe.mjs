// One passive pass per locked input. No runtime patch or native execution.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

assert(process.execArgv.includes('--preserve-symlinks'));
assert(process.execArgv.includes('--preserve-symlinks-main'));
const root = new URL('../', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = value => sha(JSON.stringify(value ?? null));
const read = name => JSON.parse(readFileSync(new URL(name, root)));
const pins = read('pins.json'), lock = read('input-lock.json');
const proposalBytes = readFileSync(new URL('proposals/proposal01.json', root));
assert.equal(sha(proposalBytes), lock.proposalSHA256);
const proposal = JSON.parse(proposalBytes);
assert.equal(proposal.segments.length, 5);
assert.equal(lock.segments.length, 5);
assert.equal(sha(readFileSync(new URL('baseline-runtime.json', root))), pins.runtimeSHA256);
const runtime = read('baseline-runtime.json');
assert.equal(Object.keys(runtime).length, 280);
for (const [path, expected] of Object.entries(runtime))
    assert.equal(sha(readFileSync(new URL('baseline/' + path, root))), expected, path);
for (const [i, part] of proposal.segments.entries()) {
    const fields = lock.fields.map(field => ({field,
        present: Object.hasOwn(part, field), value: part[field]}));
    assert.deepEqual(fields, lock.segments[i].fields);
    assert.equal(hash(fields), lock.segments[i].fieldsSHA256);
    assert.deepEqual([...Buffer.from(part.moves)], lock.segments[i].keys);
    assert.equal(sha(part.moves), lock.segments[i].movesSHA256);
}
assert.equal(existsSync(new URL('reports/probe02.json', root)), false);
writeFileSync(new URL('reports/probe02-start.json', root), JSON.stringify({
    runtimeSHA256: pins.runtimeSHA256, proposalSHA256: lock.proposalSHA256,
    inputLockSHA256: sha(readFileSync(new URL('input-lock.json', root))),
    scriptSHA256: sha(readFileSync(new URL(import.meta.url))), beforeGameImports: true,
    onePassPerSegment: true, nativeExecutions: 0
}, null, 2) + '\n', {flag: 'wx'});

const {runSegment} = await import('../baseline/js/jsmain.js');
const {InMemoryStorage} = await import('../baseline/js/storage.js');
const {ONAMES, OCLASSES} = await import('../baseline/js/objects_data.js');
const {MSOUND} = await import('../baseline/js/monst_data.js');
const {SHOPBASE, ROOMOFFSET} = await import('../baseline/js/const.js');
const {Blind, Deaf, Hallucination, Underwater} = await import('../baseline/js/youprop.js');
const {helpless, is_silent} = await import('../baseline/js/mondata.js');
const {inside_shop} = await import('../baseline/js/shk.js');
const {in_rooms} = await import('../baseline/js/hack.js');
const {inhishop} = await import('../baseline/js/monmove.js');
const {decodeScreen, renderCell} = await import('../baseline/frozen/screen-decode.mjs');
const types = Object.fromEntries(Object.entries(ONAMES).map(([name, value]) => [value, name]));

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
}
const report={classification:'Single passive ordinary probe of a source-predicted missing branch',
    runtimeSHA256:pins.runtimeSHA256,proposalSHA256:lock.proposalSHA256,
    reachAndFixedPredictionPass:rows.filter(r=>r.reachAndFixedPredictionPass).length,total:rows.length,
    CSourceBehaviorPass:rows.filter(r=>r.CSourceBehaviorPass).length,
    workerRuns:1,passesPerSegment:1,nativeExecutions:0,runtimeCandidate:false,rows};
writeFileSync(new URL('reports/probe02.json',root),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({reach:report.reachAndFixedPredictionPass,total:report.total,
    CSourceBehavior:report.CSourceBehaviorPass,rows:rows.map(r=>({name:r.name,
        failures:r.checks.filter(c=>!c.pass).map(c=>c.name),error:r.error}))}));
if(report.reachAndFixedPredictionPass!==report.total) process.exitCode=1;
