import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('./', import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const read = name => JSON.parse(readFileSync(new URL(name, root)));
const lock = read('input-lock.json');
for (const [name, digest] of Object.entries(lock.files))
    assert.equal(sha(readFileSync(new URL(name, root))), digest, name);
assert.equal(sha(readFileSync(new URL('probe.mjs', root))), lock.probeSHA256);
const runtime = read('runtime.json');
const verifyRuntime = () => {
    assert.equal(Object.keys(runtime).length, 280);
    for (const [name, digest] of Object.entries(runtime))
        assert.equal(sha(readFileSync(new URL(name, root))), digest, name);
};
verifyRuntime();
const recipe = read('recipe.json');
assert.deepEqual(recipe.segments.map(part => lock.fields.map(field =>
    ({field, present:Object.hasOwn(part, field), value:part[field]}))), lock.tuples);
const {runSegment} = await import('./js/jsmain.js');
const {InMemoryStorage} = await import('./js/storage.js');
const {PMNAMES} = await import('./js/monst_data.js');
const {ONAMES} = await import('./js/objects_data.js');
const {decodeScreen, renderCell} = await import('./frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./tools/half-damage-reader-observe.mjs');
const predictions = read('predictions.json');
const rows = [];
const object = obj => obj ? {id:obj.o_id, type:obj.otyp, letter:obj.invlet,
    artifact:obj.oartifact || 0, worn:obj.owornmask || 0, cursed:!!obj.cursed} : null;
for (const [index, part] of recipe.segments.entries()) {
    const states = [], checks = [], p = predictions[index];
    const check = (kind, name, fn) => {
        try {fn(); checks.push({kind, name, pass:true});}
        catch (error) {checks.push({kind, name, pass:false, error:error.message});}
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            if (!g.u || !g.level) return;
            states.push({step, turn:g.moves, hp:g.u.uhp, level:g.u.ulevel, female:!!g.flags.female, mortality:g.u.umortality || 0,
                hero:[g.u.ux, g.u.uy], weapon:object(g.u.uwep), alternate:object(g.u.uswapwep),
                inventory:(g.invent || []).map(object),
                balrogs:g.level.monsters.filter(m => m.mnum === PMNAMES.PM_BALROG && m.mhp > 0)
                    .map(m => ({id:m.m_id, xy:[m.mx,m.my], hp:m.mhp, movement:m.movement, canmove:!!m.mcanmove, weaponCheck:m.weapon_check, peaceful:!!m.mpeaceful,
                        asleep:!!m.msleeping, weapon:object(m.mw), inventory:(m.minvent || []).map(object)}))});
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const out = structuredClone(outputs(run));
    const texts = out.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    const created = states.find(s => s.balrogs.length);
    const wielded = states.find(s => s.balrogs.some(m => m.weapon));
    const mon = wielded?.balrogs[0];
    check('producer', 'one live hostile Balrog created through the real command', () => {
        assert.equal(created?.balrogs.length, 1);
        assert.equal(created.balrogs[0].peaceful, false);
        assert.equal(created.balrogs[0].asleep, false);
        assert.ok(states.filter(s => s.step >= created.step).every(s =>
            s.balrogs.length === 1 && s.balrogs[0].id === created.balrogs[0].id));
    });
    check('producer', 'real desired primary and alternate hero slots', () => {
        assert.ok(created);
        assert.equal(created.level, 30);
        assert.equal(created.female, true);
        assert.ok(created.hp > 120);
        assert.equal(created.weapon?.type ?? null, p.armed ? ONAMES[p.weapon] : null);
        assert.equal(created.alternate?.type ?? null, p.alternate ? ONAMES.LONG_SWORD : null);
        assert.equal(created.inventory.length, 1);
        assert.equal(created.inventory[0].type, ONAMES[p.weapon]);
    });
    check('producer', 'ordinary bullwhip and broadsword both available', () => {
        assert.ok(mon && mon.hp > 0);
        for (const type of [ONAMES.BULLWHIP, ONAMES.BROADSWORD])
            assert.ok(mon.inventory.some(o => o.type === type && !o.artifact));
        assert.ok(mon.inventory.every(o => !o.artifact));
    });
    check('producer', 'real monster wield action and visible message reached', () => {
        assert.ok(mon?.weapon);
        assert.ok(texts.some(t => t.includes('balrog wields')));
        assert.ok(Math.max(...mon.xy.map((v,i) => Math.abs(v-wielded.hero[i]))) <= 2);
    });
    check('producer', 'all inputs consumed with no death', () => {
        assert.equal(states.at(-1)?.step, part.moves.length);
        assert.equal(out.screens.length, part.moves.length + 1);
        assert.deepEqual(out.slices.flat(), out.calls);
        assert.ok(states.every(s => s.hp > 0 && !s.mortality));
    });
    check('source', 'Balrog prefers its bullwhip only while the hero is armed', () => {
        assert.ok(mon?.weapon);
        if (p.armed) assert.equal(mon.weapon.type, ONAMES.BULLWHIP);
        else assert.notEqual(mon.weapon.type, ONAMES.BULLWHIP);
    });
    const plain = structuredClone(outputs(await runSegment({...part, storage:new InMemoryStorage()})));
    const delayed = await deferred(part);
    check('neutrality', 'passive observer preserves all five streams', () => assert.deepEqual(out, plain));
    check('neutrality', 'deferred input preserves all five streams and pending EOF', () => assert.deepEqual(out, delayed));
    rows.push({index, name:part.name, checks, producer:checks.filter(c => c.kind === 'producer').every(c => c.pass),
        source:checks.filter(c => c.kind === 'source').every(c => c.pass),
        created, wielded, final:states.at(-1), hashes:hashes(out),
        boundaries:out.screens.length, calls:out.calls.length, frames:out.frames.flat().length,
        wieldMessages:texts.flatMap((text, step) => text.includes('balrog wields') ? [{step, top:text.split('\n')[0]}] : [])});
}
verifyRuntime();
writeFileSync(new URL('baseline-observation.json', root), JSON.stringify(rows, null, 2) + '\n', {flag:'wx'});
writeFileSync(new URL('negative-hashes.json', root), JSON.stringify([2,3].map(i => ({index:i, hashes:rows[i].hashes})), null, 2) + '\n', {flag:'wx'});
console.log(JSON.stringify({cases:rows.length, producers:rows.filter(r => r.producer).length,
    source:rows.filter(r => r.source).length, checks:rows.flatMap(r => r.checks).filter(c => c.pass).length,
    totalChecks:rows.flatMap(r => r.checks).length,
    neutrality:rows.flatMap(r => r.checks).filter(c => c.kind === 'neutrality' && c.pass).length,
    negativeHashes:10}));
