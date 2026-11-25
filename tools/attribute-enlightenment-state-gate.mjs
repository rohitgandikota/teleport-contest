// Behavioral source controls for the complete ordinary attributes owner.
// The shared title uses real polymorph producers. Endgame counts are fixtures.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup, clearMessages, mount, seed } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { enlightenment, BASICENLIGHTENMENT, MAGICENLIGHTENMENT,
    ENL_GAMEOVERALIVE, ENL_GAMEOVERDEAD } from '../js/insight.js';
import { mksobj, bless, curse } from '../js/mkobj.js';
import { addinv, set_moreluck } from '../js/invent.js';
import { setworn } from '../js/worn.js';
import { Ring_on, Ring_off, Amulet_on } from '../js/do_wear.js';
import { polymon } from '../js/polyself.js';
import { set_ulycn } from '../js/were.js';
import { set_utrap, reset_utrap } from '../js/trap.js';
import { incr_itimeout, make_blinded } from '../js/potion.js';
import { adjalign, change_luck } from '../js/attrib.js';
import { force_learn_spell } from '../js/spell.js';
import { rhack } from '../js/cmd.js';
import { getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { W_RINGL, W_RINGR, W_ARMC, W_ARM, W_AMUL, TT_WEB,
    I_SPECIAL, NON_PM } from '../js/const.js';

function attributes(final = 0) {
    const all = enlightenment(MAGICENLIGHTENMENT, final);
    assert.ok(Array.isArray(all), 'public enlightenment is synchronous');
    const first = all.indexOf(final ? 'Final Attributes:' : 'Attributes:');
    assert.ok(first >= 0);
    return all.slice(first + 1, all.indexOf('', first + 1));
}
function has(text, final = 0) {
    const lines = attributes(final);
    assert.ok(lines.some(line => line.includes(text)), `${text}\n${lines.join('\n')}`);
}
function lacks(text, final = 0) {
    assert.ok(!attributes(final).some(line => line.includes(text)), text);
}
async function item(type, spe) {
    const obj = mksobj(type, false, false);
    if (spe !== undefined)
        obj.spe = spe; // Explicit item enchantment fixture, not a fake property.
    return await addinv(obj);
}
async function ring(type, spe = 0, slot = W_RINGL) {
    const obj = await item(type, spe);
    setworn(obj, slot);
    await Ring_on(obj);
    clearMessages();
    return obj;
}

test('basic inspection omits the private attributes section', async () => {
    await setup();
    assert.ok(!enlightenment(BASICENLIGHTENMENT, 0).includes('Attributes:'));
    has('Your alignment is');
    has('Your luck is zero.');
});

for (const [type, text] of [
    [ONAMES.RIN_FIRE_RESISTANCE, 'You are fire resistant'],
    [ONAMES.RIN_COLD_RESISTANCE, 'You are cold resistant'],
    [ONAMES.RIN_SHOCK_RESISTANCE, 'You are shock resistant'],
    [ONAMES.RIN_FREE_ACTION, 'You have free action'],
    [ONAMES.RIN_SLOW_DIGESTION, 'You have slower digestion'],
    [ONAMES.RIN_SUSTAIN_ABILITY, 'You have fixed abilities'],
    [ONAMES.RIN_TELEPORT_CONTROL, 'You have teleport control'],
    [ONAMES.RIN_SEARCHING, 'You have automatic searching'],
]) {
    test(`wearing and removing real ring ${type} changes ${text}`, async () => {
        await setup();
        lacks(text);
        const obj = await ring(type);
        has(text);
        await Ring_off(obj);
        lacks(text);
        assert.equal(game.invent.includes(obj), true);
    });
}

test('dwarvish cloak protects inventory partially without granting fire resistance', async () => {
    await setup();
    const obj = await item(ONAMES.DWARVISH_CLOAK);
    setworn(obj, W_ARMC);
    has('Your items are somewhat protected from fire.');
    has('Your items are somewhat protected from cold.');
    lacks('You are fire resistant');
    lacks('Your items are protected from fire');
    has('Your items were somewhat protected from fire.', ENL_GAMEOVERALIVE);
});

test('a real resistance ring gives full item protection and names its worn source', async () => {
    await setup();
    await ring(ONAMES.RIN_FIRE_RESISTANCE);
    has('Your items are protected from fire by your');
    game.wizard = false; // Disclosure-mode fixture.
    has('Your items are protected from fire.');
    lacks(' by your ');
});

for (const [amount, word] of [[3, 'more '], [-3, 'less '], [0, '']]) {
    test(`real adornment enchantment ${amount} produces ${word || 'neutral '}charisma`, async () => {
        await setup();
        await ring(ONAMES.RIN_ADORNMENT, amount);
        has(`You are ${word}charismatic`);
    });
}

test('opposing adornment rings still disclose charisma at zero sum', async () => {
    await setup();
    await ring(ONAMES.RIN_ADORNMENT, 3);
    await ring(ONAMES.RIN_ADORNMENT, -3, W_RINGR);
    has('You are charismatic');
    lacks('more charismatic');
    lacks('less charismatic');
});

test('invisibility, self-sight and real wrapping select distinct descriptions', async () => {
    await setup();
    await ring(ONAMES.RIN_INVISIBILITY);
    has('You are invisible because');
    await ring(ONAMES.RIN_SEE_INVISIBLE, 0, W_RINGR);
    has('You are invisible to others');
    const wrapping = await item(ONAMES.MUMMY_WRAPPING);
    setworn(wrapping, W_ARMC);
    has('You are visible because');
    lacks('You are invisible');
});

test('temporary blindness changes see-invisible to a future conditional', async () => {
    await setup();
    await ring(ONAMES.RIN_SEE_INVISIBLE);
    has('You see invisible');
    await make_blinded(20, false);
    has('You will see invisible when not blind.');
    await make_blinded(0, false);
    has('You see invisible');
});

for (const [form, text] of [
    [PMNAMES.PM_PURPLE_WORM, 'aware of the presence of shriekers'],
    [PMNAMES.PM_VAMPIRE, 'aware of the presence of humans and elves'],
    [PMNAMES.PM_WHITE_UNICORN, 'polymorphed into a white unicorn'],
    [PMNAMES.PM_XORN, 'polymorphed into a xorn'],
]) {
    test(`real polymorph ${form} reaches ${text}`, async () => {
        await setup();
        assert.equal(await polymon(form), 1);
        has(text);
        has(text, ENL_GAMEOVERALIVE);
    });
}

test('real web trapping blocks levitation and restores its bit after inspection', async () => {
    await setup();
    await ring(ONAMES.RIN_LEVITATION);
    set_utrap(7, TT_WEB);
    const before = { ...game.u.blocked };
    assert.ok(before.LEVITATION & I_SPECIAL);
    has('You would levitate if not trapped.');
    assert.deepEqual(game.u.blocked, before);
    has('You would have levitated if not trapped.', ENL_GAMEOVERALIVE);
    await reset_utrap(false);
    lacks('would levitate');
});

test('levitation overrides actual flying form without erasing potential flight', async () => {
    await setup();
    assert.equal(await polymon(PMNAMES.PM_BAT), 1);
    await ring(ONAMES.RIN_LEVITATION);
    const before = { ...game.u.blocked };
    has("You would fly if you weren't levitating.");
    assert.deepEqual(game.u.blocked, before);
});

test('real riding blocks stealth and names the missing circumstance', async () => {
    await setup();
    await ring(ONAMES.RIN_STEALTH);
    await mount();
    has('You would be stealthy if not mounted.');
    lacks('You are stealthy');
});

test('the real lycanthropy producer feeds form and silver descriptions', async () => {
    await setup();
    set_ulycn(PMNAMES.PM_WEREWOLF);
    has('You are a werewolf.');
    has('You are harmed by silver.');
    assert.equal(await polymon(PMNAMES.PM_WEREWOLF), 1);
    has('You are a werewolf in beast form');
    set_ulycn(NON_PM);
    lacks('in beast form');
});

test('real unchanging and polymorph equipment disclose the blocked transition', async () => {
    await setup();
    await ring(ONAMES.RIN_POLYMORPH);
    const amulet = await item(ONAMES.AMULET_OF_UNCHANGING);
    setworn(amulet, W_AMUL);
    await Amulet_on(amulet);
    has("You can't change from your current form");
    has('You would polymorph periodically if not locked into your current form.');
    has('You would have polymorphed periodically if not locked into your current form.', ENL_GAMEOVERALIVE);
});

test('known spell and metallic armor select the casting impairment and robe mitigation', async () => {
    await setup();
    force_learn_spell(ONAMES.SPE_FORCE_BOLT);
    const suit = await item(ONAMES.PLATE_MAIL);
    setworn(suit, W_ARM);
    has('Your spell casting is impaired by metallic armor.');
    const robe = await item(ONAMES.ROBE);
    setworn(robe, W_ARMC);
    has('Your spell casting is impaired by metallic armor, mitigated by your robe.');
    setworn(null, W_ARM);
    has('Your spell casting is enhanced by wearing a robe.');
});

for (const [blessing, line] of [
    ['blessed', 'Good luck does not time out for you.'],
    ['cursed', 'Bad luck does not time out for you.'],
    ['uncursed', 'Good luck does not time out for you.'],
]) {
    test(`real ${blessing} luckstone sets luck and timeout behavior`, async () => {
        await setup();
        const obj = await item(ONAMES.LUCKSTONE);
        if (blessing === 'blessed') bless(obj);
        if (blessing === 'cursed') curse(obj);
        set_moreluck();
        has(line);
        has(blessing === 'cursed' ? 'You have reduced luck.' : 'You have extra luck.');
        if (blessing === 'uncursed') has('Bad luck does not time out for you.');
    });
}

test('real alignment and luck producers cross sign and magnitude boundaries', async () => {
    await setup();
    adjalign(-100);
    has('You have transgressed.');
    change_luck(-10);
    has('You are extremely unlucky (-10).');
    change_luck(20);
    has('You are extremely lucky (10).');
});

test('real detect timer retains all 24 timeout bits in debug output', async () => {
    await setup();
    incr_itimeout('HDetect_monsters', 0x800123);
    has('You are sensing the presence of monsters (8388899).');
    game.wizard = false;
    has('You are sensing the presence of monsters.');
});

test('neutral undead prayer disclosure uses its real RNG draw, final disclosure skips it', async () => {
    await setup();
    assert.equal(await polymon(PMNAMES.PM_VAMPIRE), 1);
    seed();
    attributes();
    assert.equal(getRngLog().length, 1);
    assert.match(getRngLog()[0], /rn2\(10\)/);
    seed();
    attributes(ENL_GAMEOVERALIVE);
    assert.deepEqual(getRngLog(), []);
});

for (const [deaths, expected] of [[1, 'once'], [2, 'twice'], [3, 'thrice'], [4, '4 times']]) {
    test(`explicit endgame count fixture ${deaths} retains mortality tense`, async () => {
        await setup();
        game.u.umortality = deaths; // Endgame-count fixture, not ordinary death reach.
        has(`You have been killed ${expected}.`);
        has(`You survived after being killed ${expected}.`, ENL_GAMEOVERALIVE);
        has(deaths === 1 ? 'You are dead.' : `You are dead (${deaths}${deaths === 2 ? 'nd' : deaths === 3 ? 'rd' : 'th'} time!).`, ENL_GAMEOVERDEAD);
    });
}

test('real attributes menu waits on its property page and resumes without a turn', async () => {
    const run = await setup();
    await ring(ONAMES.RIN_FREE_ACTION);
    clearMessages();
    seed();
    const before = { moves: game.moves, props: { ...game.u.uprops }, blocked: { ...game.u.blocked } };
    let arrived, release, reads = 0;
    const atPage = new Promise(resolve => { arrived = resolve; });
    run._display.clearInputQueue();
    game.command_queue = [];
    run._display.onEmptyQueue = () => {
        assert.ok(++reads < 10);
        const text = run._display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (!text.includes('You have free action')) return 32;
        arrived();
        return new Promise(resolve => { release = resolve; });
    };
    const operation = rhack(24);
    const stopped = await Promise.race([atPage.then(() => true), operation.then(() => false)]);
    run._display.onEmptyQueue = () => 27;
    release?.(27);
    await operation;
    assert.equal(stopped, true);
    assert.deepEqual({ moves: game.moves, props: { ...game.u.uprops }, blocked: { ...game.u.blocked } }, before);
    assert.equal(game.context.move, 0);
    assert.deepEqual(getRngLog(), []);
});

// C insight.c:394 uses the saved human sex for the common window title.
// The selected forms have explicit M2_FEMALE or M2_MALE in the pinned data.
for (const [role, gender, form, opposite, title] of [
    ['Priest', 'male', PMNAMES.PM_WATER_NYMPH, PMNAMES.PM_KEYSTONE_KOP, 'Priest'],
    ['Priest', 'female', PMNAMES.PM_KEYSTONE_KOP, PMNAMES.PM_WATER_NYMPH, 'Priestess'],
    ['Caveman', 'male', PMNAMES.PM_WATER_NYMPH, PMNAMES.PM_KEYSTONE_KOP, 'Caveman'],
    ['Caveman', 'female', PMNAMES.PM_KEYSTONE_KOP, PMNAMES.PM_WATER_NYMPH, 'Cavewoman'],
    ['Priest', 'male', PMNAMES.PM_KEYSTONE_KOP, PMNAMES.PM_WATER_NYMPH, 'Priest'],
    ['Priest', 'female', PMNAMES.PM_WATER_NYMPH, PMNAMES.PM_KEYSTONE_KOP, 'Priestess'],
    ['Wizard', 'male', PMNAMES.PM_WATER_NYMPH, PMNAMES.PM_KEYSTONE_KOP, 'Wizard'],
    ['Wizard', 'female', PMNAMES.PM_KEYSTONE_KOP, PMNAMES.PM_WATER_NYMPH, 'Wizard'],
]) {
    test(`actual ${gender} ${role} keeps original title across both forced-sex forms`, async () => {
        const { runSegment } = await import('../js/jsmain.js');
        const { InMemoryStorage } = await import('../js/storage.js');
        const run = await runSegment({ seed: 99812, datetime: '20000110090000', moves: ' ',
            storage: new InMemoryStorage(),
            nethackrc: `OPTIONS=name:Desired,role:${role},race:human,gender:${gender},align:neutral,playmode:debug\n`
                + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n' });
        let reads = 0;
        run._display.onEmptyQueue = () => {
            assert.ok(++reads <= 30, 'bounded real message acknowledgements');
            return 32;
        };
        const original = enlightenment(MAGICENLIGHTENMENT, 0)[0];
        assert.equal(original, `${game.plname[0].toUpperCase() + game.plname.slice(1)} the ${title}'s attributes:`);
        for (const next of [form, opposite]) {
            assert.equal(await polymon(next), 1);
            assert.equal(game.u.mfemale, gender === 'female');
            assert.equal(game.flags.female, next === PMNAMES.PM_WATER_NYMPH);
            for (const mode of [BASICENLIGHTENMENT, MAGICENLIGHTENMENT,
                BASICENLIGHTENMENT | MAGICENLIGHTENMENT]) {
                assert.equal(enlightenment(mode, 0)[0], original);
                assert.equal(enlightenment(mode, ENL_GAMEOVERALIVE)[0], original);
            }
        }
    });
}
