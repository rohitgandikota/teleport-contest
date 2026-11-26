// One source-only ordinary family. State changes come only from locked keys.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, appendFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';

const root = new URL('../', import.meta.url);
const sha = b => createHash('sha256').update(b).digest('hex');
const hash = v => sha(JSON.stringify(v ?? null));
const read = name => JSON.parse(readFileSync(new URL(name, root)));
const pins = read('pins.json'), proposal = read('proposals/proposal01.json');
const lock = read('input-lock.json'), recipe = read('primary-recipe.json');
assert(process.execArgv.includes('--preserve-symlinks')
    && process.execArgv.includes('--preserve-symlinks-main'));
for (const name of ['probe01.json', 'probe01-preflight.json', 'probe01-progress.ndjson'])
    assert(!existsSync(new URL('reports/' + name, root)), 'one batch only');
for (const [name, expected] of Object.entries(pins.files))
    assert.equal(sha(readFileSync(new URL(name, root))), expected, name);
for (const [name, expected] of Object.entries(pins.priorSeals))
    assert.equal(sha(readFileSync(new URL(name, root))), expected, name);
const runtime = read('runtime.json');
assert.equal(Object.keys(runtime).length, 280);
for (const [name, expected] of Object.entries(runtime))
    assert.equal(sha(readFileSync(new URL('baseline/' + name, root))), expected, name);
for (const range of read('source-ranges.json')) {
    const bytes = readFileSync(new URL(range.file, root));
    assert.equal(sha(bytes), range.fileSHA256, range.file);
    assert.equal(sha(bytes.toString().split('\n').slice(range.start - 1, range.end).join('\n')),
        range.rangeSHA256, range.owner);
}
assert.deepEqual(recipe.segments, proposal.segments);
assert.equal(lock.totalKeys, 786);
assert.equal(recipe.branchAssertions.length, 8);
for (const [i, part] of proposal.segments.entries()) {
    const fields = lock.fields.map(field => ({field, present: Object.hasOwn(part, field), value: part[field]}));
    assert.deepEqual(fields, lock.segments[i].fields);
    assert.equal(hash(fields), lock.segments[i].fieldsSHA256);
    assert.equal(sha(part.moves), lock.segments[i].movesSHA256);
    assert.deepEqual([...Buffer.from(part.moves)], lock.segments[i].keys);
    assert.deepEqual(recipe.branchAssertions[i].screenIncludes, proposal.predictions[i].C.requiredPhrases);
    assert.deepEqual(recipe.branchAssertions[i].screenExcludes, proposal.predictions[i].C.excludedPhrases);
}
writeFileSync(new URL('reports/probe01-preflight.json', root), JSON.stringify({
    runtimeSHA256: pins.files['runtime.json'], proposalSHA256: pins.files['proposals/proposal01.json'],
    recipeSHA256: pins.files['primary-recipe.json'], inputLockSHA256: pins.files['input-lock.json'],
    driverSHA256: pins.files['tools/probe.mjs'], cases: 8, keys: 786, boundaries: 794,
    runtimeFiles: 280, fiveFieldsAndPresence: true, allKeys: true, sourcesExact: true,
    priorSealsExact: true, beforeTestedImports: true, referenceCExecutions: 0,
}, null, 2) + '\n', {flag: 'wx'});

const {runSegment, NethackGame} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {ONAMES} = await import('../js/objects_data.js');
const {PMNAMES} = await import('../js/monst_data.js');
const {Upolyd, W_ARMG, ROOM, FIRE_TRAP, FROMFORM, TIMEOUT} = await import('../js/const.js');
const {Blind, Fumbling, Fire_resistance, Underwater, Levitation, Flying,
    Unchanging, Stunned, Confusion, Hallucination, Regeneration, Sleepy} = await import('../js/youprop.js');
