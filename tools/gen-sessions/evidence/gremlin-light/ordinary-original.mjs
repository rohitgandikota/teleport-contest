import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root = new URL('./', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, root)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const lock = read('input-lock.json');
for (const [name, expected] of Object.entries(lock.files))
    assert.equal(sha(readFileSync(new URL(name, root))), expected, name);
assert.equal(sha(readFileSync(new URL('probe.mjs', root))), lock.probeSHA256);
const runtime = read('runtime.json');
const verifyRuntime = () => {
    assert.equal(Object.keys(runtime).length, 280);
    for (const [name, expected] of Object.entries(runtime))
        assert.equal(sha(readFileSync(new URL(name, root))), expected, name);
};
verifyRuntime();
const recipe = read('recipe.json'), plans = read('predictions.json');
assert.deepEqual(recipe.segments.map(part => lock.fields.map(field =>
    ({field, present:Object.hasOwn(part, field), value:part[field]}))), lock.tuples);
const {runSegment} = await import('./js/jsmain.js');
const {InMemoryStorage} = await import('./js/storage.js');
const {ONAMES} = await import('./js/objects_data.js');
const {PMNAMES} = await import('./js/monst_data.js');
const artifacts = await import('./js/artilist_data.js');
const {W_WEP, W_ARM} = await import('./js/const.js');
const {artifact_light} = await import('./js/artifact.js');
const {arti_light_radius} = await import('./js/light.js');
const {couldsee} = await import('./js/vision.js');
const {canseemon} = await import('./js/display.js');
const {monnear, onscary, in_your_sanctuary} = await import('./js/monmove.js');
const {Blind, Deaf, Unaware, Invis, Displaced, Hallucination} = await import('./js/youprop.js');
const {decodeScreen, renderCell} = await import('./frozen/screen-decode.mjs');
const {outputs, hashes, hash, deferred} = await import('./tools/half-damage-reader-observe.mjs');
const rows = [];
const object = obj => obj ? {id:obj.o_id, type:obj.otyp, letter:obj.invlet,
    artifact:obj.oartifact || 0, worn:obj.owornmask || 0, lamplit:!!obj.lamplit,
    artifactLight:!!artifact_light(obj), radius:arti_light_radius(obj),
    blessed:!!obj.blessed, cursed:!!obj.cursed} : null;
