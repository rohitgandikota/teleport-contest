// C trap.c:4233 dofiretrap: real polymorph, glove, fire-trap and cleanup producers.
// Current runtime imports; original assertions and negative rows are preserved.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const sha = b => createHash('sha256').update(b).digest('hex');
const hash = v => sha(JSON.stringify(v ?? null));
assert(process.argv.length <= 3 && !process.argv[2]?.startsWith('--'),
    'usage: dofiretrap-polymorph-gate.mjs [new-report.json]');
const reportFile = process.argv[2];
assert(!reportFile || !existsSync(reportFile), 'report must be a new file');
const evidence = new URL('gen-sessions/evidence/dofiretrap-polymorph/', import.meta.url);
const evidencePins = {
    "README.md": "1723e7d3aa32ce17d111462dc00aa21bd6c6a65107f814f8ba7d426eafeea5e9",
    "baseline-native.json": "4610b28680115d6aacc0e9221ea6594fe6d85eef8c972cccfde62d5dc423b726",
    "candidate-native.json": "a8396fbecb093cef2fad72d1335d9dc7202d090bfe55c05713a523032850f0f1",
    "candidate-seal.json": "296d189f5bd4480475f8a597efe11fb37483a4a91779ddb1972246e29a7314ed",
    "cleanup-seal.json": "d6f165504df949f05c4b1411ab4182d91833b807c7de0b66e2c0731f29716d4f",
    "derivation.json": "96061c6b66d4f1001f73e2bdf2e3a689ffd363d0a57abf53d12f2fc513d9f612",
    "history/candidate-comparison.json": "86a34d8e771005927fc6838da9ef82507c4bcf0625f7b63d4525bd8e2b92cfa4",
    "history/candidate-launch.json": "655bc98dd7cf472967c8fc3fe2d33025d85935663f8b6386e5e5f3c8755a7766",
    "history/cleanup-attribution.json": "e9e64c8dce63a1d4bfbe42f4e6e96e8d48b6f6ef250b24a6781f98fed82a3734",
    "history/diagnostics.json": "21d1ce5f8419da06d8341786eb42abd6cd0edca7acfc5c62f2a1b11bfb6a8b97",
    "history/original-attribution.json": "86a2f5f4a9dd85729b9decc6086e658372107c2d06438d3a0605108071117b6a",
    "history/original-failed-probe.mjs": "5bc11781092afcfc58008e2004115812c78ccfbe956d367af6725d82047d261a",
    "history/original-input-lock.json": "72fa0ee454ff6374e4437e6d52ed10acf3da188c98bd43942ccbb1aec61dab62",
    "history/original-negative-outputs.json": "5a3b9ea9dd37ab458701aeb9aa81e8f5d956e82547d870f67a454952e4658d27",
    "history/original-proposal.json": "3465900a1ad6595c44a28a2b7070c62e4d843c9669b27023617e0ffbc18b50f2",
    "history/original-seal.json": "85d5c433c32f718b78f2d26e7a6abe2a66689f469181c9904c6f1870325eb53b",
    "history/parent-baseline-command.json": "32df94435c05277ae79974eb0c1f6eb604c8220d33eef76b127a2f1eaf67ca28",
    "history/parent-baseline.log": "d1be66e7a2f651b002800ecc1614cc92d64b231b49c7785a0a8d2e7cbba3a21d",
    "history/provisional-candidate-seal.json": "abfb3bdd228c183d67d718748cd49f7d6a9cae92e8da83cfee07fe04bdd057ae",
    "history/verifier-before-shape-correction.py": "ae097f473c3fb9c1e592c551e9db4d18344c68783b68b7901274d073fb908b93",
    "history/verifier-shape-failure.json": "1df252a9adb323010b0bbaa94d54568b2553af1d8690b7230c437199c121f4d8",
    "input-lock.json": "be0063b019d30c1c17d87ce461a58a4253dde708515423d9f78a997e93ddcd6a",
    "native-preflight.json": "97e1325b04baa83d2ae357fb2d19b459e0952e46a87c35e43ad9854716915b14",
    "negative-ordinary-rows.json": "8a574841e984277923a3fc5875acb9d523e80a68505d2b3cab66b3c8272f4d41",
    "negative-outputs.json": "610226827c59cee06b90c2e83b046a63def9dc5b0466cb398765c491a1cead00",
    "ordinary-original.mjs": "16f58c4245fb3ed1bf5a4fcdfc40a12e11d0ecea0d4664ade62373c773dc6474",
    "parent-input-lock.json": "497881f73f7a33cf38df28cb7f581a3274c777854a92a52cafce530742e4c007",
    "proposal.json": "dafd221435f2f8724a783d6e78287addbdec2be4a2b02ed88dc69279e85a4da7",
    "provenance.json": "46c36f4f80917b46975610236edeafb7e76eb437ee6b4116d8574cc0651ce1a3",
    "recording-receipt.json": "26d1545d966f99acf59869dab5edf39b81c8503462713128e9c31644c61d81ea",
    "source-review.md": "5dc04e288492829abee5aa31ce78e987abaaae07ca2d86cf67e4456159d5956a"
};
for (const [name, expected] of Object.entries(evidencePins))
    assert.equal(sha(readFileSync(new URL(name, evidence))), expected, name);
