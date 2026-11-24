// Constructed source controls built on a real Minetown shop and real billing.
// C shk.c:5791-5821 and hack.c:4079-4101. No mocked production functions.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {crawl_destination, in_rooms, move_update} from '../js/hack.js';
import {block_door, costly_gold, setpaid} from '../js/shk.js';
import {dropx} from '../js/do.js';
import {rloc_to} from '../js/teleport.js';
import {polymon} from '../js/polyself.js';
import {make_blinded, make_hallucinated} from '../js/potion.js';
import {addinv} from '../js/invent.js';
import {mksobj} from '../js/mkobj.js';
import {setworn} from '../js/worn.js';
import {Ring_on} from '../js/do_wear.js';
import {Invis, Blind, Hallucination, Passes_walls} from '../js/youprop.js';
import {pline} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {resetInputState} from '../js/input.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {SHOPBASE, D_ISOPEN, D_NODOOR, OROOM, W_RINGL} from '../js/const.js';
import {seed, clearMessages, messages} from './status-followup-test-setup.mjs';

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/shop-door-block.json', import.meta.url)));
async function setup() {
    const run = await runSegment({...recipe.segments[0], storage:new InMemoryStorage()});
    let reads = 0;
    run._display.onEmptyQueue = () => {
        if (++reads > 40) throw Error('unexpected repeated input');
        return 32;
    };
    game._preNhgetchHook = null; resetInputState();
    const roomno = game.u.ushops.charCodeAt(0);
    const owner = game.level.monsters.find(m => m.isshk && m.eshk.shoproom === roomno);
    const door = {...owner.eshk.shd};
    const offsetRoom = game.level.rooms[roomno]
        || game.level.subrooms.find(r => r.roomnoidx === roomno);
    assert.ok(offsetRoom.rtype >= SHOPBASE, 'retain C IS_SHOP(roomno) offset quirk');
    assert.equal(in_rooms(door.x, door.y, SHOPBASE).charCodeAt(0), roomno);
    assert.deepEqual([owner.mx, owner.my], [owner.eshk.shk.x, owner.eshk.shk.y]);
    assert.equal(owner.eshk.billct, 1);
    assert.equal(game.level.at(door.x, door.y).doormask, D_NODOOR);
    assert.ok(game.invent.some(o => o.unpaid));
    clearMessages(); seed(711);
    return {run, owner, door, offsetRoom};
}

async function blocked(door) {
    // The independently existing real helper is the message/RNG oracle.
    // C calls it exactly once here, including Shknam's overridden fallback.
    seed(711); clearMessages();
    assert.equal(await block_door(door.x, door.y), true);
    const expectedText = messages(), expectedRng = [...getRngLog()];
    assert.ok(expectedText.includes('blocks your way!'));
    seed(711); clearMessages();
    assert.equal(await crawl_destination(door.x, door.y), false);
    assert.equal(messages(), expectedText);
    assert.deepEqual(getRngLog(), expectedRng);
    return expectedRng;
}

async function unblocked(door) {
    seed(711); clearMessages();
    assert.equal(await block_door(door.x, door.y), false);
    assert.equal(await crawl_destination(door.x, door.y), true);
    assert.equal(messages(), '');
    assert.deepEqual(getRngLog(), []);
}

test('actual picked-up stock blocks the diagonal with the real keeper name', async () => {
    const {owner, door} = await setup();
    assert.equal(owner.eshk.debit, 0); assert.equal(owner.eshk.robbed, 0);
    assert.deepEqual(await blocked(door), []);
});

test('returning actual unpaid stock clears the bill and allows the doorway', async () => {
    const {owner, door} = await setup();
    const stock = game.invent.find(o => o.unpaid);
    await dropx(stock);
    assert.equal(owner.eshk.billct, 0);
    assert.ok(!stock.unpaid && !game.invent.includes(stock));
    await unblocked(door);
});

test('real costly_gold producer blocks on debit with an empty item bill', async () => {
    const {owner, door} = await setup();
    await dropx(game.invent.find(o => o.unpaid));
    await costly_gold(game.u.ux, game.u.uy, 10, true);
    assert.equal(owner.eshk.billct, 0);
    assert.equal(owner.eshk.debit, 10);
    assert.equal(owner.eshk.loan, 10);
    assert.deepEqual(await blocked(door), []);
});

