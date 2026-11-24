// Read-only actual-input reach and native C provenance. Score parity separately.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Flying, Levitation, Swimming, Amphibious, Breathless, Wwalking,
    Passes_walls, Invis, Hallucination} from '../js/youprop.js';
import {in_rooms} from '../js/hack.js';
import {helpless} from '../js/monst.js';
import {ONAMES} from '../js/objects_data.js';
import {POOL, DOOR, D_NODOOR, W_AMUL, OBJ_FLOOR, SHOPBASE} from '../js/const.js';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type:'json'};

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/shop-door-pool-crawl.json', import.meta.url)));
const inputBytes = readFileSync(new URL('gen-sessions/generated/shop-door-pool-crawl.session.json', import.meta.url));
const input = JSON.parse(inputBytes);
test('unchanged source:c/v5 native cases match the recipe and asserted branches', () => {
    assert.equal(input.version, 5);
    assert.equal(input.source, 'c');
    assert.equal(createHash('sha256').update(inputBytes).digest('hex'),
        '8979a3bb91e9b94965d386287d4da396bc9378054ee242054ce38b8c46ba5acc');
    assert.equal(recipe.name, 'shop-door-pool-crawl');
    assert.equal(input.segments.length, 2);
    assert.equal(recipe.segments.length, 2);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    const valid = new Set(tags.requirements.map(t => t.id));
    for (const tag of recipe.coverage) assert.ok(valid.has(tag), tag);
    for (const [i, part] of input.segments.entries()) {
        assert.equal(part.steps.length, [169, 173][i]);
        for (const key of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
            assert.deepEqual(part[key], recipe.segments[i][key]);
    }
    assert.deepEqual(recordingIntegrityErrors(input), []);
    assert.deepEqual(branchAssertionErrors(recipe, input), []);
});

for (const [index, part] of recipe.segments.entries()) test(part.name, async () => {
    const states = [], previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const object = o => ({id:o.o_id, type:o.otyp, mask:o.owornmask || 0,
        where:o.where, x:o.ox, y:o.oy, weight:o.owt, inUse:!!o.in_use,
        howLost:o.how_lost ?? null, unpaid:!!o.unpaid});
    try {
        globalThis.__step_snapshot = {step:'*', cb(g, step) {
            const owner = g.level.monsters.find(m => m.isshk
                && m.eshk.shd.x === 29 && m.eshk.shd.y === 5);
            const roomno = owner?.eshk.shoproom;
            const offsetRoom = g.level.rooms[roomno]
                || g.level.subrooms?.find(r => r.roomnoidx === roomno);
            states.push({step, x:g.u.ux, y:g.u.uy, hp:g.u.uhp,
                mortality:g.u.umortality || 0, gameover:!!g.program_state?.gameover,
                terrain:g.level.at(g.u.ux, g.u.uy).typ,
                initialDon:!!g.initial_don, dressing:!!g.afternmv,
                amulet:g.u.uamul?.o_id ?? null,
                flying:Flying(), levitation:Levitation(), swimming:Swimming(),
                amphibious:Amphibious(), breathless:Breathless(), walking:Wwalking(),
                phasing:Passes_walls(), invis:Invis(), hallucination:Hallucination(),
                intrinsicFlight:g.u.intrinsic?.HFlying || 0,
                flightMask:g.u.uprops?.FLYING || 0,
                shops:g.u.ushops, doorRooms:in_rooms(29, 5, SHOPBASE),
                offsetType:offsetRoom?.rtype,
                door:{typ:g.level.at(29, 5).typ, mask:g.level.at(29, 5).doormask},
                owner:owner && {id:owner.m_id, x:owner.mx, y:owner.my,
                    post:{...owner.eshk.shk}, entrance:{...owner.eshk.shd},
                    room:roomno, helpless:helpless(owner),
                    bill:owner.eshk.billct, debit:owner.eshk.debit, robbed:owner.eshk.robbed},
                inventory:g.invent.map(object), floor:g.level.objects.map(object),
                text:g.nhDisplay.grid.map(row => row.map(c => c.ch).join('').trimEnd()).join('\n')});
        }};
        await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    const ready = states.findLast(s => s.amulet && s.terrain === POOL);
    const cleared = states.find(s => ready && s.step > ready.step && !s.amulet);
    const escaped = states.find(s => cleared && s.step > cleared.step && s.terrain !== POOL);
    const last = states.at(-1);
    assert.ok(ready && cleared && escaped, 'worn pool, real removal, then a healthy crawl');
    assert.deepEqual([ready.x, ready.y], [30, 6]);
    const amulet = ready.inventory.find(o => o.id === ready.amulet);
    assert.equal(amulet.type, ONAMES.AMULET_OF_FLYING);
    assert.equal(amulet.mask, W_AMUL);
    assert.equal(ready.flightMask, W_AMUL);
    assert.equal(ready.flying, true);
    assert.equal(ready.initialDon, false);
    assert.equal(ready.dressing, false);
    assert.equal(cleared.terrain, POOL);
    assert.equal(cleared.flying, false);
    assert.equal(cleared.flightMask, 0);
    const removed = cleared.inventory.find(o => o.id === amulet.id);
    assert.equal(removed.mask, 0);
    assert.equal(removed.inUse, false);
    assert.equal(removed.weight, amulet.weight);
    assert.equal(removed.howLost, amulet.howLost);
    const boulder = ready.floor.find(o => o.type === ONAMES.BOULDER && o.x === 31 && o.y === 5);
    assert.ok(boulder, 'a real wished-and-dropped boulder excludes the first interior diagonal');
    assert.equal(boulder.where, OBJ_FLOOR);
    assert.equal(boulder.inUse, false);
    for (const s of states) {
        assert.ok(s.hp > 0 && !s.mortality && !s.gameover, 'no Wizard death refusal');
        assert.ok(!s.levitation && !s.swimming && !s.amphibious && !s.breathless
            && !s.walking && !s.phasing && !s.intrinsicFlight && !s.invis && !s.hallucination);
    }
    assert.equal(last.hp, ready.hp);
    assert.equal(last.amulet, null);
    assert.equal(last.flying, false);
    assert.deepEqual([last.x, last.y], [escaped.x, escaped.y]);
    if (!index) {
        assert.equal(ready.door.typ, DOOR);
        assert.equal(ready.door.mask, D_NODOOR);
        assert.equal(ready.shops.charCodeAt(0), ready.owner.room);
        assert.equal(ready.doorRooms.charCodeAt(0), ready.owner.room);
        assert.ok(ready.offsetType >= SHOPBASE, 'C offset IS_SHOP guard is reached');
        assert.deepEqual([ready.owner.x, ready.owner.y], [ready.owner.post.x, ready.owner.post.y]);
        assert.equal(ready.owner.helpless, false);
        assert.deepEqual([ready.owner.bill, ready.owner.debit, ready.owner.robbed], [1, 0, 0]);
        const stock = ready.inventory.find(o => o.unpaid);
        assert.equal(stock.type, ONAMES.FORTUNE_COOKIE);
        assert.ok(last.inventory.some(o => o.id === stock.id && o.unpaid));
        assert.equal(last.owner.bill, 1);
        const feedback = states.find(s => s.step > cleared.step
            && s.text.includes('Samoe blocks your way!'));
        assert.ok(feedback && feedback.step < escaped.step, 'feedback completes before selecting an exit');
        assert.deepEqual([feedback.x, feedback.y], [ready.x, ready.y]);
        assert.deepEqual([escaped.x, escaped.y], [31, 6]);
    } else {
        assert.deepEqual([ready.owner.bill, ready.owner.debit, ready.owner.robbed], [0, 0, 0]);
        assert.ok(!ready.inventory.some(o => o.unpaid));
        // The keeper also leaves his post. This is a continuation control;
        // the source gate separately isolates the empty-bill predicate.
        assert.notDeepEqual([ready.owner.x, ready.owner.y], [ready.owner.post.x, ready.owner.post.y]);
        assert.deepEqual([escaped.x, escaped.y], [30, 5]);
    }
    const observed = {segments:recipe.segments.map((_, i) =>
        ({steps:i === index ? states.map(s => ({screen:s.text})) : []}))};
    assert.deepEqual(branchAssertionErrors({...recipe, branches:[recipe.branches[index]],
        branchAssertions:[recipe.branchAssertions[index]]}, observed), []);
});