const read = name => JSON.parse(readFileSync(new URL(name, evidence)));
const proposal = read('proposal.json'), lock = read('input-lock.json');
const negative = read('negative-outputs.json'), negativeRows = read('negative-ordinary-rows.json');
const cleanupSeal = read('cleanup-seal.json'), candidateSeal = read('candidate-seal.json');
const receipt = read('recording-receipt.json'), parentLock = read('parent-input-lock.json');
const recipeBytes = readFileSync(new URL('gen-sessions/recipes/dofiretrap-polymorph-cleanup.json', import.meta.url));
const recipeSHA256 = sha(recipeBytes);
assert.equal(recipeSHA256, '89a5937fa4330ba9d45418d4ccb73c4662b5330e3a81496354e9a96241ef0557');
const recipe = JSON.parse(recipeBytes);
assert.equal(cleanupSeal.recipeSHA256, recipeSHA256);
assert.equal(candidateSeal.recipeSHA256, recipeSHA256);
assert.equal(cleanupSeal.inputLockSHA256, evidencePins['input-lock.json']);
assert.equal(cleanupSeal.driverSHA256, evidencePins['ordinary-original.mjs']);
assert.equal(candidateSeal.sourceSealSHA256, evidencePins['cleanup-seal.json']);
assert.equal(lock.proposalSHA256, evidencePins['proposal.json']);
assert.equal(lock.lockedBeforeProbe, true);
assert.equal(receipt.exit, 0);
assert.equal(receipt.cExecutedOnce, true);
assert.equal(receipt.sourceSealSHA256, evidencePins['cleanup-seal.json']);
assert.equal(receipt.primaryRecipeSHA256, recipeSHA256);
assert.equal(receipt.inputSHA256, recipeSHA256);
assert.equal(parentLock.beforeC, true);
assert.equal(parentLock.sourceSealSHA256, evidencePins['cleanup-seal.json']);
for (const field of ['sourceRecipeSHA256', 'primaryRecipeSHA256', 'minimalSHA256'])
    assert.equal(parentLock[field], recipeSHA256);
const rawBytes = readFileSync(new URL('gen-sessions/generated/dofiretrap-polymorph-cleanup.session.json', import.meta.url));
const rawSHA256 = sha(rawBytes);
assert.equal(rawSHA256, 'f1d26027a6456e8043fa4e5acce9b4aaabbb41712d1361c98e2f8f403e4c2fb3');
assert.equal(rawBytes.length, 1668076);
assert.equal(receipt.rawSha256, rawSHA256);
assert.equal(candidateSeal.rawSHA256, rawSHA256);
const native = JSON.parse(rawBytes);
assert.equal(native.source, 'c');
assert.equal(native.version, 5);
for (const field of Object.keys(recipe)) {
    if (field === 'segments') continue;
    assert.equal(Object.hasOwn(native, field), true);
    assert.deepEqual(native[field], recipe[field]);
}
assert.deepEqual(recipe.segments, proposal.segments);
assert.equal(recipe.requireBranchAssertions, true);
for (const parts of [recipe.segments, proposal.segments, native.segments, lock.segments,
    recipe.branches, recipe.branchAssertions]) assert.equal(parts.length, 8);