test('source-only robbed balance blocks with no item bill or debit', async () => {
    const {owner, door} = await setup();
    setpaid(owner); owner.eshk.robbed = 17;
    assert.equal(owner.eshk.billct, 0); assert.equal(owner.eshk.debit, 0);
    await blocked(door);
});

test('real invisibility ring adds the C motion-sensing wording', async () => {
    const {door} = await setup();
    const ring = await addinv(mksobj(ONAMES.RIN_INVISIBILITY, false, false));
    setworn(ring, W_RINGL); await Ring_on(ring);
    assert.equal(Invis(), true);
    await blocked(door);
    assert.ok(messages().includes(' senses your motion and blocks your way!'));
});

test('blindness does not hide the named blocking feedback', async () => {
    const {door} = await setup();
    await make_blinded(20, false); assert.equal(Blind(), true);
    assert.deepEqual(await blocked(door), []);
});

test('active hallucination preserves the real name helper and all its draws', async () => {
    const {door} = await setup();
    await make_hallucinated(20, false); assert.equal(Hallucination(), true);
    const rng = await blocked(door);
    assert.ok(rng.length >= 2, 'C shkname samples shop type and name');
});

for (const [label, change] of [
    ['sleeping keeper', owner => { owner.msleeping = 1; }],
    ['immobile keeper', owner => { owner.mcanmove = 0; }],
]) test(`${label} cannot block`, async () => {
    const {owner, door} = await setup(); change(owner);
    await unblocked(door);
});

test('source-only frozen counter does not imply helpless when still mobile', async () => {
    const {owner, door} = await setup();
    owner.mfrozen = 7; owner.mcanmove = 1;
    await blocked(door);
});

test('real monster relocation away from the post permits escape', async () => {
    const {owner, door} = await setup();
    await rloc_to(owner, game.u.ux + 1, game.u.uy - 1);
    assert.notDeepEqual([owner.mx, owner.my], [owner.eshk.shk.x, owner.eshk.shk.y]);
    await unblocked(door);
});

test('C offset-room rejection is retained even though this is a real shop', async () => {
    const {door, offsetRoom} = await setup(); offsetRoom.rtype = OROOM;
    assert.ok(in_rooms(door.x, door.y, SHOPBASE).length);
    await unblocked(door);
});

test('actual room tracking outside the shop defeats the owner guard', async () => {
    const {door} = await setup();
    game.u.ux = door.x - 1; game.u.uy = door.y + 1;
    move_update(false); assert.equal(game.u.ushops, '');
    await unblocked(door);
});

test('a different recorded entrance is not blocked by this keeper', async () => {
    const {owner, door} = await setup(); owner.eshk.shd = {x:door.x, y:door.y - 1};
    await unblocked(door);
});

test('an intact open door rejects the diagonal before naming the keeper', async () => {
    const {door} = await setup();
    game.level.at(door.x, door.y).doormask = D_ISOPEN;
    clearMessages(); seed(711);
    assert.equal(await crawl_destination(door.x, door.y), false);
    assert.equal(messages(), ''); assert.deepEqual(getRngLog(), []);
});

for (const [name, form, expected] of [
    ['grid bug', PMNAMES.PM_GRID_BUG, false],
    ['xorn', PMNAMES.PM_XORN, true],
]) test(`${name} short-circuits before the shop helper`, async () => {
    const {door} = await setup(); await polymon(form);
    assert.equal(Passes_walls(), name === 'xorn');
    clearMessages(); seed(711);
    assert.equal(await crawl_destination(door.x, door.y), expected);
    assert.equal(messages(), ''); assert.deepEqual(getRngLog(), []);
});

test('blocking feedback completes before the rejected destination resolves', async () => {
    const {run, door} = await setup();
    await pline('A'.repeat(72));
    let release, began;
    const input = new Promise(resolve => { began = resolve; });
    const prior = run._display.onEmptyQueue;
    run._display.onEmptyQueue = () => new Promise(resolve => { release = resolve; began(true); });
    let completed = false;
    const operation = crawl_destination(door.x, door.y).then(value => {
        completed = true; return value;
    });
    try {
        const pending = await Promise.race([input, operation.then(() => false)]);
        assert.equal(pending, true);
        assert.equal(completed, false);
        release(32);
        assert.equal(await operation, false);
        assert.ok(messages().includes('blocks your way!'));
    } finally {
        run._display.onEmptyQueue = prior;
        if (release) release(32);
        await operation;
    }
});
