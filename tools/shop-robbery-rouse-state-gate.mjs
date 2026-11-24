// C shk.c:687-719, 1381-1393. Real generated shop, stock and status helpers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {u_left_shop, remote_burglary, rouse_shk, costly_gold} from '../js/shk.js';
import {sleep_monst} from '../js/mhitm.js';
import {paralyze_monst, make_blinded, make_deaf, make_hallucinated} from '../js/potion.js';
import {currency} from '../js/invent.js';
import {dropx} from '../js/do.js';
import {pline, canspotmon} from '../js/display.js';
import {Blind, Deaf, Hallucination} from '../js/youprop.js';
import {ONAMES} from '../js/objects_data.js';
import {getRngLog} from '../js/rng.js';
import {resetInputState} from '../js/input.js';
import {seed, clearMessages, messages} from './status-followup-test-setup.mjs';

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/shop-door-block.json', import.meta.url)));
async function setup(credit = true) {
    const run = await runSegment({...recipe.segments[0], storage:new InMemoryStorage()});
    let reads = 0;
    run._display.onEmptyQueue = () => {
        if (++reads > 50) throw Error('unexpected repeated input');
        return 32;
    };
    game._preNhgetchHook = null; resetInputState();
    const shop = game.u.ushops.charAt(0);
    const owner = game.level.monsters.find(m => m.isshk && m.eshk.shoproom === shop.charCodeAt(0));
    const stock = game.invent.find(o => o.unpaid);
    assert.equal(owner.eshk.billct, 1);
    assert.equal(stock.otyp, ONAMES.FORTUNE_COOKIE);
    assert.ok(canspotmon(owner));
    if (credit) {
        const gold = game.invent.find(o => o.otyp === ONAMES.GOLD_PIECE);
        const amount = gold.quan;
        await dropx(gold);
        assert.equal(owner.eshk.credit, amount);
        assert.ok(owner.eshk.credit > owner.eshk.bill_p[0].price);
        assert.equal(owner.eshk.billct, 1);
    }
    clearMessages(); seed(711);
    return {run, owner, stock, shop, credit:owner.eshk.credit};
}
async function asleep(owner) {
    assert.equal(await sleep_monst(owner, 0, -1), 1);
    assert.equal(owner.msleeping, 1);
}
function recovered(owner) {
    assert.equal(owner.msleeping || 0, 0);
    assert.equal(owner.mfrozen || 0, 0);
    assert.equal(owner.mcanmove, 1);
}
function paid(owner, stock) {
    assert.deepEqual([owner.eshk.billct, owner.eshk.credit, owner.eshk.debit, owner.eshk.loan], [0, 0, 0, 0]);
    assert.ok(!stock.unpaid && game.invent.includes(stock));
    assert.equal(owner.eshk.robbed, 0);
    assert.equal(owner.mpeaceful, 1);
    assert.ok(!owner.eshk.following);
    assert.ok(!messages().includes('stole') && !messages().includes('alarm'));
}

for (const kind of ['sleeping', 'paralyzed', 'both']) test(`${kind} keeper recovers before credit settlement`, async () => {
    const {owner, stock, shop, credit} = await setup();
    if (kind !== 'paralyzed') await asleep(owner);
    if (kind !== 'sleeping') paralyze_monst(owner, 27);
    clearMessages(); seed(711);
    await u_left_shop(shop, false);
    recovered(owner); paid(owner, stock);
    const wake = kind === 'paralyzed' ? 'Samoe can move again.' : 'Samoe wakes up.';
    assert.ok(messages().trimStart().startsWith(wake));
    assert.ok(messages().includes(`Your credit of ${credit} zorkmids is used to cover your shopping bill.`));
    assert.deepEqual(getRngLog(), []);
});

test('an already awake keeper settles without wake feedback or RNG', async () => {
    const {owner, stock, shop} = await setup();
    await u_left_shop(shop, false);
    assert.ok(owner.mcanmove); paid(owner, stock);
    assert.ok(!messages().includes('wakes up') && !messages().includes('can move again'));
    assert.deepEqual(getRngLog(), []);
});

test('source-only frozen counter with mobility is not helpless', async () => {
    const {owner, stock, shop} = await setup();
    owner.mfrozen = 7; owner.mcanmove = 1;
    await u_left_shop(shop, false);
    assert.equal(owner.mfrozen, 7); paid(owner, stock);
    assert.ok(!messages().includes('can move again'));
    assert.deepEqual(getRngLog(), []);
});

