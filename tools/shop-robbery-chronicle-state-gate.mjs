// Public-caller controls for C shk.c:579-719. The real alarm runs to completion.
// Exact private return values and pre-alarm RNG remain separate sealed evidence.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {u_left_shop, remote_burglary, costly_gold} from '../js/shk.js';
import {currency} from '../js/invent.js';
import {shkname, shtypes} from '../js/shknam.js';
import {s_suffix} from '../js/hacklib.js';
import {splitobj} from '../js/mkobj.js';
import {dropx} from '../js/do.js';
import {make_hallucinated, make_blinded} from '../js/potion.js';
import {Hallucination} from '../js/youprop.js';
import {pline} from '../js/display.js';
import {resetInputState} from '../js/input.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {SHOPBASE, LL_ACHIEVE, W_WEP} from '../js/const.js';
import {ONAMES} from '../js/objects_data.js';
import {clearMessages, messages} from './status-followup-test-setup.mjs';

import recipe from './gen-sessions/recipes/shop-door-block.json' with {type:'json'};
function resetRng() {
    initRng(711); game.dispCtx = null; enableRngLog();
}
async function setup(t) {
    const prior = Object.getOwnPropertyDescriptor(globalThis, '__rng_log_disp');
    globalThis.__rng_log_disp = true;
    t.after(() => {
        if (prior) Object.defineProperty(globalThis, '__rng_log_disp', prior);
        else delete globalThis.__rng_log_disp;
    });
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
    const billed = owner.eshk.bill_p.reduce((n,b) => n + b.price * b.bquan,0);
    assert.equal(owner.eshk.billct,1); assert.equal(stock.otyp,ONAMES.FORTUNE_COOKIE);
    assert.ok(billed > 2 && !owner.eshk.debit && owner.mcanmove);
    clearMessages(); resetRng();
    return {run,shop,owner,stock,billed};
}
async function deposit(amount) {
    const gold = game.invent.find(o => o.otyp === ONAMES.GOLD_PIECE);
    assert.ok(amount > 0 && gold.quan >= amount);
    await dropx(amount === gold.quan ? gold : splitobj(gold,amount));
}
async function leave(ctx,remote = false) {
    const prefix = structuredClone(game.gamelog), turn = game.moves;
    const previous = ctx.owner.eshk.robbed || 0;
    const amount = ctx.billed + ctx.owner.eshk.debit - ctx.owner.eshk.credit;
    clearMessages(); resetRng();
    if (remote) await remote_burglary(game.u.ux,game.u.uy);
    else await u_left_shop(ctx.shop,true);
    assert.equal(game.gamelog.length,prefix.length + 1);
    assert.deepEqual(game.gamelog.slice(0,-1),prefix);
    const entry = game.gamelog.at(-1);
    assert.equal(entry.flags,LL_ACHIEVE); assert.equal(entry.turn,turn);
    assert.equal(ctx.owner.eshk.robbed,previous + amount);
    assert.deepEqual([ctx.owner.eshk.billct,ctx.owner.eshk.debit,
        ctx.owner.eshk.credit,ctx.owner.eshk.loan],[0,0,0,0]);
    assert.ok(game.invent.includes(ctx.stock) && !ctx.stock.unpaid);
    assert.equal(ctx.owner.eshk.following,1); assert.equal(ctx.owner.mpeaceful,0);
    return {entry,amount};
}

for (const remote of [false,true]) test(`${remote ? 'remote burglary' : 'shop exit'} completes real billing, journal and pursuit`,async t => {
    const ctx = await setup(t), {entry,amount} = await leave(ctx,remote);
    assert.equal(entry.text,`stole ${amount} zorkmids worth of merchandise from Samoe's delicatessen`);
});

for (const kind of ['one-uncovered','fully-covered','excess-credit']) test(`public credit boundary: ${kind}`,async t => {
    const ctx = await setup(t);
    const credit = kind === 'one-uncovered' ? ctx.billed - 1
        : kind === 'fully-covered' ? ctx.billed : ctx.billed + 10;
    await deposit(credit); assert.equal(ctx.owner.eshk.credit,credit);
    if (credit < ctx.billed) {
        const {entry,amount} = await leave(ctx);
        assert.equal(amount,1); assert.ok(entry.text.startsWith('stole 1 zorkmid worth'));
    } else {
        const prefix = structuredClone(game.gamelog);
        clearMessages(); resetRng();
        await u_left_shop(ctx.shop,true);
        assert.deepEqual(game.gamelog,prefix);
        assert.equal(ctx.owner.eshk.credit,0); assert.equal(ctx.owner.eshk.billct,0);
        assert.equal(ctx.owner.eshk.robbed,0); assert.ok(!ctx.owner.eshk.following);
        assert.deepEqual(getRngLog(),[]);
    }
});