assert.deepEqual(lock.fields, ['name', 'seed', 'datetime', 'nethackrc', 'moves']);
let keyCount = 0, boundaryCount = 0;
for (const [i, part] of proposal.segments.entries()) {
    const fields = lock.fields.map(field => ({field, present: Object.hasOwn(part, field), value: part[field]}));
    assert.deepEqual(fields, lock.segments[i].fields);
    assert.equal(hash(fields), lock.segments[i].fieldsSHA256);
    assert.equal(sha(part.moves), lock.segments[i].movesSHA256);
    assert.deepEqual([...Buffer.from(part.moves)], lock.segments[i].keys);
    for (const field of lock.fields) {
        assert.equal(Object.hasOwn(native.segments[i], field), Object.hasOwn(part, field));
        assert.deepEqual(native.segments[i][field], part[field]);
    }
    assert.deepEqual(native.segments[i].steps.map(s => s.key), [null, ...part.moves]);
    assert.equal(recipe.branchAssertions[i].branch, recipe.branches[i]);
    assert.equal(recipe.branchAssertions[i].segment, i);
    assert.deepEqual(recipe.branchAssertions[i].screenIncludes, proposal.predictions[i].C.requiredPhrases);
    assert.deepEqual(recipe.branchAssertions[i].screenExcludes, proposal.predictions[i].C.excludedPhrases);
    keyCount += part.moves.length;
    boundaryCount += native.segments[i].steps.length;
}
assert.equal(keyCount, 1154);
assert.equal(keyCount, lock.totalKeys);
assert.equal(boundaryCount, 1162);
assert.equal(boundaryCount, lock.totalBoundaries);
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(recipe, native), []);
assert.equal(native.segments.flatMap(s => s.steps).flatMap(s => s.rng || []).length, 22506);
assert.equal(native.segments.flatMap(s => s.steps).flatMap(s => s.animation_frames || []).length, 21);
assert.equal(negative.hashCount, 15);
assert.equal(negative.rows.length, 3);
assert.equal(negativeRows.length, 3);
assert.equal(negative.reportSHA256, cleanupSeal.probeReportSHA256);
const nativeBefore = read('baseline-native.json'), nativeAfter = read('candidate-native.json');
assert.equal(nativeBefore.length, 8);
assert.equal(nativeAfter.length, 8);
assert.equal(evidencePins['candidate-native.json'], candidateSeal.nativeReportSHA256);
assert.deepEqual(nativeBefore.slice(5), nativeAfter.slice(5));
for (const row of nativeAfter)
    assert(row.fullStyleExact && row.frozenScreenCursorExact && row.fullRngExact && row.animationExact);