test('unseen sleeping keeper recovers silently', async () => {
    const {owner, stock, shop} = await setup();
    await make_blinded(20, false); assert.equal(Blind(), true);
    assert.equal(canspotmon(owner), false);
    await asleep(owner); clearMessages(); seed(711);
    await u_left_shop(shop, false);
    recovered(owner); paid(owner, stock);
    assert.ok(!messages().includes('wakes up'));
    assert.deepEqual(getRngLog(), []);
});

test('deafness does not suppress visible recovery feedback', async () => {
    const {owner, stock, shop} = await setup();
    await make_deaf(20, false); assert.equal(Deaf(), true);
    paralyze_monst(owner, 27); clearMessages(); seed(711);
    await u_left_shop(shop, false);
    recovered(owner); paid(owner, stock);
    assert.ok(messages().trimStart().startsWith('Samoe can move again.'));
    assert.deepEqual(getRngLog(), []);
});

test('hallucinated recovery retains the real name helper and its main draws', async () => {
    const {owner, stock, shop, credit} = await setup();
    await make_hallucinated(20, false); assert.equal(Hallucination(), true);
    await asleep(owner); clearMessages(); seed(711);
    await rouse_shk(owner, true);
    const expectedText = messages();
    const expectedCurrency = currency(credit);
    const expectedRng = [...getRngLog()];
    assert.ok(expectedText.includes('wakes up.') && expectedRng.length >= 3);
    await asleep(owner); clearMessages(); seed(711);
    await u_left_shop(shop, false);
    recovered(owner); paid(owner, stock);
    assert.ok(messages().trimStart().startsWith(expectedText.trimStart()));
    assert.ok(messages().includes(`Your credit of ${credit} ${expectedCurrency} is used to cover your shopping bill.`));
    assert.deepEqual(getRngLog(), expectedRng);
    // Full credit returns before C's separate robbery chronicle naming call.
});

test('actual returned stock excludes recovery when no debt remains', async () => {
    const {owner, stock, shop} = await setup(false);
    await dropx(stock); assert.equal(owner.eshk.billct, 0);
    paralyze_monst(owner, 27); clearMessages(); seed(711);
    await u_left_shop(shop, false);
    assert.equal(owner.mcanmove, 0); assert.equal(owner.mfrozen, 27);
    assert.equal(messages(), ''); assert.deepEqual(getRngLog(), []);
});

test('remote burglary also awaits recovery when credit covers the item', async () => {
    const {owner, stock} = await setup();
    paralyze_monst(owner, 27); clearMessages(); seed(711);
    await remote_burglary(game.u.ux, game.u.uy);
    recovered(owner); paid(owner, stock);
    assert.ok(messages().trimStart().startsWith('Samoe can move again.'));
    assert.deepEqual(getRngLog(), []);
});

test('remote debit-only settlement uses the real gold-debt producer', async () => {
    const {owner, stock} = await setup(false);
    await dropx(stock);
    await costly_gold(game.u.ux, game.u.uy, 10, true);
    assert.equal(owner.eshk.debit, 10); assert.equal(owner.eshk.billct, 0);
    // Constructed pre-existing account credit, while debit/loan are real.
    owner.eshk.credit = 10;
    await asleep(owner); clearMessages(); seed(711);
    await remote_burglary(game.u.ux, game.u.uy);
    recovered(owner);
    assert.deepEqual([owner.eshk.debit, owner.eshk.loan, owner.eshk.credit], [0, 0, 0]);
    assert.ok(messages().trimStart().startsWith('Samoe wakes up.'));
    assert.deepEqual(getRngLog(), []);
});

test('remote burglary with no bill or debit does not wake the keeper', async () => {
    const {owner, stock} = await setup(false);
    await dropx(stock); await asleep(owner); clearMessages(); seed(711);
    await remote_burglary(game.u.ux, game.u.uy);
    assert.equal(owner.msleeping, 1);
    assert.equal(messages(), ''); assert.deepEqual(getRngLog(), []);
});

test('source-only off-level owner is rejected before recovery or billing', async () => {
    const {owner, shop, credit} = await setup();
    await asleep(owner); owner.eshk.shoplevel = {dnum:99, dlevel:1};
    clearMessages(); seed(711);
    await u_left_shop(shop, true);
    await remote_burglary(game.u.ux, game.u.uy);
    assert.equal(owner.msleeping, 1);
    assert.equal(owner.eshk.credit, credit); assert.equal(owner.eshk.billct, 1);
    assert.equal(messages(), ''); assert.deepEqual(getRngLog(), []);
});