const {can_reach_floor} = await import('../js/pickup.js');
const gstate = await import('../js/gstate.js'); // Preserve the exported live binding across games.
const {GameDisplay} = await import('../js/game_display.js');
const {moveloop_core} = await import('../js/allmain.js');
const {getRngLog} = await import('../js/rng.js');
const {decodeScreen, renderCell} = await import('../frozen/screen-decode.mjs');
const typeNames = Object.fromEntries(Object.entries(ONAMES).map(([name, value]) => [value, name]));
const outputs = run => ({screens: run.getScreens(), cursors: run.getCursors(), calls: run.getRngLog(),
    slices: run.getRngSlices(), frames: run.getAnimationFramesByStep()});
const outputHashes = out => Object.fromEntries(Object.entries(out).map(([key, value]) => [key, hash(value)]));
const errorText = e => String(e.stack || e).split('\n').slice(0, 7).join('\n');

async function deferredSegment(part) {
    const display = new GameDisplay(null);
    const run = new NethackGame({...part, storage: new InMemoryStorage()});
    run._pendingDisplay = display;
    const keys = Array.from(part.moves, ch => ch.charCodeAt(0));
    let consumed = 0, stop, atEnd;
    const exhausted = new Promise(resolve => { atEnd = resolve; });
    const end = new Error('deferred input complete');
    display.onEmptyQueue = async () => {
        await setImmediate();
        if (consumed < keys.length) return keys[consumed++];
        return new Promise((_resolve, reject) => { stop = () => reject(end); atEnd('input'); });
    };
    const operation = (async () => {
        try { await run.start(); while (!gstate.game.program_state?.gameover) await moveloop_core(); }
        catch (error) { if (error !== end) throw error; }
    })();
    try {
        const ended = await Promise.race([exhausted, operation.then(() => 'exit')]);
        assert.equal(ended, 'input', 'Reach a real final pending input read');
        const output = structuredClone(outputs(run));
        await setImmediate(); await setImmediate();
        return {output, consumed, eofStable: hash(output) === hash(outputs(run))};
    } finally { if (stop) stop(); await operation; }
}

