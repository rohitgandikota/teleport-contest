// Read-only observations of three unchanged ordinary-input C recordings.
// Run the frozen scorer and rng-slice-gate for complete output/stream equality.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const name = 'long-worm-movement-dispatch';
const bytes = readFileSync(new URL(`./gen-sessions/generated/${name}.session.json`, import.meta.url));
const native = JSON.parse(bytes);
const recipe = JSON.parse(readFileSync(new URL(`./gen-sessions/recipes/${name}.json`, import.meta.url)));
const registry = JSON.parse(readFileSync(new URL('./gen-sessions/coverage-requirements.json', import.meta.url)));
const rawSha256 = createHash('sha256').update(bytes).digest('hex');
const expectedRawHash = 'a59ba99d9eb856d718f073ed3fd292adfe65c002520586447b46d0ff7c925b84';

test('native bytes, input tuples, registered metadata and positive/negative C trace assertions', () => {
    assert.equal(rawSha256, expectedRawHash);
    assert.equal(native.source, 'c'); assert.equal(native.version, 5);
    assert.equal(native.segments.length, 3);
    const fields = ['name','seed','datetime','nethackrc','moves'];
    const tuples = segments => segments.map(segment => fields.map(key => segment[key]));
    assert.deepEqual(tuples(recipe.segments), tuples(native.segments));
    assert.deepEqual(recordingIntegrityErrors(native), []);
    assert.deepEqual(branchAssertionErrors(recipe, native), []);
    const valid = new Set(registry.requirements.map(entry => entry.id));
    assert.ok(recipe.coverage.every(id => valid.has(id)));
    for (const [index, part] of native.segments.entries()) {
        const calls = part.steps.flatMap(step => step.rng);
        assert.equal(calls.length, [2984,2987,2965][index]);
        if (index < 2) {
            assert.ok(calls.some(call => call.includes('@ worm_move(')));
            assert.ok(calls.every(call => !/@ (dog_move|dog_goal)\(/.test(call)),
                'neither adult recording dispatches through pet movement');
        } else {
            assert.ok(calls.some(call => call.includes('@ dog_move(')));
            assert.ok(calls.every(call => !/@ worm_(move|nomove)\(/.test(call)),
                'baby recording never grows or shrinks an adult tail');
        }
    }
});

for (const [index, part] of native.segments.entries()) test(part.name, async () => {
    const states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            assert.equal(g, game, 'observe the live static game binding');
            const monsters = g.level.monsters.filter(mon =>
                mon.mnum === P.PM_LONG_WORM || mon.mnum === P.PM_BABY_LONG_WORM);
            states[step] = {turn:g.moves, mortality:g.u.umortality || 0,
                monsters:monsters.map(mon => {
                    const head = g.worms?.wheads[mon.wormno];
                    const chain = [];
                    for (let seg = g.worms?.wtails[mon.wormno]; seg; seg = seg.nseg)
                        chain.push({at:[seg.wx,seg.wy], owner:g.level.monAt.get(`${seg.wx},${seg.wy}`)?.m_id,
                            hidden:seg === head});
                    return {id:mon.m_id, type:mon.mnum, at:[mon.mx,mon.my], tame:mon.mtame,
                        peaceful:!!mon.mpeaceful, sleeping:!!mon.msleeping, canMove:!!mon.mcanmove,
                        trapped:!!mon.mtrapped, eating:mon.meating || 0, edog:!!mon.edog,
                        slot:mon.wormno || 0, head:head ? [head.wx,head.wy] : null,
                        growth:g.worms?.wgrowtime[mon.wormno] || 0, hp:mon.mhp, chain};
                })};
        }};
        run = await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    assert.equal(states.length, part.steps.length);
    const createdAt = states.findIndex(state => state.monsters.length);
    assert.equal(createdAt, [17,21,22][index]);
    const first = states[createdAt].monsters[0], last = states.at(-1).monsters[0];
    console.log(JSON.stringify({segment:index, rawSha256, createdAt, first, last,
        boundaries:run.getScreens().length, calls:run.getRngLog().length, descriptorRestored:true}));
    assert.deepEqual(first.at, [6,15]);
    assert.equal(first.type, index === 2 ? P.PM_BABY_LONG_WORM : P.PM_LONG_WORM);
    assert.equal(first.tame, index === 1 ? 0 : 5);
    assert.equal(first.edog, index !== 1);
    assert.ok(first.peaceful && first.canMove && !first.sleeping && !first.trapped && !first.eating);
    assert.equal(first.slot > 0, index < 2);
    assert.equal(first.growth, 0);
    assert.ok(states.every(state => state.mortality === 0));
    for (const state of states.slice(createdAt)) {
        assert.equal(state.monsters.length, 1);
        const mon = state.monsters[0];
        assert.equal(mon.id, first.id); assert.equal(mon.type, first.type);
        assert.equal(mon.tame, first.tame); assert.equal(mon.slot, first.slot);
        if (index < 2) {
            assert.deepEqual(mon.head, mon.at, 'hidden head follows the real head at every input boundary');
            assert.equal(mon.chain.at(-1).hidden, true);
            for (const seg of mon.chain) assert.equal(seg.owner, mon.id, 'every tail cell still belongs to this worm');
        } else {
            assert.equal(mon.head, null); assert.deepEqual(mon.chain, []);
        }
    }
    if (index < 2) {
        assert.equal(first.chain.length, 5);
        const growthStep = index === 0 ? 33 : 37;
        const grown = states[growthStep].monsters[0];
        assert.deepEqual(grown.at, [7,15]);
        assert.equal(grown.chain.length, 6);
        // moveloop increments moves after monster movement and before the next input.
        assert.equal(states[growthStep].turn, states[growthStep - 1].turn + 1);
        assert.equal(grown.growth, states[growthStep - 1].turn + (index === 0 ? 5 : 1));
        assert.equal(grown.hp, first.hp + 2, 'C recorded first growth rolls d(2,2)=2');
    }
    assert.deepEqual(last.at, [[8,14],[9,15],[8,14]][index]);
    assert.notDeepEqual(last.at, first.at, 'the ordinary input suffix actually moves each control');
    assert.equal(run.getScreens().length, [43,47,48][index]);
    assert.equal(run.getRngLog().length, [2984,2987,2965][index]);
    assert.deepEqual(run.getCursors(), part.steps.map(step => step.cursor));
    assert.deepEqual(run.getAnimationFramesByStep(), part.steps.map(step => step.animation_frames || []));
});
