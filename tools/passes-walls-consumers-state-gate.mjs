// Constructed C-contract controls through actual status, artifact, trap,
// damage-record and shopkeeper producers. No private exports or mocks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {resetInputState} from '../js/input.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {polymon, rehumanize} from '../js/polyself.js';
import {nh_timeout} from '../js/timeout.js';
import {Antimagic, Passes_walls, Half_physical_damage, Half_spell_damage} from '../js/youprop.js';
import {readobjnam} from '../js/objnam.js';
import {addinv} from '../js/invent.js';
import {setuwep} from '../js/wield.js';
import {Cloak_off} from '../js/do_wear.js';
import {maketrap} from '../js/mklev.js';
import {dotrap, mintrap, Trap_Effect_Finished} from '../js/trap.js';
import {add_damage, shk_move, inhishop} from '../js/shk.js';
import {dropx} from '../js/do.js';
import {set_levltyp} from '../js/mkmaze.js';
import {teleds, rloc_to} from '../js/teleport.js';
import {in_rooms} from '../js/hack.js';
import {m_at, t_at} from '../js/mon.js';
import {makemon} from '../js/makemon.js';
import {PMNAMES as P} from '../js/monst_data.js';
import * as C from '../js/const.js';
import {grant} from './passes-walls-test-input.mjs';

const shopRecipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/shop-door-block.json', import.meta.url)));
const rc = shopRecipe.segments[0].nethackrc;
const seed = () => { initRng(2); enableRngLog(); };
const text = () => [...(game._msg_history || []), game._toplines || ''].join('\n');
function clearMessages() {
    game._toplines = ''; game._msg_history = []; game._toplin = 0;
    game._pending_message = ''; game._win_stop = false; game.iflags.last_msg = 0;
}
async function prepare(part = {seed: 7303, datetime: '20000115090000', nethackrc: rc, moves: ' '}) {
    const run = await runSegment({...part, storage: new InMemoryStorage()});
    game._preNhgetchHook = null; resetInputState(); run._display.clearInputQueue();
    let reads = 0;
    run._display.onEmptyQueue = async () => {
        assert.ok(++reads < 100, 'bounded ordinary prompt acknowledgment');
        await setImmediate(); return 32;
    };
    return run;
}
async function phase(run, source) {
    if (source.includes('form')) await polymon(P.PM_XORN);
    if (source.includes('timed')) await grant(run, 3);
    if (source === 'expired') {
        await grant(run, 1); await nh_timeout();
    }
    if (source === 'removed-form') {
        await polymon(P.PM_XORN); await rehumanize();
    }
    return !['none', 'expired', 'removed-form'].includes(source);
}
async function carry(name) {
    const obj = await readobjnam(name, null);
    assert.ok(obj?.oartifact, `real artifact wish: ${name}`);
    return await addinv(obj);
}