for (const [i, row] of negativeRows.entries()) {
    assert.equal(hash(row), negative.rows[i].rowSHA256);
    assert.deepEqual(row.outputHashes, negative.rows[i].outputHashes);
    assert.deepEqual(row.outputHashes, nativeAfter[i + 5].rawHashes.js);
}
const original = readFileSync(new URL('ordinary-original.mjs', evidence), 'utf8');
const current = readFileSync(new URL(import.meta.url), 'utf8');
const derivation = read('derivation.json');
const originalStart = original.indexOf(derivation.start);
const originalEnd = original.indexOf(derivation.end, originalStart);
const preserved = original.slice(originalStart, originalEnd).replace(derivation.removedProgressWrite, '');
assert.equal(sha(preserved), derivation.portableBodySHA256);
assert.equal(original.split(derivation.removedProgressWrite).length, 2);
assert.equal(sha(original), derivation.originalDriverSHA256);
assert.equal(current.split('// BEGIN ORIGINAL ORDINARY BODY\n')[1].split('// END ORIGINAL ORDINARY BODY')[0], preserved);
// All evidence, original C, input and primary checks above precede tested game imports.
// BEGIN ORIGINAL ORDINARY BODY
const {runSegment, NethackGame} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {ONAMES} = await import('../js/objects_data.js');
const {PMNAMES} = await import('../js/monst_data.js');
const {Upolyd, W_ARMG, ROOM, FIRE_TRAP, FROMFORM, TIMEOUT, G_GENOD} = await import('../js/const.js');
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
            const monsters = g.level.monsters.map(m => ({id: m.m_id, species: g.mons[m.mnum].pmnames[2],
                position: [m.mx, m.my], hp: m.mhp, state: m.mstate || 0}));
            const occupancy = [...g.level.monAt].map(([position, m]) => ({position, id: m.m_id, hp: m.mhp}));
            states.push({step, turn: g.moves, hero: [x, y], level: {...u.uz}, terrain: g.level.at(x, y).typ,
                wizard: !!g.wizard, debugMongen: !!g.iflags.debug_mongen,
                liveMonsters: monsters.filter(m => m.hp > 0), deadQueued: monsters.filter(m => m.hp < 1),
                rawMap: occupancy, purgeCount: g.iflags.purge_monsters || 0,
                genocidedSpecies: g.mvitals.flatMap((v, i) => (v.mvflags & G_GENOD) ? [i] : []),
                literacy: u.uconduct.literate || 0, wishes: u.uconduct.wishes || 0,
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
    const initial = at('initial'), scroll = at('scrollWish'), cleaned = at('cleaned');
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
    check('fixed monsters exist before real cleanup', initial?.liveMonsters.length > 0
        && initial.wizard && !initial.debugMongen && initial.inventory.length === 0 && !initial.polymorphed);
    check('real wished blessed scroll occupies slot a', scroll?.inventory.length === 1
        && scroll.inventory[0].type === 'SCR_GENOCIDE' && scroll.inventory[0].letter === 'a'
        && scroll.inventory[0].quantity === 1 && scroll.inventory[0].blessed && !scroll.inventory[0].cursed
        && !scroll.inventory[0].artifact && !scroll.inventory[0].worn);
    check('star cleanup removes live monsters and their raw map slots', initial && cleaned
        && cleaned.liveMonsters.length === 0
        && cleaned.rawMap.every(m => !initial.liveMonsters.some(old => old.id === m.id))
        && text.includes(`Eliminated ${initial.liveMonsters.length} monster${initial.liveMonsters.length === 1 ? '' : 's'}.`));
    check('cleanup consumes scroll without species genocide', cleaned && initial && !cleaned.inventory.length
        && cleaned.literacy === initial.literacy + 1 && cleaned.wishes === initial.wishes + 1
        && hash(cleaned.genocidedSpecies) === hash(initial.genocidedSpecies)
        && cleaned.genocidedSpecies.length === 0 && !cleaned.polymorphed);
    check('read consumes time without damaging healthy human', cleaned && initial
        && cleaned.turn > initial.turn && cleaned.humanHP === initial.humanHP
        && cleaned.humanMax === initial.humanMax && cleaned.humanHP === cleaned.humanMax);
    check('no live monsters at any observed boundary after cleanup', cleaned && last
        && states.filter(s => s.step >= plan.phases.cleaned).every(s => !s.liveMonsters.length
            && s.rawMap.every(m => m.hp < 1) && !s.debugMongen && !s.genocidedSpecies.length));
    check('one ordinary west step reaches clear room floor', floor && cleaned
        && floor.hero[0] === cleaned.hero[0] - 1 && floor.hero[1] === cleaned.hero[1]
        && hash(floor.level) === hash(cleaned.level) && floor.turn > cleaned.turn
        && floor.terrain === ROOM && !floor.floor.length && !floor.trap && !floor.polymorphed);
    check('controlled exact species produced with healthy monster pool', poly?.polymorphed && poly.species === plan.species
        && poly.speciesIndex === PMNAMES['PM_' + plan.species.toUpperCase().replaceAll(' ', '_')]
        && poly.monsterHP === poly.monsterMax && poly.speciesLevel === plan.speciesLevel && poly.formTimeout > 0);
    check('source HP producer reached', poly && (plan.golemHP === null
        ? poly.monsterMax > 16 && poly.monsterMax <= 120 : poly.monsterMax === plan.golemHP));
    check('only real wished uncursed gloves occupy slot b', wish?.inventory.length === 1
        && wish.inventory[0].type === 'GAUNTLETS_OF_FUMBLING' && wish.inventory[0].letter === 'b'
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
    check('source-predicted ordinary producer feedback', text.includes('You turn into ' + (plan.fireResistant ? 'an ' : 'a ') + plan.species + '!')
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
    source('C paper trigger always rehumanizes; controls preserve selected form', plan.trigger && plan.species === 'paper golem'
        ? last && !last.polymorphed && last.monsterHP === 0 && last.monsterMax === 0
        : plan.trigger && plan.species === 'straw golem' ? expected && last?.polymorphed === expected.polymorphed
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
        cleanupObservation: {initialLive: initial?.liveMonsters.length,
            cleanedLive: cleaned?.liveMonsters.length, cleanedDeadQueued: cleaned?.deadQueued.length,
            cleanedPurge: cleaned?.purgeCount, cleanedRawMap: cleaned?.rawMap.length,
            postCleanupMaximumLive: Math.max(0, ...states.filter(s => s.step >= plan.phases.cleaned).map(s => s.liveMonsters.length)),
            postCleanupFirstLive: states.find(s => s.step >= plan.phases.cleaned && s.liveMonsters.length) || null},
        messages, statesSHA256: hash(states), stateCount: states.length, neutrality, nativeParityClaimed: false};
    rows.push(row);
}
// END ORIGINAL ORDINARY BODY
const freshNegativeRows = rows.filter(row => row.negative);
// JSON serialization only omits undefined optional error fields, as in the original reports.
const persistedRows = JSON.parse(JSON.stringify(rows));
assert.deepEqual(JSON.parse(JSON.stringify(freshNegativeRows)), negativeRows);
for (const row of freshNegativeRows) {
    const expected = negative.rows.find(saved => saved.name === row.name);
    assert.equal(hash(row), expected.rowSHA256);
    assert.deepEqual(row.outputHashes, expected.outputHashes);
}
const producerChecks = rows.flatMap(row => row.reach).filter(check => check.pass).length;
const sourceChecks = rows.flatMap(row => row.contracts).filter(check => check.pass).length;
const report = {
    cases: rows.length, producerChecks, producerTotal: 192, sourceChecks, sourceTotal: 56,
    producerPassed: rows.filter(row => row.producerPass).length,
    sourcePassed: rows.filter(row => row.sourcePass).length,
    neutrality: rows.filter(row => row.neutrality.pass).length,
    negativeHashes: 15, completeNegativeRows: 3,
    preflight: {rawSHA256, recipeSHA256, source: 'c', version: 5, primaryBranches: 8,
        fiveFieldsAndPresence: true, allKeys: true, keys: keyCount, boundaries: boundaryCount,
        integrityErrors: [], primaryErrors: [], beforeTestedImports: true},
    archivedNative: {cases: 8, passed: 8, completeNegativeRowsUnchanged: 3,
        reportSHA256: evidencePins['candidate-native.json']}, nativeReplays: 0,
    rows: persistedRows.map(row => ({name: row.name, producerPass: row.producerPass,
        sourcePass: row.sourcePass, rowSHA256: hash(row), statesSHA256: row.statesSHA256,
        outputHashes: row.outputHashes, neutrality: row.neutrality.pass,
        failedProducer: row.reach.filter(check => !check.pass).map(check => check.name),
        failedSource: row.contracts.filter(check => !check.pass).map(check => check.name)})),
};
if (reportFile) writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
process.stdout.write(JSON.stringify(report) + '\n');
assert.equal(rows.length, 8);
assert(rows.every(row => row.reach.length === 24 && row.contracts.length === 7));
assert.equal(producerChecks, 192);
assert.equal(sourceChecks, 56);
assert.equal(report.producerPassed, 8);
assert.equal(report.sourcePassed, 8);
assert.equal(report.neutrality, 8);