test('public robbery logs real debit in the uncovered total',async t => {
    const ctx = await setup(t);
    await costly_gold(game.u.ux,game.u.uy,10,true);
    assert.equal(ctx.owner.eshk.debit,10);
    const {entry,amount} = await leave(ctx);
    assert.equal(amount,ctx.billed + 10);
    assert.ok(entry.text.startsWith(`stole ${amount} zorkmids`));
});

for (const blind of [false,true]) test(`hallucinated ${blind ? 'blind' : 'visible'} public exit evaluates the journal before alarm RNG`,async t => {
    const ctx = await setup(t);
    await make_hallucinated(20,false); assert.ok(Hallucination());
    if (blind) await make_blinded(20,false);
    resetRng();
    const visibleCurrency = currency(ctx.billed), journalCurrency = currency(ctx.billed);
    const ownerName = s_suffix(shkname(ctx.owner)), expected = [...getRngLog()];
    assert.equal(expected.filter(s => !s.startsWith('~d')).length,4);
    assert.ok(expected.some(s => s.startsWith('~d')));
    const {entry} = await leave(ctx);
    assert.equal(entry.text,`stole ${ctx.billed} ${journalCurrency} worth of merchandise from ${ownerName} ${shtypes[ctx.owner.eshk.shoptype - SHOPBASE].name}`);
    assert.ok(messages().includes(`You stole ${ctx.billed} ${visibleCurrency} worth of merchandise.`));
    // Public callers then draw for the real Kops. This checks only the prefix.
    assert.deepEqual(getRngLog().slice(0,expected.length),expected);
    assert.equal(ctx.owner.isshk,1);
});

test('real hallucination resistance keeps the public journal name and currency ordinary',async t => {
    const ctx = await setup(t);
    await make_hallucinated(20,false); assert.ok(Hallucination());
    await make_hallucinated(0,false,W_WEP);
    assert.equal(Hallucination(),false); assert.ok(game.u.intrinsic.HHallucination);
    const {entry} = await leave(ctx);
    assert.ok(entry.text.endsWith("zorkmids worth of merchandise from Samoe's delicatessen"));
});

test('public completion keeps journal and pursuit behind stolen-value feedback',async t => {
    const ctx = await setup(t), prefix = structuredClone(game.gamelog);
    await pline('A'.repeat(72));
    const release = [], ready = [];
    const pending = [0,1].map(i => new Promise(resolve => { ready[i] = resolve; }));
    const prior = ctx.run._display.onEmptyQueue;
    let reads = 0;
    ctx.run._display.onEmptyQueue = () => {
        const i = reads++;
        if (i > 1) return 32;
        return new Promise(resolve => { release[i] = resolve; ready[i](true); });
    };
    const operation = u_left_shop(ctx.shop,true);
    try {
        assert.equal(await Promise.race([pending[0],operation.then(() => false)]),true);
        assert.equal(ctx.owner.eshk.billct,1); assert.deepEqual(game.gamelog,prefix);
        release[0](32);
        assert.equal(await Promise.race([pending[1],operation.then(() => false)]),true);
        assert.equal(ctx.owner.eshk.billct,0); assert.equal(ctx.owner.eshk.robbed,ctx.billed);
        assert.ok(!ctx.owner.eshk.following); assert.deepEqual(game.gamelog,prefix);
        assert.ok(game._toplines.includes('You escaped the shop without paying!'));
    } finally {
        ctx.run._display.onEmptyQueue = prior;
        for (const fn of release) fn(32);
        await operation;
    }
    assert.equal(game.gamelog.length,prefix.length + 1);
    assert.equal(ctx.owner.eshk.following,1);
});

for (const remote of [false,true]) test(`${remote ? 'remote' : 'exit'} returned-stock guard leaves journal and RNG untouched`,async t => {
    const ctx = await setup(t);
    await dropx(ctx.stock); assert.equal(ctx.owner.eshk.billct,0);
    const prefix = structuredClone(game.gamelog);
    clearMessages(); resetRng();
    if (remote) await remote_burglary(game.u.ux,game.u.uy);
    else await u_left_shop(ctx.shop,true);
    assert.deepEqual(game.gamelog,prefix); assert.deepEqual(getRngLog(),[]);
});