for (const [index, part] of recipe.segments.entries()) {
    const plan = plans[index], states = [], checks = [];
    const check = (kind, name, fn) => {
        try {fn(); checks.push({kind, name, pass:true});}
        catch (error) {checks.push({kind, name, pass:false, error:error.message});}
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run, error;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.u || !g.level) return;
            const primary = object(g.u.uwep), armor = object(g.u.uarm);
            const activeLight = !!((primary?.lamplit && primary.artifactLight)
                || (armor?.lamplit && armor.artifactLight));
            states.push({step, turn:g.moves, hp:g.u.uhp, hpmax:g.u.uhpmax,
                mortality:g.u.umortality || 0, level:g.u.ulevel, female:!!g.flags.female,
                hero:[g.u.ux,g.u.uy], primary, armor, inventory:(g.invent || []).map(object),
                activeLight, legacyPrimary:!!g.uwep, legacyArmor:!!g.uarm,
                blind:!!Blind(), deaf:!!Deaf(), unaware:!!Unaware(), invisible:!!Invis(),
                displaced:!!Displaced(), hallucinating:!!Hallucination(),
                lightSources:(g.light_sources || []).map(s => ({id:s.id, type:s.type, range:s.range})),
                liveIds:g.level.monsters.filter(m => m.mhp > 0).map(m => m.m_id),
                monsters:g.level.monsters.filter(m => m.mhp > 0 && m.mnum === PMNAMES[plan.species])
                    .map(m => ({id:m.m_id, species:m.mnum, xy:[m.mx,m.my], apparent:[m.mux,m.muy],
                        hp:m.mhp, hpmax:m.mhpmax, movement:m.movement,
                        peaceful:!!m.mpeaceful, tame:!!m.mtame, sleeping:!!m.msleeping,
                        canmove:!!m.mcanmove, speed:g.mons[m.mnum].mmove,
                        cansee:!!m.mcansee, couldsee:couldsee(m.mx,m.my), visible:canseemon(m),
                        adjacent:monnear(m,g.u.ux,g.u.uy), nearbyImage:monnear(m,m.mux,m.muy),
                        scaredSquare:onscary(g.u.ux,g.u.uy,m), sanctuary:in_your_sanctuary(m,0,0),
                        flee:!!m.mflee, fleetim:m.mfleetim || 0,
                        lightEligible:m.mnum === PMNAMES.PM_GREMLIN && activeLight
                            && !!m.mcansee && couldsee(m.mx,m.my)}))});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } catch (e) {error = String(e.stack || e).split('\n').slice(0,7).join('\n');}
    finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const out = run ? structuredClone(outputs(run)) : null;
    const texts = (out?.screens || []).map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    const before = states.find(s => s.step === plan.beforeCreation);
    const created = states.find(s => s.step === plan.creationEnd);
    const fresh = created?.monsters.filter(m => !before?.liveIds.includes(m.id)) || [];
    const id = fresh[0]?.id;
    const targetStates = states.filter(s => s.step >= plan.creationEnd)
        .flatMap(s => s.monsters.filter(m => m.id === id).map(mon => ({state:s, mon})));
    const encounter = targetStates.find(({state:s,mon:m}) => m.adjacent && m.nearbyImage
        && m.apparent[0] === s.hero[0] && m.apparent[1] === s.hero[1]);
    const firstFlee = targetStates.find(({mon}) => mon.flee);
    const last = states.at(-1);
    const desiredItem = created?.inventory.find(o => o.type === ONAMES[plan.item]);
    const feedback = texts.slice(plan.creationEnd).map(text => text.replace(/\s+/g,' '));
    const lightFeedback = feedback.some(text => (text.includes('painful light')
        && text.includes(plan.sourceName)) || text.includes('"Bright light!"'));
    check('producer', 'all input consumed with slice consistency and no runtime error', () => {
        assert.equal(error, undefined); assert.equal(last?.step, part.moves.length);
        assert.equal(out?.screens.length, part.moves.length + 1);
        assert.deepEqual(out.slices.flat(), out.calls);
    });
    check('producer', 'actual valid female level30 hero remains alive', () => {
        assert.equal(created?.female, true); assert.equal(created?.level, 30);
        assert.ok(created.hp > 120); assert.ok(states.every(s => s.hp > 0 && !s.mortality));
    });
    check('producer', 'exactly one new live hostile awake target after creation acknowledgments', () => {
        assert.ok(before && created); assert.equal(fresh.length, 1);
        assert.equal(fresh[0].peaceful, false); assert.equal(fresh[0].tame, false);
        assert.equal(fresh[0].sleeping, false); assert.ok(fresh[0].hp > 0);
    });
    check('producer', 'wished equipment type artifact and inventory really exist', () => {
        assert.equal(created?.inventory.length, 1); assert.ok(desiredItem);
        assert.equal(desiredItem.artifact, plan.artifact ? artifacts[plan.artifact] : 0);
        assert.equal(desiredItem.blessed, false); assert.equal(desiredItem.cursed, false);
    });
    check('producer', 'actual primary and suit slots and worn masks match the keyboard proposal', () => {
        assert.equal(created?.primary?.id ?? null, plan.slot === 'weapon' ? desiredItem.id : null);
        assert.equal(created?.armor?.id ?? null, plan.slot === 'armor' ? desiredItem.id : null);
        assert.equal(!!(desiredItem.worn & W_WEP), plan.slot === 'weapon');
        assert.equal(!!(desiredItem.worn & W_ARM), plan.slot === 'armor');
    });
    check('producer', 'actual light flag predicate radius and registration match equipment', () => {
        assert.equal(desiredItem?.lamplit, plan.lit);
        assert.equal(desiredItem.artifactLight, !!plan.artifact || plan.slot === 'armor');
        assert.equal(created.activeLight, plan.lit);
        assert.equal(desiredItem.radius, plan.lit ? (plan.slot === 'armor' ? 3 : 2) : 0);
        assert.equal(created.lightSources.some(s => s.id === desiredItem.id && s.range === desiredItem.radius), plan.lit);
    });
    check('producer', 'visible sighted mobile target reaches adjacent apparent hero', () => {
        assert.ok(encounter); const m = encounter.mon;
        assert.ok(m.cansee && m.couldsee && m.visible && m.canmove && m.speed > 0);
    });
    check('producer', 'no competing scary square or sanctuary at the encounter', () => {
        assert.ok(encounter); assert.equal(encounter.mon.scaredSquare, false);
        assert.equal(encounter.mon.sanctuary, false);
    });
    check('producer', 'hero is aware hearing sighted and not displaced invisible or hallucinating', () => {
        assert.ok(encounter);
        for (const key of ['blind','deaf','unaware','invisible','displaced','hallucinating'])
            assert.equal(encounter.state[key], false, key);
    });
    check('producer', 'real turns advance and the same target survives without extra spawned targets', () => {
        assert.ok(last.turn > created.turn); assert.ok(targetStates.length);
        assert.ok(states.filter(s => s.step >= plan.creationEnd).every(s =>
            s.monsters.filter(m => !before.liveIds.includes(m.id)).length === 1
            && s.monsters.some(m => m.id === id && m.hp > 0)));
    });
    check('source', 'C light eligibility matches the preselected positive or negative branch', () => {
        assert.ok(encounter); assert.equal(encounter.mon.lightEligible, plan.positive);
    });
    check('source', 'C positive eventually flees while matched negatives do not', () => {
        if (plan.positive) {
            assert.ok(firstFlee, 'requires original-C confirmation if absent in baseline JS');
            assert.ok(firstFlee.mon.fleetim > 0 && firstFlee.mon.fleetim <= 127);
        } else assert.equal(targetStates.some(x => x.mon.flee), false);
    });
    check('source', 'C painful-light OR Bright-light feedback, with neither in negatives', () => {
        assert.equal(lightFeedback, plan.positive);
        if (!plan.positive) assert.ok(feedback.every(t => !t.includes('painful light') && !t.includes('Bright light!')));
    });
    let plain, delayed, plainError, deferredError;
    try {plain = structuredClone(outputs(await runSegment({...part, storage:new InMemoryStorage()})));}
    catch (e) {plainError = String(e.stack || e).split('\n').slice(0,7).join('\n');}
    try {delayed = await deferred(part);}
    catch (e) {deferredError = String(e.stack || e).split('\n').slice(0,7).join('\n');}
    check('neutrality', 'passive observer preserves all five output streams', () => {
        assert.equal(plainError, undefined); assert.ok(out && plain); assert.deepEqual(out, plain);
    });
    check('neutrality', 'deferred input preserves all five streams and pending EOF', () => {
        assert.equal(deferredError, undefined); assert.ok(out && delayed); assert.deepEqual(out, delayed);
    });
    const compact = pair => pair ? {step:pair.state.step, turn:pair.state.turn, hp:pair.state.hp,
        hero:pair.state.hero, activeLight:pair.state.activeLight, mon:pair.mon} : null;
    rows.push({index, name:part.name, negative:!plan.positive, checks,
        producer:checks.filter(c => c.kind === 'producer').every(c => c.pass),
        source:checks.filter(c => c.kind === 'source').every(c => c.pass),
        firstUnmetProducer:checks.find(c => c.kind === 'producer' && !c.pass)?.name || null,
        error, plainError, deferredError, before, created, encounter:compact(encounter), firstFlee:compact(firstFlee), final:last,
        observedSteps:states.length, statesSHA256:hash(states), hashes:out ? hashes(out) : null,
        boundaries:out?.screens.length, calls:out?.calls.length, frames:out?.frames.flat().length,
        feedback:lightFeedback, messages:texts.flatMap((t,step) => step >= plan.creationEnd
            && /painful light|Bright light|gremlin|newt/.test(t.split('\n')[0])
            ? [{step,top:t.split('\n')[0]}] : []),
        postCreationRngPrefix:out?.slices.slice(plan.creationEnd).flat().slice(0,45),
        nativeParityClaimed:false});
}
verifyRuntime();
writeFileSync(new URL('baseline-observation.json', root), JSON.stringify(rows,null,2)+'\n', {flag:'wx'});
writeFileSync(new URL('negative-hashes.json', root), JSON.stringify([2,3,4].map(i =>
    ({index:i, hashes:rows[i].hashes})),null,2)+'\n', {flag:'wx'});
const checks = rows.flatMap(row => row.checks);
const report = {cases:5, producers:rows.filter(r => r.producer).length,
    producerChecks:checks.filter(c => c.kind === 'producer' && c.pass).length, producerTotal:50,
    sourceCases:rows.filter(r => r.source).length,
    sourceChecks:checks.filter(c => c.kind === 'source' && c.pass).length, sourceTotal:15,
    neutrality:checks.filter(c => c.kind === 'neutrality' && c.pass).length, neutralityTotal:10,
    checks:checks.filter(c => c.pass).length, totalChecks:75, negativeHashes:15,
    firstFailures:rows.map(r => ({name:r.name, producer:r.firstUnmetProducer,
        source:r.checks.filter(c => c.kind === 'source' && !c.pass).map(c => c.name)})),
    nativeParityClaimed:false};
writeFileSync(new URL('checks.json', root), JSON.stringify(report,null,2)+'\n', {flag:'wx'});
console.log(JSON.stringify(report));
if (checks.some(c => !c.pass)) process.exitCode = 1;
