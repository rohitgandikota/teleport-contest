// C trap.c:2323-2345: enchanted iron footwear absorbs an anti-magic field.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {resetInputState} from '../js/input.js';
import {setup, seed, clearMessages, messages, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {readobjnam} from '../js/objnam.js';
import {addinv} from '../js/invent.js';
import {setworn, m_dowear, which_armor} from '../js/worn.js';
import {Boots_on} from '../js/do_wear.js';
import {maketrap} from '../js/mklev.js';
import {dotrap, mintrap, Trap_Effect_Finished} from '../js/trap.js';
import {makemon} from '../js/makemon.js';
import {mpickobj} from '../js/steal.js';
import {make_blinded} from '../js/potion.js';
import {resists_magm} from '../js/mondata.js';
import {addtobill, onbill, costly_spot} from '../js/shk.js';
import {pline} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import * as C from '../js/const.js';

async function hero(name, worn = true, blind = false) {
    const run = await setup();
    const boots = await addinv(await readobjnam(name, null));
    assert.ok(boots);
    if (worn) { setworn(boots, C.W_ARMF); await Boots_on(); }
    assert.equal(which_armor(game.youmonst, C.W_ARMF), worn ? boots : null);
    if (blind) await make_blinded(10, false);
    game.u.uhp = game.u.uhpmax = 100;
    game.u.uen = game.u.uenmax = 100;
    const trap = await maketrap(x, y, C.ANTI_MAGIC);
    trap.tseen = 0;
    clearMessages(); seed();
    return {boots, trap, run};
}

for (const [name, blind] of [
    ['uncursed +2 iron shoes', false],
    ['blessed +2 iron shoes', false],
    ['cursed +2 iron shoes', false],
    ['uncursed +2 kicking boots', false],
    ['uncursed +2 iron shoes', true],
]) test(`hero absorption: ${name}, blind=${blind}`, async () => {
    const {boots, trap} = await hero(name, true, blind);
    assert.equal(boots.spe, 2);
    assert.equal(await dotrap(trap, C.FORCETRAP), Trap_Effect_Finished);
    assert.equal(boots.spe, 1, 'one enchantment replaces the entire field effect');
    assert.deepEqual(getRngLog(), [], 'absorption does not roll damage or energy drain');
    assert.deepEqual([game.u.uhp, game.u.uen, game.u.uenmax], [100, 100, 100]);
    assert.ok(trap.tseen, 'hero discovers the field even while blind');
    assert.match(messages(), /A lethargic aura surrounds your /);
    assert.ok(game.level.traps.includes(trap), 'the field survives absorption');
});

async function holdMessage(run, start, inspect) {
    let enter, release, timer, finished = false;
    const waiting = new Promise(resolve => { enter = resolve; });
    run._display.clearInputQueue();
    run._display.onEmptyQueue = () => {
        enter();
        return new Promise(resolve => { release = resolve; });
    };
    const pending = start().then(result => { finished = true; return result; });
    try {
        await Promise.race([waiting,
            pending.then(() => { throw Error('expected pending More prompt'); }),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(Error('missing More prompt')), 2000);
            })]);
        await setImmediate();
        assert.equal(finished, false);
        inspect();
    } finally {
        clearTimeout(timer);
        run._display.onEmptyQueue = () => 32;
        release?.(32);
        await pending;
    }
}

test('hero feedback waits before the enchantment is consumed', async () => {
    const {boots, trap, run} = await hero('uncursed +2 iron shoes');
    await pline('An earlier message leaves too little room for the iron footwear aura.');
    await holdMessage(run, () => dotrap(trap, C.FORCETRAP), () => {
        assert.equal(boots.spe, 2);
        assert.deepEqual(getRngLog(), []);
        assert.equal(game.u.uen, 100);
    });
    assert.equal(boots.spe, 1);
});