async function antiMagic(source, gear = 'none', resistant = true) {
    const run = await prepare();
    const phased = await phase(run, source);
    if (!resistant) await Cloak_off();
    // Xorn transformation really destroys the starting cloak. Supply a real
    // carried defense, rather than restoring a property bit or ruined armor.
    const carriedAfterForm = resistant && !Antimagic();
    if (carriedAfterForm) await carry('The Magic Mirror of Merlin');
    if (gear === 'physical') await carry('The Master Key of Thievery');
    if (gear === 'spell') await carry('The Eye of the Aethiopica');
    if (gear === 'both') await carry('The Orb of Fate');
    if (gear === 'magicbane') setuwep(await carry('Magicbane'));
    if (gear === 'carried') await carry('The Orb of Detection');
    if (gear === 'two-carried') {
        await carry('The Orb of Detection'); await carry('The Magic Mirror of Merlin');
    }
    assert.equal(Antimagic(), resistant);
    assert.equal(Passes_walls(), phased);
    assert.equal(Half_physical_damage(), ['physical', 'both'].includes(gear));
    assert.equal(Half_spell_damage(), ['spell', 'both', 'carried', 'two-carried'].includes(gear));
    // Explicit constructed reserves prevent death and energy throttling from
    // obscuring the selected arm. Status and equipment words are never assigned.
    game.u.uhp = game.u.uhpmax = game.u.mh = game.u.mhmax = 100;
    game.u.uen = game.u.uenmax = 100;
    const room = game.level.rooms.find(r => game.level.at(r.lx, r.ly).typ === C.ROOM
        && !t_at(r.lx, r.ly) && !m_at(r.lx, r.ly));
    assert.ok(room); await teleds(room.lx, room.ly, false);
    const trap = await maketrap(game.u.ux, game.u.uy, C.ANTI_MAGIC);
    assert.ok(trap, 'anti-magic fields cannot be created on stairs');
    assert.equal(t_at(game.u.ux, game.u.uy), trap);
    const beforeWord = game.u.intrinsic?.HPasses_walls || 0;
    clearMessages(); seed();
    assert.equal(await dotrap(trap, C.FORCETRAP), Trap_Effect_Finished);
    const calls = [...getRngLog()];
    const count = !resistant ? 0 : 1
        + Number(['physical', 'spell', 'both', 'carried', 'two-carried'].includes(gear))
        + Number(gear === 'magicbane')
        + Number(carriedAfterForm || ['carried', 'two-carried'].includes(gear));
    assert.equal(calls.length, count + 2, 'only implosion rolls, 2d6 drain and half-drain roll');
    const dice = calls.slice(0, count).map(call => {
        assert.match(call, /^rnd\(4\)=\d$/); return Number(call.split('=')[1]);
    });
    assert.match(calls[count], /^d\(2,6\)=\d+$/);
    assert.match(calls[count + 1], /^rnd\(\d+\)=\d+$/);
    const rolled = dice.reduce((a, b) => a + b, 0);
    const damage = phased ? Math.trunc((rolled + 3) / 4) : rolled;
    const hp = game.u.umonnum === P.PM_XORN ? game.u.mh : game.u.uhp;
    assert.equal(100 - hp, damage, 'C quarters the final sum with upward rounding');
    assert.equal(100 - game.u.uenmax, Number(calls[count + 1].split('=')[1]));
    assert.equal((100 - game.u.uen) + (100 - game.u.uenmax), Number(calls[count].split('=')[1]));
    assert.equal(game.u.intrinsic?.HPasses_walls || 0, beforeWord, 'consumer does not consume duration');
    assert.ok(trap.tseen);
    if (resistant) assert.ok(text().indexOf('sluggish.') < text().indexOf('energy drain away!'));
    else assert.ok(!text().includes('sluggish.'));
    return {calls, damage, energy: [game.u.uen, game.u.uenmax]};
}

for (const source of ['none', 'timed', 'form', 'timed-form', 'expired', 'removed-form'])
    await test(`anti-magic: ${source} phasing uses the canonical source`, () => antiMagic(source));
for (const gear of ['physical', 'spell', 'both', 'magicbane', 'carried', 'two-carried'])
    await test(`anti-magic: real ${gear} protection precedes one final quartering`, async () => {
        const plain = await antiMagic('none', gear);
        const phased = await antiMagic('timed', gear);
        assert.deepEqual(phased.calls, plain.calls, 'phasing consumes no RNG');
        assert.deepEqual(phased.energy, plain.energy, 'phasing changes no energy drain');
    });
await test('anti-magic: removing the real MR cloak suppresses implosion even while phasing', () =>
    antiMagic('timed', 'none', false));