test('ordinary interior movement is rejected by the leaving guard', async () => {
    const {owner, credit} = await setup();
    paralyze_monst(owner, 27);
    assert.ok(!game.level.at(game.u.ux, game.u.uy).edge);
    await u_left_shop('', false);
    assert.equal(owner.mcanmove, 0); assert.equal(owner.mfrozen, 27);
    assert.equal(owner.eshk.billct, 1); assert.equal(owner.eshk.credit, credit);
    assert.equal(messages(), ''); assert.deepEqual(getRngLog(), []);
});

test('an awake boundary warning does not settle the bill', async () => {
    const {owner, credit} = await setup();
    game.u.ux0 = game.u.ux; game.u.uy0 = game.u.uy;
    game.u.ux = owner.eshk.shd.x; game.u.uy = owner.eshk.shd.y;
    game.u.ushops0 = game.u.ushops;
    await u_left_shop('', false);
    assert.ok(messages().includes('Please pay before leaving.'));
    assert.equal(owner.eshk.billct, 1); assert.equal(owner.eshk.credit, credit);
    assert.deepEqual(getRngLog(), []);
});

test('a helpless boundary reaches recovery instead of the spoken warning', async () => {
    const {owner, stock} = await setup();
    game.u.ux0 = game.u.ux; game.u.uy0 = game.u.uy;
    game.u.ux = owner.eshk.shd.x; game.u.uy = owner.eshk.shd.y;
    game.u.ushops0 = game.u.ushops;
    paralyze_monst(owner, 27);
    await u_left_shop('', false);
    recovered(owner); paid(owner, stock);
    assert.ok(messages().trimStart().startsWith('Samoe can move again.'));
    assert.ok(!messages().includes('Please pay'));
    assert.deepEqual(getRngLog(), []);
});

test('recovery feedback stays pending before status and account mutations', async () => {
    const {run, owner, stock, shop, credit} = await setup();
    paralyze_monst(owner, 27); await pline('A'.repeat(72));
    const releases = [], ready = [];
    const inputs = [0, 1].map(i => new Promise(resolve => { ready[i] = resolve; }));
    const prior = run._display.onEmptyQueue;
    let reads = 0, completed = false;
    run._display.onEmptyQueue = () => {
        const i = reads++;
        if (i > 1) return 32;
        return new Promise(resolve => { releases[i] = resolve; ready[i](true); });
    };
    const operation = u_left_shop(shop, false).then(() => { completed = true; });
    try {
        assert.equal(await Promise.race([inputs[0], operation.then(() => false)]), true);
        assert.equal(completed, false);
        assert.equal(owner.mcanmove, 0); assert.equal(owner.mfrozen, 27);
        assert.equal(owner.eshk.billct, 1); assert.equal(owner.eshk.credit, credit);
        releases[0](32);
        assert.equal(await Promise.race([inputs[1], operation.then(() => false)]), true);
        assert.equal(completed, false);
        recovered(owner);
        assert.equal(owner.eshk.billct, 1); assert.equal(owner.eshk.credit, credit);
        assert.ok(game._toplines.includes('Samoe can move again.'));
    } finally {
        run._display.onEmptyQueue = prior;
        for (const release of releases) release(32);
        await operation;
    }
    paid(owner, stock);
});

test('actual robbery matches the awake route after recovery, including RNG', async () => {
    async function finish(paralyzed) {
        const {owner, stock, shop} = await setup(false);
        const amount = owner.eshk.bill_p.reduce((sum, bill) => sum + bill.price * bill.bquan, 0);
        if (paralyzed) paralyze_monst(owner, 27);
        clearMessages(); seed(711);
        await u_left_shop(shop, false);
        assert.ok(owner.mcanmove);
        assert.equal(owner.mfrozen || 0, 0);
        assert.equal(owner.eshk.robbed, amount);
        assert.equal(owner.eshk.billct, 0); assert.ok(!stock.unpaid);
        assert.equal(owner.eshk.following, 1); assert.equal(owner.mpeaceful, 0);
        assert.ok(messages().includes('You escaped the shop without paying!'));
        return {rng:[...getRngLog()], amount, object:stock.o_id,
            monsters:game.level.monsters.map(m => [m.mnum, m.mx, m.my])};
    }
    const awake = await finish(false), recoveredRoute = await finish(true);
    assert.deepEqual(recoveredRoute, awake);
    // This compares the insertion's effect, not completeness of call_kops.
});
