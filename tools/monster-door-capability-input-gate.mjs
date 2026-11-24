// Unchanged ordinary-input C witnesses. Observations never write gameplay state.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {nohands, verysmall, amorphous, passes_walls} from '../js/mondata.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {DOOR, D_CLOSED, D_BROKEN, POLY_TRAP, IS_STWALL} from '../js/const.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {decodeScreen} from './gen-sessions/screen-decode.mjs';

const name = 'monster-door-capability-lifetime';
const bytes = readFileSync(new URL(`./gen-sessions/generated/${name}.session.json`,import.meta.url));
const native = JSON.parse(bytes);
const recipe = JSON.parse(readFileSync(new URL(`./gen-sessions/recipes/${name}.json`,import.meta.url)));
const registry = JSON.parse(readFileSync(new URL('./gen-sessions/coverage-requirements.json',import.meta.url)));
const rawSha256 = createHash('sha256').update(bytes).digest('hex');
const expectedRawHash = '7618a02534865d15850231a16dbfcaa622c1d7482c709583f6db5e3da605554a';
const cases = [
    {before:P.PM_BROWN_PUDDING, after:P.PM_HORNED_DEVIL, step:80, boundaries:83, calls:2403},
    {before:P.PM_BLACK_PUDDING, after:P.PM_ORC_ZOMBIE, step:92, boundaries:95, calls:2453},
    {before:P.PM_FOG_CLOUD, after:P.PM_SPOTTED_JELLY, step:86, boundaries:89, calls:2451},
];

test('native bytes, all five input fields, registered metadata and C assertions', () => {
    assert.equal(rawSha256,expectedRawHash);
    assert.equal(native.source,'c'); assert.equal(native.version,5);
    assert.equal(native.segments.length,3);
    const fields = ['name','seed','datetime','nethackrc','moves'];
    const tuples = segments => segments.map(s=>fields.map(key=>s[key]));
    assert.deepEqual(tuples(recipe.segments),tuples(native.segments));
    assert.deepEqual(recordingIntegrityErrors(native),[]);
    assert.deepEqual(branchAssertionErrors(recipe,native),[]);
    const valid = new Set(registry.requirements.map(entry=>entry.id));
    assert.ok(recipe.coverage.every(id=>valid.has(id)));
    for (const [index,part] of native.segments.entries()) {
        assert.equal(part.steps.length,cases[index].boundaries);
        assert.equal(part.steps.flatMap(step=>step.rng).length,cases[index].calls);
        assert.ok(part.steps.every(step=>!(step.animation_frames || []).length));
    }
});

for (const [index,part] of native.segments.entries()) test(part.name,async () => {
    const spec = cases[index], states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step:'*',cb(g,step) {
            assert.equal(g,game,'observe the live static game binding');
            const door = g.level.at(39,5);
            states[step] = {hero:[g.u.ux,g.u.uy],mortality:g.u.umortality || 0,
                door:{typ:door.typ,mask:door.doormask},
                walls:[g.level.at(39,4).typ,g.level.at(39,6).typ],
                polyTrap:g.level.traps.some(t=>t.ttyp===POLY_TRAP && t.tx===39 && t.ty===5),
                message:g.nhDisplay.grid[0].map(cell=>cell.ch).join('').trimEnd(),
                monsters:g.level.monsters.map(mon=>({id:mon.m_id,type:mon.mnum,at:[mon.mx,mon.my],
                    tame:mon.mtame,peaceful:!!mon.mpeaceful,sleeping:!!mon.msleeping,
                    canMove:!!mon.mcanmove,trapped:!!mon.mtrapped,eating:mon.meating || 0,
                    canOpen:!(nohands(mon.data) || verysmall(mon.data)),
                    amorphous:amorphous(mon.data),passesWalls:passes_walls(mon.data),
                    inventory:(mon.minvent || []).map(obj=>obj.otyp)}))};
        }};
        run = await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    assert.equal(states.length,spec.boundaries);
    const before = states[spec.step-1], arrived = states[spec.step];
    const old = before.monsters.find(mon=>mon.type===spec.before);
    assert.ok(old,'ordinary Ctrl-G actually created the old form');
    const changed = arrived.monsters.find(mon=>mon.id===old.id);
    console.log(JSON.stringify({segment:index,rawSha256,old,changed,
        beforeDoor:before.door,arrivalDoor:arrived.door,message:states[spec.step+1].message,
        boundaries:run.getScreens().length,calls:run.getRngLog().length,descriptorRestored:true}));
    assert.deepEqual(before.hero,[38,5]); assert.deepEqual(old.at,[40,5]);
    assert.equal(old.tame,0); assert.equal(old.peaceful,false);
    assert.ok(old.canMove && !old.sleeping && !old.trapped && !old.eating);
    assert.deepEqual(old.inventory,[]); assert.equal(old.canOpen,false);
    assert.equal(old.amorphous,true); assert.equal(old.passesWalls,false);
    assert.ok(before.polyTrap && arrived.polyTrap);
    assert.ok(before.walls.every(typ=>IS_STWALL(typ)));
    assert.deepEqual(before.door,{typ:DOOR,mask:D_CLOSED});
    assert.equal(changed.type,spec.after); assert.deepEqual(changed.at,[39,5]);
    assert.equal(changed.canOpen,index<2); assert.equal(changed.amorphous,index===2);
    assert.equal(changed.passesWalls,false);
    for (const state of states.slice(spec.step)) {
        assert.deepEqual(state.door,{typ:DOOR,mask:index<2 ? D_BROKEN : D_CLOSED});
        const same = state.monsters.find(mon=>mon.id===old.id);
        assert.equal(same.type,spec.after);
    }
    assert.equal(states[spec.step+1].message,decodeScreen(part.steps[spec.step+1].screen)[0].trimEnd());
    assert.ok(states.every(state=>state.mortality===0));
    assert.equal(run.getScreens().length,spec.boundaries);
    assert.equal(run.getRngLog().length,spec.calls);
    assert.deepEqual(run.getCursors(),part.steps.map(step=>step.cursor));
    assert.deepEqual(run.getAnimationFramesByStep(),part.steps.map(step=>step.animation_frames || []));
});