async function shop() {
    const run = await prepare(shopRecipe.segments[0]);
    const owner = game.level.monsters.find(m => m.isshk && m.eshk.shoproom === game.u.ushops.charCodeAt(0));
    assert.ok(owner && inhishop(owner));
    await dropx(game.invent.find(o => o.unpaid));
    assert.equal(owner.eshk.billct, 0);
    const point = {x: 29, y: 6};
    assert.ok(C.IS_WALL(game.level.at(point.x, point.y).typ));
    assert.ok(in_rooms(point.x, point.y, C.SHOPBASE).includes(String.fromCharCode(owner.eshk.shoproom)));
    assert.equal(game.level.objectsAt(point.x, point.y).length, 0);
    add_damage(point.x, point.y, 0);
    const record = game.level.damagelist[0];
    assert.deepEqual([record.x, record.y], [point.x, point.y]);
    assert.equal(set_levltyp(point.x, point.y, C.ROOM), true);
    // These are source-level timing controls. Ordinary-input proof is separate.
    game.moves = record.when + C.REPAIR_DELAY;
    return {run, owner, point, record};
}
async function repair(ctx, expected) {
    const {owner, point, record} = ctx;
    clearMessages(); seed();
    const result = await shk_move(owner);
    assert.ok([-2, -1, 0, 1].includes(result), 'preserve caller return contract');
    assert.equal(game.level.at(point.x, point.y).typ, expected ? record.typ : C.ROOM);
    assert.equal(game.level.damagelist.includes(record), !expected);
    const words = text();
    if (expected) {
        assert.ok(words.includes('whispers an incantation'));
        assert.ok(words.includes('section of the wall closes up!'));
        assert.ok(words.indexOf('incantation') < words.indexOf('closes up'));
    } else assert.ok(!words.includes('section of the wall closes up!'));
    return [...getRngLog()];
}
for (const source of ['none', 'timed', 'form', 'timed-form', 'expired', 'removed-form'])
    await test(`shop: occupied wall and ${source} phasing`, async () => {
        const ctx = await shop(); const active = await phase(ctx.run, source);
        await teleds(ctx.point.x, ctx.point.y, false);
        const word = game.u.intrinsic?.HPasses_walls || 0;
        // shk_move continues into move_special's reservoir sampling. Repair
        // changes the available squares, so preserve that exact caller suffix.
        assert.deepEqual(await repair(ctx, active), active
            ? ['rn2(1)=0', 'rn2(2)=0']
            : ['rn2(1)=0', 'rn2(2)=0', 'rn2(3)=2']);
        assert.equal(game.u.intrinsic?.HPasses_walls || 0, word);
    });
await test('shop: four turns defer repair, the fifth permits it under a phasing hero', async () => {
    const ctx = await shop(); await phase(ctx.run, 'timed');
    await teleds(ctx.point.x, ctx.point.y, false);
    game.moves = ctx.record.when + C.REPAIR_DELAY - 1;
    await repair(ctx, false); game.moves++; await repair(ctx, true);
});
await test('shop: no hero at the gap needs no phasing', async () => repair(await shop(), true));
await test('shop: a phasing hero still blocks trap removal', async () => {
    const ctx = await shop(); await phase(ctx.run, 'timed');
    await teleds(ctx.point.x, ctx.point.y, false);
    const trap = await maketrap(ctx.point.x, ctx.point.y, C.ANTI_MAGIC);
    await repair(ctx, false); assert.equal(t_at(ctx.point.x, ctx.point.y), trap);
});
for (const [name, species, expected] of [['gnome', P.PM_GNOME, false], ['xorn', P.PM_XORN, true]])
    await test(`shop: real ${name} occupying the gap`, async () => {
        const ctx = await shop();
        const mon = await makemon(game.mons[species], ctx.point.x, ctx.point.y,
            C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
        assert.ok(mon); assert.equal(m_at(ctx.point.x, ctx.point.y), mon);
        await repair(ctx, expected);
    });
await test('shop: a real trapped monster prevents trap disposal', async () => {
    const ctx = await shop();
    await repair(ctx, true);
    ctx.point = {x: 32, y: 6};
    assert.equal(game.level.at(ctx.point.x, ctx.point.y).typ, C.ROOM);
    add_damage(ctx.point.x, ctx.point.y, 0);
    ctx.record = game.level.damagelist[0];
    const mon = await makemon(game.mons[P.PM_TROLL], ctx.point.x, ctx.point.y,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    const trap = await maketrap(ctx.point.x, ctx.point.y, C.BEAR_TRAP);
    await mintrap(mon, C.FORCETRAP); assert.ok(mon.mtrapped);
    game.moves = ctx.record.when + C.REPAIR_DELAY;
    await repair(ctx, false); assert.equal(t_at(ctx.point.x, ctx.point.y), trap);
});
await test('shop: owner occupying the gap always postpones repair', async () => {
    const ctx = await shop(); await rloc_to(ctx.owner, ctx.point.x, ctx.point.y);
    await repair(ctx, false);
});
await test('shop: another real shopkeeper cannot repair this damage', async () => {
    const ctx = await shop();
    ctx.owner = game.level.monsters.find(m => m.isshk && m !== ctx.owner && inhishop(m));
    assert.ok(ctx.owner); await repair(ctx, false);
});