assert.equal(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), undefined);
const rows = [];
for (const [index, part] of proposal.segments.entries()) {
    const plan = proposal.predictions[index], states = [];
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run, error, observed;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            if (!g.u || !g.level) return;
            const u = g.u, data = g.youmonst.data, x = u.ux, y = u.uy;
            const item = o => o ? {id: o.o_id, type: typeNames[o.otyp], letter: o.invlet,
                quantity: o.quan, where: o.where, worn: o.owornmask || 0,
                cursed: !!o.cursed, blessed: !!o.blessed, known: !!o.known,
                artifact: o.oartifact || 0, erosion: o.oeroded || 0,
                material: g.objects[o.otyp].oc_material} : null;
            const trap = g.level.traps.find(t => t.tx === x && t.ty === y);
            states.push({step, turn: g.moves, hero: [x, y], level: {...u.uz}, terrain: g.level.at(x, y).typ,
                humanHP: u.uhp, humanMax: u.uhpmax, monsterHP: u.mh, monsterMax: u.mhmax,
                species: data.pmnames[2], speciesIndex: u.umonnum, humanIndex: u.umonster,
                speciesLevel: data.mlevel, monsterSpeed: data.mmove, formTimeout: u.mtimedone,
                polymorphed: Upolyd(u), mortality: u.umortality || 0, gameover: !!g.program_state?.gameover,
                fumbling: !!Fumbling(), fumblingIntrinsic: u.intrinsic?.HFumbling || 0,
                fumblingExtrinsic: u.uprops?.FUMBLING || 0, fireResistant: !!Fire_resistance(),
                fireIntrinsic: u.intrinsic?.HFire_resistance || 0, fireExtrinsic: u.uprops?.FIRE_RES || 0,
                blind: !!Blind(), underwater: !!Underwater(), levitating: !!Levitation(), flying: !!Flying(),
                unchanging: !!Unchanging(), confused: !!Confusion(), stunned: !!Stunned(),
                hallucinating: !!Hallucination(), slimed: !!u.intrinsic?.HSlimed,
                regenerating: !!Regeneration(), sleepingRegen: !!(Sleepy() && u.usleep),
                trapped: u.utrap || 0, swallowed: !!u.uswallow, stuck: !!u.ustuck, mounted: !!u.usteed,
                canReachFloor: !!can_reach_floor(false), multi: g.multi,
                gloves: item(u.uarmg), inventory: g.invent.map(item), floor: g.level.objectsAt(x, y).map(item),
                trap: trap ? {type: trap.ttyp, seen: !!trap.tseen, position: [trap.tx, trap.ty]} : null,
                coreCalls: getRngLog().length});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
        observed = structuredClone(outputs(run));
    } catch (e) { error = errorText(e); }
    finally {
        if (descriptor) Object.defineProperty(globalThis, '__step_snapshot', descriptor);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), descriptor);
    const at = name => states.find(s => s.step === plan.phases[name]);
    const floor = at('floor'), poly = at('polymorphed'), wish = at('gloveWish');
    const worn = at('worn'), before = at('beforeAction'), last = at('final');
    const reach = [], contracts = [];
    const check = (name, condition) => reach.push({name, pass: !!condition});
    const source = (name, condition) => contracts.push({name, pass: !!condition});
    const actionCalls = observed?.slices.slice(plan.phases.beforeAction + 1).flat() || [];
    const wearCalls = observed?.slices.slice(plan.phases.wearStart + 1, plan.phases.worn + 1).flat() || [];
    const first = /^d\(2,4\)=(\d+)$/.exec(actionCalls[0] || '');
    const alternate = before && plan.materialDivisor ? Math.trunc(before.monsterMax / plan.materialDivisor) : 0;
    const damage = first ? Math.max(Number(first[1]), alternate) : null;
    const bound = before && damage !== null ? Math.min(before.monsterMax, damage + 1) : null;
    const second = /^rn2\((\d+)\)=(\d+)$/.exec(actionCalls[1] || '');
    const prefix = !!first && !!second && Number(second[1]) === (plan.fireResistant ? 2 : bound);
    let messages = [], text = '';
    if (observed) {
        let previous;
        observed.screens.forEach((screen, step) => {
            const line = decodeScreen(screen)[0].map(renderCell).join('').trimEnd();
            text += line + '\n';
            if (line !== previous && !/^#|^What do you|^Become what/.test(line)) messages.push({step, text: line});
            previous = line;
        });
    }
    check('all keys consumed without runtime error', run && !error && last && states.at(-1).step === part.moves.length
        && run._display.inputQueueLength === 0);
    check('one ordinary west step reaches clear room floor', floor && hash(floor.hero) === hash([57, 7])
        && floor.terrain === ROOM && !floor.floor.length && !floor.trap && !floor.polymorphed);
    check('controlled exact species produced with healthy monster pool', poly?.polymorphed && poly.species === plan.species
        && poly.speciesIndex === PMNAMES['PM_' + plan.species.toUpperCase().replaceAll(' ', '_')]
        && poly.monsterHP === poly.monsterMax && poly.speciesLevel === plan.speciesLevel && poly.formTimeout > 0);
    check('source HP producer reached', poly && (plan.golemHP === null
        ? poly.monsterMax > 16 && poly.monsterMax <= 120 : poly.monsterMax === plan.golemHP));
    check('only real wished uncursed gloves occupy slot a', wish?.inventory.length === 1
        && wish.inventory[0].type === 'GAUNTLETS_OF_FUMBLING' && wish.inventory[0].letter === 'a'
        && wish.inventory[0].quantity === 1 && !wish.inventory[0].cursed && !wish.inventory[0].blessed
        && !wish.inventory[0].artifact && !wish.inventory[0].worn && wish.inventory[0].material === 7);
    check('real wear retains identity and W_ARMG property', worn?.gloves && worn.gloves.id === wish?.inventory[0]?.id
        && worn.gloves.worn === W_ARMG && worn.fumblingExtrinsic === W_ARMG && worn.gloves.known);
    check('Gloves_on timed producer ran before action', worn?.fumbling && (worn.fumblingIntrinsic & TIMEOUT) > 0
        && wearCalls.some(call => /^rnd\(20\)=/.test(call)) && worn.multi === 0);
    check('polymorph human HP pool unchanged through setup', before && floor
        && before.humanHP === floor.humanHP && before.humanMax === floor.humanMax
        && before.humanHP === before.humanMax);
    check('fire resistance comes only from iron form', before && before.fireResistant === plan.fireResistant
        && !before.fireExtrinsic && !!(before.fireIntrinsic & FROMFORM) === plan.fireResistant);
    check('sitting eligibility and excluded branch prerequisites', before?.canReachFloor && before.polymorphed
        && before.species === plan.species && !before.trapped && !before.swallowed && !before.stuck
        && !before.mounted && !before.underwater && !before.levitating && !before.flying && !before.blind
        && !before.unchanging && !before.confused && !before.stunned && !before.hallucinating && !before.slimed);
    check('ordinary fire trap exists unseen before action', before?.trap?.type === FIRE_TRAP && !before.trap.seen
        && hash(before.trap.position) === hash(before.hero) && before.fumbling);
    check('empty ground and glove-only inventory throughout setup', before && poly
        && [floor, poly, wish, worn, before].every(s => s && s.terrain === ROOM && !s.floor.length)
        && before.inventory.length === 1 && before.gloves?.id === wish?.inventory[0]?.id);
    check('healthy monster pool remains above its species level before action', before
        && before.monsterHP === before.monsterMax && before.monsterMax === poly?.monsterMax
        && before.monsterMax > plan.speciesLevel);
    check('source-predicted ordinary producer feedback', text.includes('You turn into a ' + plan.species + '!')
        && text.includes('A fire trap.') && !text.includes('Creation of a fire trap failed.'));
    check('chosen trigger or look branch reached', plan.trigger
        ? text.includes('You sit down.') && text.includes('A tower of flame erupts from the floor!')
            && last?.trap?.seen && !!first && !text.includes('You escape a fire trap.')
        : text.includes('You see no objects here.') && !text.includes('tower of flame') && actionCalls.length === 0);
    check('no regeneration boundary obscures damage observation', before && last && !before.regenerating
        && !before.sleepingRegen && Math.floor(before.turn / 20) === Math.floor(last.turn / 20));
    check('ordinary producer and action survive', states.length && states.every(s => s.humanHP > 0
        && s.mortality === 0 && !s.gameover));
    check('all five output streams are complete', observed && ['screens', 'cursors', 'slices', 'frames']
        .every(key => observed[key].length === part.moves.length + 1)
        && hash(observed.slices.flat()) === hash(observed.calls));

    source('C primary visible predicates', plan.C.requiredPhrases.every(s => text.includes(s))
        && plan.C.excludedPhrases.every(s => !text.includes(s)));
    source('C leaves human HP maximum unchanged', before && last && before.humanMax === last.humanMax);
    source('C leaves healthy human HP unchanged', before && last && before.humanHP === last.humanHP);
    source('C damage RNG prefix with no second d(2,4)', plan.trigger
        ? prefix && actionCalls.filter(c => /^d\(2,4\)=/.test(c)).length === 1 : actionCalls.length === 0);
    let expected = null;
    if (before && prefix) {
        const shrink = plan.fireResistant ? 0 : Number(second[2]);
        const loss = plan.fireResistant ? Number(second[2]) : damage;
        const max = before.monsterMax - shrink;
        const hp = Math.min(before.monsterHP, max) - loss;
        expected = {shrink, damage: loss, monsterMax: hp > 0 ? max : 0,
            monsterHP: hp > 0 ? hp : 0, polymorphed: hp > 0};
    }
    source('C material shrink clamp and loss or unchanged look state', plan.trigger
        ? expected && last && last.monsterMax === expected.monsterMax && last.monsterHP === expected.monsterHP
            && last.polymorphed === expected.polymorphed
        : before && last && hash([before.monsterHP, before.monsterMax, before.speciesIndex, before.formTimeout,
            before.turn, before.gloves, before.trap]) === hash([last.monsterHP, last.monsterMax, last.speciesIndex,
            last.formTimeout, last.turn, last.gloves, last.trap]));
    source('C paper trigger always rehumanizes; controls preserve selected form', plan.name === 'paper-trigger'
        ? last && !last.polymorphed && last.monsterHP === 0 && last.monsterMax === 0
        : plan.name === 'straw-trigger' ? expected && last?.polymorphed === expected.polymorphed
        : last?.polymorphed && last.species === plan.species);
    source('C action time contract', before && last && (plan.trigger ? last.turn > before.turn : last.turn === before.turn));

    let plain, deferred, plainError, deferredError, plainConsumed;
    try {
        const result = await runSegment({...part, storage: new InMemoryStorage()});
        plain = structuredClone(outputs(result)); plainConsumed = part.moves.length - result._display.inputQueueLength;
    } catch (e) { plainError = errorText(e); }
    try { deferred = await deferredSegment(part); } catch (e) { deferredError = errorText(e); }
    const neutrality = {observedEqualsPlain: !!observed && !!plain && hash(observed) === hash(plain),
        plainEqualsDeferred: !!plain && !!deferred && hash(plain) === hash(deferred.output),
        eofStable: !!deferred?.eofStable, plainConsumed, deferredConsumed: deferred?.consumed,
        expectedConsumed: part.moves.length, plainError, deferredError,
        hashes: {observed: observed ? outputHashes(observed) : null, plain: plain ? outputHashes(plain) : null,
            deferred: deferred ? outputHashes(deferred.output) : null}};
    neutrality.pass = neutrality.observedEqualsPlain && neutrality.plainEqualsDeferred && neutrality.eofStable
        && plainConsumed === part.moves.length && deferred?.consumed === part.moves.length;
    const row = {name: part.name, negative: plan.negative, keys: part.moves.length,
        producerPass: reach.every(c => c.pass), sourcePass: contracts.every(c => c.pass),
        firstUnmetProducer: reach.find(c => !c.pass)?.name || null, error, reach, contracts,
        boundaries: observed?.screens.length, calls: observed?.calls.length, frames: observed?.frames.flat().length,
        outputHashes: observed ? outputHashes(observed) : null,
        stages: Object.fromEntries(Object.keys(plan.phases).map(name => [name, at(name) || null])),
        actionCallCount: actionCalls.length, actionCallPrefix: actionCalls.slice(0, 18), wearCalls,
        CAlternate: alternate, CFirstDamage: damage, CExpectedShrinkBound: bound, CStateFromMatchingPrefix: expected,
        messages, statesSHA256: hash(states), stateCount: states.length, neutrality, nativeParityClaimed: false};
    rows.push(row);
    appendFileSync(new URL('reports/probe01-progress.ndjson', root), JSON.stringify({name: row.name,
        producerPass: row.producerPass, firstUnmetProducer: row.firstUnmetProducer,
        sourceChecks: contracts.filter(c => c.pass).length, sourceTotal: contracts.length,
        neutrality: neutrality.pass}) + '\n');
}
const report = {runtimeSHA256: pins.files['runtime.json'], proposalSHA256: pins.files['proposals/proposal01.json'],
    recipeSHA256: pins.files['primary-recipe.json'], inputLockSHA256: pins.files['input-lock.json'],
    driverSHA256: pins.files['tools/probe.mjs'], cases: rows.length,
    producerPassed: rows.filter(r => r.producerPass).length, sourcePassed: rows.filter(r => r.sourcePass).length,
    sourceChecks: rows.flatMap(r => r.contracts).filter(c => c.pass).length,
    sourceTotal: rows.flatMap(r => r.contracts).length, neutrality: rows.filter(r => r.neutrality.pass).length,
    runtimeCandidate: false, referenceCExecutions: 0, rows};
writeFileSync(new URL('reports/probe01.json', root), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
process.stdout.write(JSON.stringify({cases: report.cases, producerPassed: report.producerPassed,
    sourcePassed: report.sourcePassed, sourceChecks: report.sourceChecks, sourceTotal: report.sourceTotal,
    neutrality: report.neutrality}) + '\n');
