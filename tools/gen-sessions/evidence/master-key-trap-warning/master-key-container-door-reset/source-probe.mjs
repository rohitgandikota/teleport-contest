import {proof} from './preflight.mjs';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('./', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => JSON.parse(readFileSync(new URL(name, root)));
const lock = read('input-lock.json');
for (const [name, digest] of Object.entries(lock.files))
    assert.equal(sha(readFileSync(new URL(name, root))), digest, name);
const verifyRuntime = () => {
    for (const [name, digest] of Object.entries(read('runtime.json')))
        assert.equal(sha(readFileSync(new URL(name, root))), digest, name);
};
verifyRuntime();
for (const [name, digest] of Object.entries(read('source-pins.json')))
    assert.equal(sha(readFileSync(new URL('../../../' + name, root))), digest, name);
const recipe = read('recipe.json'), predictions = read('predictions.json');
assert.deepEqual(recipe.segments.map(s => lock.fields.map(field =>
    ({field, present: Object.hasOwn(s, field),
        ...(Object.hasOwn(s, field) ? {value: s[field]} : {})}))), lock.tuples);
assert.deepEqual(recipe.segments.map(s => [...s.moves].map(c => c.charCodeAt(0))), lock.keys);

const {runSegment} = await import('./js/jsmain.js');
const {InMemoryStorage} = await import('./js/storage.js');
const {ONAMES} = await import('./js/objects_data.js');
const {ART_MASTER_KEY_OF_THIEVERY} = await import('./js/artilist_data.js');
const {ARROW_TRAP, DOOR, D_TRAPPED, OBJ_INVENT, W_WEP, W_ARMG} = await import('./js/const.js');
const {Blind} = await import('./js/youprop.js');
const {glyph_at, glyph_is_trap} = await import('./js/display.js');
const {decodeScreen, renderCell} = await import('./frozen/screen-decode.mjs');
const {outputs, hashes, deferred} = await import('./tools/half-damage-reader-observe.mjs');
const object = o => o ? {id: o.o_id, type: o.otyp, count: o.quan,
    letter: o.invlet, where: o.where, worn: o.owornmask || 0,
    artifact: o.oartifact || 0, trapped: !!o.otrapped,
    blessed: !!o.blessed, cursed: !!o.cursed} : null;
const rows = [];
for (const [index, part] of recipe.segments.entries()) {
    const p = predictions[index], states = [], checks = [];
    const checkpoints = new Set([p.start, ...p.phases.map(s => s.after)]);
    const check = (kind, name, fn) => {
        try { fn(); checks.push({kind, name, pass: true}); }
        catch (error) { checks.push({kind, name, pass: false, error: error.message}); }
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            if (!checkpoints.has(step) || !g.u || !g.level) return;
            const cells = [];
            for (let x = 70; x <= 73; x++) for (let y = 2; y <= 4; y++) {
                const cell = g.level.at(x, y);
                const trap = g.level.traps.find(t => t.tx === x && t.ty === y);
                cells.push({xy: [x,y], terrain: cell.typ, doorMask: cell.doormask || 0,
                    shownTrap: !!glyph_is_trap(glyph_at(x,y)),
                    trap: trap ? {type: trap.ttyp, seen: !!trap.tseen} : null,
                    objects: g.level.objectsAt(x,y).map(object)});
            }
            states.push({step, turn: g.moves, xy: [g.u.ux,g.u.uy], hp: g.u.uhp,
                mortality: g.u.umortality || 0, gameover: !!g.program_state?.gameover,
                blind: !!Blind(), count: g.mkot_trap_warn_count ?? 0,
                weapon: object(g.u.uwep), gloves: object(g.u.uarmg),
                inventory: (g.invent || []).map(object), cells});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const out = structuredClone(outputs(run));
    const texts = out.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    const at = step => states.find(s => s.step === step);
    const start = at(p.start), key = start?.inventory.find(o => o.type === ONAMES.SKELETON_KEY);
    check('producer', 'actual key is acquired and wielded', () => {
        assert.ok(key); assert.equal(key.letter,'b'); assert.equal(key.where,OBJ_INVENT);
        assert.equal(key.count,1); assert.equal(key.blessed,true); assert.equal(key.cursed,false);
        assert.equal(key.artifact,p.artifact ? ART_MASTER_KEY_OF_THIEVERY : 0);
        assert.equal(start.weapon.id,key.id); assert.ok(start.weapon.worn & W_WEP);
    });
    const phases = [];
    for (const q of p.phases) {
        const before = at(q.before), after = at(q.after);
        const messages = [...new Set(texts.slice(q.before+1,q.after+1).map(t => t.split('\n')[0]))];
        const marker = checks.length;
        check('producer', q.name + ': actual location and time', () => {
            assert.ok(before && after); assert.deepEqual(after.xy,q.xy);
            assert.ok(after.turn > before.turn); assert.equal(after.blind,false);
            assert.ok(after.hp > 0 && !after.mortality && !after.gameover);
        });
        check('producer', q.name + ': actual equipment slots', () => {
            if (q.held) { assert.equal(after.weapon.id,key.id); assert.ok(after.weapon.worn & W_WEP); }
            else assert.equal(after.weapon,null);
            if (q.gloves) { assert.equal(after.gloves.type,ONAMES.LEATHER_GLOVES); assert.ok(after.gloves.worn & W_ARMG); }
            else assert.equal(after.gloves,null);
        });
        check('producer', q.name + ': actual hazards and glyph visibility', () => {
            const actual = after.cells.filter(c => c.trap).map(c => ({xy:c.xy,seen:c.trap.seen}));
            const sort = a => [...a].sort((a,b) => a.xy[0]-b.xy[0] || a.xy[1]-b.xy[1]);
            assert.deepEqual(sort(actual),sort(q.traps));
            for (const c of after.cells.filter(c => c.trap)) {
                assert.equal(c.trap.type,ARROW_TRAP);
                const underHero = c.xy[0] === after.xy[0] && c.xy[1] === after.xy[1];
                assert.equal(c.shownTrap,c.trap.seen && !underHero);
            }
            const here = after.cells.find(c => c.xy[0] === q.xy[0] && c.xy[1] === q.xy[1]);
            if (Object.hasOwn(q,'doorTrapped')) {
                assert.equal(here.terrain,DOOR); assert.equal(!!(here.doorMask & D_TRAPPED),q.doorTrapped);
            }
            if (Object.hasOwn(q,'boxesFloor')) {
                const isBox = o => o.type === ONAMES.LARGE_BOX || o.type === ONAMES.CHEST;
                const floor = here.objects.filter(isBox), carried = after.inventory.filter(isBox);
                assert.equal(floor.length,q.boxesFloor); assert.equal(carried.length,q.boxesCarried);
                for (const o of [...floor,...carried]) assert.equal(o.trapped,q.boxesTrapped);
            }
        });
        const producer = checks.slice(marker).every(c => c.pass);
        if (producer) {
            check('source', q.name + ': remembered count', () => assert.equal(after.count,q.count));
            check('source', q.name + ': warning feedback', () => {
                if (q.message) assert.ok(messages.some(t => t.includes(q.message)),q.message);
                else assert.equal(messages.some(t => t.includes('The Key feels')),false);
            });
        }
        phases.push({name:q.name,producer,sourceSkipped:!producer,before,after,messages});
    }
    check('producer','all inputs and output slices complete', () => {
        assert.equal(states.at(-1).step,part.moves.length);
        assert.equal(out.screens.length,part.moves.length+1); assert.deepEqual(out.slices.flat(),out.calls);
        assert.equal(states.length,checkpoints.size);
    });
    const plain = structuredClone(outputs(await runSegment({...part,storage:new InMemoryStorage()})));
    const delayed = await deferred(part);
    check('neutrality','passive observation preserves all five streams', () => assert.deepEqual(out,plain));
    check('neutrality','deferred input preserves all five streams', () => assert.deepEqual(out,delayed));
    rows.push({index,name:part.name,negative:p.negative,checks,phases,start,
        producer:checks.filter(c => c.kind === 'producer').every(c => c.pass),
        source:checks.filter(c => c.kind === 'source').every(c => c.pass),
        outputHashes:hashes(out),statesSHA256:sha(JSON.stringify(states)),
        boundaries:out.screens.length,calls:out.calls.length,frames:out.frames.flat().length});
    console.log(JSON.stringify({index,failed:checks.filter(c => !c.pass),sourceSkipped:phases.filter(q=>q.sourceSkipped).length}));
}
verifyRuntime();
const write = (name,value) => writeFileSync(new URL(name,root),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
write('baseline-observation.json',rows);
write('negative-hashes.json',rows.filter(r=>r.negative).map(r=>({index:r.index,outputHashes:r.outputHashes})));
const checks = rows.flatMap(r=>r.checks);
const summary = {cases:rows.length,setupCases:rows.filter(r=>r.producer).length,
    checksPassed:checks.filter(c=>c.pass).length,checksTotal:checks.length,
    qualifiedPhases:rows.flatMap(r=>r.phases).filter(p=>p.producer).length,
    sourceSkipped:rows.flatMap(r=>r.phases).filter(p=>p.sourceSkipped).length,
    neutrality:checks.filter(c=>c.kind==='neutrality'&&c.pass).length,
    negativeIndexes:[1,3],negativeHashes:10,nativeRecordings:0,runtimeCandidate:false};
write('summary.json',summary); console.log(JSON.stringify(summary));
if (summary.checksPassed !== summary.checksTotal || summary.sourceSkipped) process.exitCode=1;