test('unpaid footwear keeps its original enchantment on the used-up bill', async () => {
    const source = JSON.parse(fs.readFileSync(new URL(
        'gen-sessions/recipes/shop-food-price-rounding.json', import.meta.url))).segments[0];
    const run = await runSegment({...source,
        moves:source.moves.slice(0, source.moves.indexOf('\x17')),
        storage:new InMemoryStorage()});
    game._preNhgetchHook = null; resetInputState();
    run._display.onEmptyQueue = () => 32;
    const owner = game.level.monsters.find(mon => mon.isshk);
    assert.ok(owner && costly_spot(game.u.ux, game.u.uy));
    assert.equal(owner.eshk.billct, 0);
    const boots = await addinv(await readobjnam('uncursed +2 iron shoes', null));
    await addtobill(boots, false, false, true);
    const originalBill = onbill(boots, owner, true);
    assert.ok(originalBill && boots.unpaid);
    const price = originalBill.price;
    setworn(boots, C.W_ARMF); await Boots_on();
    const trap = await maketrap(game.u.ux, game.u.uy, C.ANTI_MAGIC);
    assert.ok(trap);
    clearMessages(); seed();
    await holdMessage(run, () => dotrap(trap, C.FORCETRAP), () => {
        assert.equal(boots.spe, 2, 'billing waits before draining the enchantment');
        assert.equal(boots.unpaid, 1);
        assert.equal(game.billobjs.length, 0);
    });
    assert.equal(boots.spe, 1);
    assert.equal(boots.unpaid, 0);
    assert.equal(game.billobjs.length, 1);
    const copy = game.billobjs[0], bill = onbill(copy, owner, true);
    assert.equal(copy.spe, 2, 'bill copy records the pre-alteration enchantment');
    assert.equal(copy.owornmask, 0);
    assert.ok(bill.useup);
    assert.equal(bill.price, price);
    assert.match(messages(), /disenchant/);
});

for (const [name, worn] of [
    ['uncursed +0 iron shoes', true],
    ['uncursed -1 iron shoes', true],
    ['uncursed +2 low boots', true],
    ['uncursed +2 iron shoes', false],
]) test(`hero non-absorption: ${name}, worn=${worn}`, async () => {
    const {boots, trap} = await hero(name, worn);
    const enchantment = boots.spe;
    assert.equal(await dotrap(trap, C.FORCETRAP), Trap_Effect_Finished);
    assert.equal(boots.spe, enchantment);
    assert.match(getRngLog()[0], /^d\(2,6\)=/);
    assert.equal(getRngLog().length, 2);
    assert.ok(game.u.uen < 100 && game.u.uenmax < 100);
    assert.ok(!messages().includes('aura surrounds'));
});

test('hero exhausts two enchantments before the field starts draining energy', async () => {
    const {boots, trap} = await hero('uncursed +2 iron shoes');
    for (const expected of [1, 0]) {
        assert.equal(await dotrap(trap, C.FORCETRAP), Trap_Effect_Finished);
        assert.equal(boots.spe, expected);
        assert.deepEqual(getRngLog(), []);
        assert.equal(game.u.uen, 100);
    }
    assert.equal(await dotrap(trap, C.FORCETRAP), Trap_Effect_Finished);
    assert.equal(boots.spe, 0);
    assert.ok(game.u.uen < 100);
});

for (const [species, resistant] of [[P.PM_KOBOLD_SHAMAN, false], [P.PM_ORACLE, true]])
for (const enchantment of [2, 0])
test(`monster footwear: species=${species}, enchantment=${enchantment}`, async () => {
    await setup();
    const mon = await makemon(game.mons[species], x + 1, y,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    assert.ok(mon);
    assert.equal(resists_magm(mon), resistant);
    const boots = await readobjnam(`uncursed +${enchantment} iron shoes`, null);
    await mpickobj(mon, boots); m_dowear(mon, true);
    assert.equal(which_armor(mon, C.W_ARMF), boots);
    mon.mhp = mon.mhpmax = 100;
    mon.mspec_used = 0;
    const trap = await maketrap(mon.mx, mon.my, C.ANTI_MAGIC);
    trap.tseen = 0;
    clearMessages(); seed();
    assert.equal(await mintrap(mon, C.FORCETRAP), Trap_Effect_Finished);
    if (enchantment > 0) {
        assert.equal(boots.spe, enchantment - 1);
        assert.deepEqual(getRngLog(), []);
        assert.deepEqual([mon.mhp, mon.mspec_used, trap.tseen], [100, 0, 0]);
        assert.equal(messages().trim(), '', 'monster absorption is silent');
    } else {
        assert.equal(boots.spe, 0);
        assert.equal(getRngLog().length, 1);
        if (resistant) assert.ok(mon.mhp < 100);
        else assert.ok(mon.mspec_used > 0);
    }
});
