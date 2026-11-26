import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';

const file = name => new URL(name, import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => JSON.parse(readFileSync(file(name), 'utf8'));
const lock = read('input-lock.json');
for (const [name, expected] of Object.entries(lock.files))
    assert.equal(sha(readFileSync(file(name))), expected, name);
assert.equal(sha(readFileSync(file('probe.mjs'))), lock.probeSHA256);
const recipe = read('recipe.json');
const predictions = read('predictions.json');
const pins = read('baseline-runtime.json');
function verifyRuntime() {
    assert.equal(Object.keys(pins).length, 280);
    for (const [name, expected] of Object.entries(pins))
        assert.equal(sha(readFileSync(file('baseline/' + name))), expected, name);
}
verifyRuntime();
for (const row of read('source-pins.json').files)
    assert.equal(sha(readFileSync(file(row.path))), row.sha256, row.path);
for (const name of ['review/ordinary-baseline.json', 'review/negative-hashes.json'])
    assert.ok(!existsSync(file(name)), 'retain prior report: ' + name);

// All runtime imports follow the fixed graph and source/input checks.
const {runSegment} = await import('./js/jsmain.js');
const {InMemoryStorage} = await import('./js/storage.js');
const {ONAMES} = await import('./js/objects_data.js');
const {Blind, Blinded, Confusion, Stunned, Teleport_control} = await import('./js/youprop.js');
const {noteleport_level} = await import('./js/teleport.js');
const {unconscious} = await import('./js/trap.js');
const {decodeScreen, renderCell} = await import('./frozen/screen-decode.mjs');
const {outputs, hashes, hash, deferred} = await import('./tools/half-damage-reader-observe.mjs');
const object = o => ({id:o.o_id, type:o.otyp, quantity:o.quan, letter:o.invlet,
    charges:o.spe, blessed:!!o.blessed, cursed:!!o.cursed, seen:!!o.dknown});
const rows = [];
for (const [index, part] of recipe.segments.entries()) {
    const p = predictions[index];
    const states = [], checks = [];
    const check = (name, body) => {
        try { body(); checks.push({name, pass:true}); }
        catch (error) { checks.push({name, pass:false, error:error.message}); }
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run, runError;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.u || !g.level || !g.youmonst?.data) return;
            states.push({step, turn:g.moves, hp:g.u.uhp, mortality:g.u.umortality || 0,
                xy:[g.u.ux,g.u.uy], level:{...g.u.uz}, wizard:!!g.wizard, explore:!!g.discover,
                naturalNoTeleport:!!g.level.flags.noteleport,
                stasisUntil:g.level.flags.stasis_until || 0,
                restricted:!!noteleport_level(g.youmonst),
                blind:!!Blind(), blinded:!!Blinded(), confused:!!Confusion(), stunned:!!Stunned(),
                unconscious:!!unconscious(), teleportControl:!!Teleport_control(),
                scrollKnown:!!g.objects[ONAMES.SCR_TELEPORTATION].oc_name_known,
                inventory:(g.invent || []).filter(o =>
                    [ONAMES.WAN_STASIS,ONAMES.SCR_TELEPORTATION].includes(o.otyp)).map(object)});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } catch (error) { runError = error.stack; }
    finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const out = run ? structuredClone(outputs(run)) : null;
    const texts = out?.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n')) || [];
    const at = step => states.find(s => s.step === step);
    const first = at(1), beforeAction = at(p.beforeAction), beforeRead = at(p.beforeRead);
    const last = states.at(-1);
    const wand = s => s?.inventory.find(o => o.type === ONAMES.WAN_STASIS);
    const scroll = s => s?.inventory.find(o => o.type === ONAMES.SCR_TELEPORTATION);
    check('maintained startup produces a charged stasis wand', () => {
        assert.ok(first && first.hp > 0);
        assert.equal(wand(first)?.letter, 'c');
        assert.equal(wand(first)?.charges, 3);
        assert.equal(wand(first)?.cursed, false);
        assert.equal(first.stasisUntil, 0);
    });
    check('real blessed teleport scroll is ready to read', () => {
        assert.equal(scroll(beforeRead)?.letter, 'o');
        assert.equal(scroll(beforeRead)?.quantity, 1);
        assert.equal(scroll(beforeRead)?.blessed, true);
        assert.equal(scroll(beforeRead)?.cursed, false);
        assert.equal(scroll(beforeRead)?.seen, true);
        assert.equal(beforeRead.scrollKnown, false);
    });
    check('actual explore transition and wizard bypass flag', () => {
        assert.equal(beforeRead?.wizard, p.wizard);
        assert.equal(beforeRead?.explore, !p.wizard);
        assert.equal(texts.some(t => t.includes('now in non-scoring explore mode')), !p.wizard);
    });
    check('real activation charge, timeout and restriction predicate', () => {
        assert.equal(beforeRead?.naturalNoTeleport, false);
        assert.equal(beforeRead?.restricted, p.stasis);
        assert.equal(wand(beforeRead)?.charges, 3 - Number(p.stasis));
        assert.equal(beforeRead.turn - beforeAction.turn, 1);
        if (p.stasis) {
            assert.ok(beforeRead.stasisUntil >= beforeRead.turn);
            assert.ok(beforeRead.stasisUntil - beforeAction.turn >= 10);
            assert.ok(beforeRead.stasisUntil - beforeAction.turn <= 30);
        } else assert.equal(beforeRead.stasisUntil, 0);
    });
    check('ordinary perception and control prerequisites', () => {
        assert.equal(beforeRead.blind, false);
        assert.equal(beforeRead.blinded, false);
        assert.equal(beforeRead.confused, false);
        assert.equal(beforeRead.stunned, false);
        assert.equal(beforeRead.unconscious, false);
        assert.equal(beforeRead.teleportControl, false);
    });
    check('C scrolltele early restriction feedback', () => {
        const tail = texts.slice(p.beforeRead);
        assert.equal(tail.some(t => t.includes('A mysterious force prevents you from teleporting!')), p.blocked);
        assert.equal(tail.some(t => t.includes('Where do you want to be teleported?')), !p.blocked);
    });
    check('real read consumes and discovers the scroll', () => {
        assert.equal(scroll(last), undefined);
        assert.equal(last.scrollKnown, true);
        assert.equal(last.turn - beforeRead.turn, 1);
        assert.equal(wand(last)?.id, wand(first)?.id);
    });
    check('blocked or cancelled destination preserves location', () => {
        assert.deepEqual(last.xy, beforeRead.xy);
        assert.deepEqual(last.level, beforeRead.level);
        assert.equal(texts.some(t => t.includes('You materialize')), false);
    });
    check('survival, every key and every random slice', () => {
        assert.equal(runError, undefined);
        assert.ok(states.every(s => s.hp > 0 && !s.mortality));
        assert.equal(last.step, part.moves.length);
        assert.equal(out.screens.length, part.moves.length + 1);
        assert.deepEqual(out.slices.flat(), out.calls);
    });
    let plainHashes, deferredHashes, plainError, deferredError;
    try { plainHashes = hashes(outputs(await runSegment({...part,storage:new InMemoryStorage()}))); }
    catch (error) { plainError = error.stack; }
    check('passive observation preserves all five streams', () => {
        assert.equal(plainError, undefined);
        assert.deepEqual(plainHashes, hashes(out));
    });
    try { deferredHashes = hashes(await deferred(part)); }
    catch (error) { deferredError = error.stack; }
    check('deferred EOF preserves all five streams', () => {
        assert.equal(deferredError, undefined);
        assert.deepEqual(deferredHashes, hashes(out));
    });
    rows.push({name:part.name, checks, first, beforeAction, beforeRead, last,
        events: texts.flatMap((text,step) => step >= p.beforeRead &&
            /teleport|read the scroll|scroll disappears|Never mind/.test(text)
            ? [{step, top:text.split('\n').slice(0,2).join('\n')}] : []),
        stateTraceSHA256:hash(states), hashes:out ? hashes(out) : null, plainHashes, deferredHashes,
        keys:part.moves.length, boundaries:out?.screens.length,
        calls:out?.calls.length, frames:out?.frames.flat().length,
        ...(runError || plainError || deferredError ? {runError,plainError,deferredError} : {})});
}
verifyRuntime();
const failures = rows.flatMap(r => r.checks.filter(c => !c.pass).map(c => ({case:r.name,...c})));
const report = {classification:'ordinary JS source-prediction controls, no native comparison',
    recipeSHA256:lock.files['recipe.json'], runtimeSHA256:lock.files['baseline-runtime.json'],
    cases:rows.length, checks:rows.reduce((n,r) => n+r.checks.length,0), failures, rows};
writeFileSync(file('review/ordinary-baseline.json'), JSON.stringify(report,null,2)+'\n', {flag:'wx'});
writeFileSync(file('review/negative-hashes.json'), JSON.stringify(lock.negativeIndexes.map(index =>
    ({index,name:rows[index].name,hashes:rows[index].hashes})),null,2)+'\n', {flag:'wx'});
console.log(JSON.stringify({cases:report.cases, checks:report.checks, failures}));
if (failures.length) process.exitCode = 1;
