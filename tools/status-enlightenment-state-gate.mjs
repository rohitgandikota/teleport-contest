// Complete C status_enlightenment behavior, using normal imports and real producers.
// Explicit flag fixtures cover C endgame and dormant states without claiming keyboard reach.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup, clearMessages, mount, seed, x, y } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { enlightenment, BASICENLIGHTENMENT, MAGICENLIGHTENMENT,
         ENL_GAMEOVERALIVE, ENL_GAMEOVERDEAD } from '../js/insight.js';
import { make_stoned, make_slimed, make_sick, make_vomiting, make_stunned,
         make_confused, make_hallucinated, make_deaf, make_blinded, make_glib,
         incr_itimeout, set_itimeout, peffects } from '../js/potion.js';
import { polymon, dohide, float_vs_flight } from '../js/polyself.js';
import { do_genocide, punish } from '../js/read.js';
import { set_wounded_legs, heal_legs } from '../js/do.js';
import { setworn } from '../js/worn.js';
import { addinv } from '../js/invent.js';
import { mksobj, bless, place_object } from '../js/mkobj.js';
import { set_levltyp } from '../js/mkmaze.js';
import { pooleffects } from '../js/hack.js';
import { ready_weapon, setuswapwep, dotwoweapon } from '../js/wield.js';
import { wet_a_towel, use_skill, add_weapon_skill, weapon_type, can_advance } from '../js/weapon.js';
import { discover_object, observe_object } from '../js/o_init.js';
import { rhack } from '../js/cmd.js';
import { nh_timeout } from '../js/timeout.js';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { resetInputState, pushKeys } from '../js/input.js';
import { getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { FROMOUTSIDE, I_SPECIAL, TIMEOUT, LEFT_SIDE, RIGHT_SIDE, BOTH_SIDES,
         SICK_VOMITABLE, SICK_NONVOMITABLE, SICK_ALL, KILLED_BY, W_ARM, W_ARMG,
         W_ARMF, W_RINGL, POOL, LAVAPOOL, ROOM, M_AP_FURNITURE, M_AP_MONSTER,
         M_AP_NOTHING, W_SADDLE } from '../js/const.js';
import { which_armor } from '../js/worn.js';

function status(mode = BASICENLIGHTENMENT, final = 0) {
    const before = getRngLog().slice();
    const all = enlightenment(mode, final);
    assert.ok(Array.isArray(all), 'enlightenment completes synchronously');
    assert.deepEqual(getRngLog(), before, 'status inspection consumes no gameplay RNG');
    const start = all.indexOf(final ? 'Final Status:' : 'Status:') + 1;
    assert.ok(start > 0);
    const end = all.indexOf('', start);
    return all.slice(start, end);
}
function has(line, mode = BASICENLIGHTENMENT, final = 0) {
    assert.ok(status(mode, final).includes(line), `missing ${line}`);
}
function lacks(fragment, mode = BASICENLIGHTENMENT, final = 0) {
    assert.ok(!status(mode, final).some(line => line.includes(fragment)), `unexpected ${fragment}`);
}
const screen = run => run._display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
async function item(type) {
    return await addinv(mksobj(type, false, false));
}
async function pauseAt(run, action, predicate) {
    let arrived, release, reads = 0;
    const arrival = new Promise(resolve => { arrived = resolve; });
    run._display.clearInputQueue();
    game.command_queue = [];
    run._display.onEmptyQueue = () => {
        assert.ok(++reads < 16, 'bounded real prompt reads');
        if (!predicate())
            return 32;
        arrived();
        return new Promise(resolve => { release = resolve; });
    };
    const pending = action();
    const stopped = await Promise.race([arrival.then(() => true), pending.then(() => false)]);
    return { pending, stopped, resume(key) {
        run._display.onEmptyQueue = () => 32;
        release?.(key);
    } };
}
async function roleSetup(role, align, options = '') {
    const run = await runSegment({ seed: 99812, datetime: '20000110090000', moves: ' ',
        storage: new InMemoryStorage(),
        nethackrc: `OPTIONS=name:Desired,role:${role},race:human,gender:male,align:${align},playmode:debug\n`
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
            + options });
    let reads = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++reads < 30, 'bounded setup prompts');
        return 32;
    };
    game._preNhgetchHook = null;
    resetInputState();
    clearMessages();
    seed();
    return run;
}

test('healthy bare-handed hero has no fabricated troubles and retains current/final tense', async () => {
    await setup();
    assert.deepEqual(status().filter(line => !/hungry|encumbered|skill/.test(line)), [
        ' You are bare handed.', ' You do not wear any armor.',
    ]);
    has(' You were bare handed.', BASICENLIGHTENMENT, ENL_GAMEOVERALIVE);
});

for (const [name, producer, clear, line] of [
    ['stone', () => make_stoned(12, null, KILLED_BY, 'status control'),
        () => make_stoned(0, null, 0, null), 'turning to stone'],
    ['slime', () => make_slimed(12, null), () => make_slimed(0, null), 'turning into slime'],
    ['vomiting', () => make_vomiting(12, false), () => make_vomiting(0, false), 'nauseated'],
    ['stun', () => make_stunned(12, false), () => make_stunned(0, false), 'stunned'],
    ['confusion', () => make_confused(12, false), () => make_confused(0, false), 'confused'],
    ['hallucination', () => make_hallucinated(12, false), () => make_hallucinated(0, false), 'hallucinating'],
]) {
    test(`real ${name} producer, final tense, and clearing`, async () => {
        await setup();
        await producer();
        has(` You are ${line}.`);
        has(` You were ${line}.`, BASICENLIGHTENMENT, ENL_GAMEOVERALIVE);
        await clear();
        lacks(line);
    });
}

test('simultaneous troubles retain C prayer order before senses', async () => {
    await setup();
    await make_stoned(25, null, KILLED_BY, 'status control');
    await make_slimed(25, null);
    incr_itimeout('HStrangled', 25);
    await make_sick(25, 'status control', false, SICK_NONVOMITABLE | SICK_VOMITABLE);
    await make_vomiting(25, false);
    await make_stunned(25, false);
    await make_confused(25, false);
    await make_hallucinated(25, false);
    await make_blinded(25, false);
    await make_deaf(25, false);
    assert.deepEqual(status().slice(0, 11), [
        ' You are turning to stone.', ' You are turning into slime.',
        ' You are being strangled (25).', ' You are terminally sick from illness.',
        ' You are terminally sick from food poisoning.', ' You are nauseated.',
        ' You are stunned.', ' You are confused.', ' You are hallucinating.',
        ' You are temporarily blind (25).', ' You are deaf.',
    ]);
});

test('dual sickness reports both causes; curing one does not hide the other', async () => {
    await setup();
    await make_sick(20, 'status control', false, SICK_ALL);
    has(' You are terminally sick from illness.');
    has(' You are terminally sick from food poisoning.');
    await make_sick(0, null, false, SICK_NONVOMITABLE);
    lacks('from illness');
    has(' You are terminally sick from food poisoning.');
    await make_sick(0, null, false, SICK_VOMITABLE);
    lacks('terminally sick');
});

for (const [name, start, prop, finalLine] of [
    ['petrification', () => make_stoned(1, null, KILLED_BY, 'status control'), 'STONED', ' You turned into stone.'],
    ['sliming', () => make_slimed(1, null), 'SLIMED', ' You turned into slime.'],
    ['terminal illness', () => make_sick(1, 'status control', false, SICK_NONVOMITABLE), 'SICK', ' You died from terminal illness.'],
    ['food poisoning', () => make_sick(1, 'status control', false, SICK_VOMITABLE), 'SICK', ' You died from food poisoning.'],
]) {
    test(`real ${name} expiry exposes its final marker while Die is pending`, async () => {
        const run = await setup();
        await start();
        clearMessages();
        seed(2); // Deterministic real illness survival check; no substituted RNG.
        const held = await pauseAt(run, () => nh_timeout(), () => screen(run).includes('Die?'));
        const marker = game.u.uprops[prop];
        const lines = status(BASICENLIGHTENMENT, ENL_GAMEOVERDEAD);
        held.resume(110);
        await held.pending;
        assert.equal(held.stopped, true);
        assert.ok(marker & I_SPECIAL);
        assert.ok(lines.includes(finalLine), `missing ${finalLine}`);
        assert.equal((game.u.uprops[prop] || 0) & I_SPECIAL, 0);
    });
}

test('terminal illness wins the final cause when both sickness flags are set', async () => {
    const run = await setup();
    await make_sick(1, 'status control', false, SICK_ALL);
    clearMessages();
    const held = await pauseAt(run, () => nh_timeout(), () => screen(run).includes('Die?'));
    const lines = status(BASICENLIGHTENMENT, ENL_GAMEOVERDEAD);
    held.resume(110);
    await held.pending;
    assert.equal(held.stopped, true);
    assert.ok(lines.includes(' You died from terminal illness.'));
    assert.ok(!lines.some(line => line.includes('food poisoning')));
});

for (const [id, feeling] of [
    [PMNAMES.PM_WOOD_NYMPH, 'dead'], [PMNAMES.PM_VAMPIRE, 'condemned'],
    [PMNAMES.PM_IRON_GOLEM, 'empty'],
]) {
    test(`real self-genocide while polymorphed reports ${feeling} inside`, async () => {
        await setup();
        await polymon(id);
        lacks('inside');
        // Real delayed-killer initialization, needed by the existing do_genocide caller.
        await make_stoned(2, null, KILLED_BY, 'status control');
        await make_stoned(0, null, 0, null);
        clearMessages();
        pushKeys('human\r');
        await do_genocide(1); // C REALLY, an uncursed genocide scroll.
        assert.equal(game.u.uhp, -1);
        has(` You are transformed and feel ${feeling} inside.`);
        has(` You were transformed and felt ${feeling} inside.`, BASICENLIGHTENMENT, ENL_GAMEOVERALIVE);
    });
}

test('riding, levitation and flight describe the same real mount in C order', async () => {
    await setup();
    await mount();
    has(' You are riding your pony.');
    incr_itimeout('HFlying', 30);
    float_vs_flight();
    has(' You and your pony are flying.');
    incr_itimeout('HLevitation', 30);
    float_vs_flight();
    has(' You and your pony are levitating.');
    lacks('are flying');
    const lines = status();
    assert.ok(lines.indexOf(' You are riding your pony.') < lines.indexOf(' You and your pony are levitating.'));
});

test('riding-accident final suppression does not erase a live mount', async () => {
    await setup();
    await mount();
    game.killer = { name: 'riding accident' }; // Constructed endgame cause, not a death-producer claim.
    lacks('riding your pony', BASICENLIGHTENMENT, ENL_GAMEOVERDEAD);
    has(' You were riding your pony.', BASICENLIGHTENMENT, ENL_GAMEOVERALIVE);
    has(' You are riding your pony.');
});

test('blessed levitation reveals at-will control only in magical enlightenment', async () => {
    await setup();
    const potion = await item(ONAMES.POT_LEVITATION);
    bless(potion);
    await peffects(potion);
    has(' You are levitating.');
    has(' You are levitating, at will.', MAGICENLIGHTENMENT);
    has(' You were levitating, at will.', MAGICENLIGHTENMENT, ENL_GAMEOVERALIVE);
    const ring = await item(ONAMES.RIN_LEVITATION);
    await setworn(ring, W_RINGL);
    lacks('at will', MAGICENLIGHTENMENT);
});

test('at-will levitation does not append the mount phrase', async () => {
    await setup();
    const potion = await item(ONAMES.POT_LEVITATION);
    bless(potion);
    await peffects(potion);
    await mount(); // Mount only after the blessed potion has set Lev_at_will.
    has(' You are riding your pony.', MAGICENLIGHTENMENT);
    has(' You are levitating, at will.', MAGICENLIGHTENMENT);
    lacks('pony are levitating', MAGICENLIGHTENMENT);
});

test('actual pool entry reports underwater and leaving removes it', async () => {
    await setup();
    await polymon(PMNAMES.PM_WATER_ELEMENTAL);
    set_levltyp(x, y, POOL);
    await pooleffects(true);
    assert.equal(!!game.u.uinwater, true);
    has(' You are underwater.');
    lacks('swimming'); // C Underwater is exactly u.uinwater; the next arm is dormant.
    set_levltyp(x, y, ROOM);
    await pooleffects(true);
    lacks('underwater');
});

for (const [terrain, name] of [[POOL, 'water'], [LAVAPOOL, 'lava']]) {
    test(`water walking discloses active ${name} contact, not just capability`, async () => {
        await setup();
        const boots = await item(ONAMES.WATER_WALKING_BOOTS);
        await setworn(boots, W_ARMF);
        lacks('walking on');
        set_levltyp(x, y, terrain);
        assert.ok(status().some(line => line.startsWith(` You are walking on ${name}`)));
        incr_itimeout('HLevitation', 20);
        float_vs_flight();
        lacks('walking on');
    });
}

for (const [form, line] of [
    [PMNAMES.PM_SMALL_MIMIC, ' You are mimicking a strange object.'],
    [PMNAMES.PM_LURKER_ABOVE, ' You are hiding on the ceiling.'],
    [PMNAMES.PM_TRAPPER, ' You are hiding on the floor.'],
]) {
    test('real #monster hiding producer: ' + line, async () => {
        await setup();
        await polymon(form);
        await dohide();
        has(line);
        const final = status(BASICENLIGHTENMENT, ENL_GAMEOVERALIVE);
        assert.ok(final.includes(line.replace(' are ', ' were ')));
    });
}

test('under-object hiding reads the retained local pile head', async () => {
    await setup();
    await polymon(PMNAMES.PM_GARTER_SNAKE);
    const dagger = mksobj(ONAMES.DAGGER, false, false);
    const boulder = mksobj(ONAMES.BOULDER, false, false);
    await place_object(dagger, x, y);
    await place_object(boulder, x, y);
    await dohide(); // Real helper, not an offered #monster choice for a snake.
    has(' You are hiding underneath a boulder.');
});

for (const [appearance, tail] of [[M_AP_FURNITURE, 'something'], [M_AP_MONSTER, 'someone']]) {
    test(`constructed mimic appearance ${tail} retains existing youhiding wording`, async () => {
        await setup();
        await polymon(PMNAMES.PM_SMALL_MIMIC);
        game.youmonst.m_ap_type = appearance; // No ordinary route claimed for these C hypothetical arms.
        has(` You are mimicking ${tail}.`);
        game.youmonst.m_ap_type = M_AP_NOTHING;
        lacks('mimicking');
    });
}

for (const [side, part] of [[LEFT_SIDE, 'a wounded left leg'], [RIGHT_SIDE, 'a wounded right leg'],
    [BOTH_SIDES, 'wounded legs']]) {
    test(`real leg injury discloses ${part} and heals`, async () => {
        await setup();
        await set_wounded_legs(side, 30);
        has(` You have ${part}.`);
        await heal_legs(2);
        lacks('wounded');
    });
}

test('wizard intrinsic leg timer without a side uses the C right-leg fallback', async () => {
    await setup();
    incr_itimeout('HWounded_legs', 30);
    has(' You have a wounded right leg.');
});

test('mounted leg injury belongs to the steed and is wizard-only', async () => {
    await setup();
    await mount();
    await set_wounded_legs(BOTH_SIDES, 30);
    has(' Your pony has wounded rear legs.');
    has(' Your pony had wounded rear legs.', BASICENLIGHTENMENT, ENL_GAMEOVERALIVE);
    lacks('You have wounded');
    game.wizard = false; // Disclosure-mode fixture, same real injury and mount.
    lacks('wounded');
});

test('real slippery fingers report full timer width, gloves and expiry', async () => {
    await setup();
    make_glib(TIMEOUT);
    has(' You have slippery fingers (16777215).');
    const gloves = await item(ONAMES.LEATHER_GLOVES);
    await setworn(gloves, W_ARMG);
    has(' You have slippery gloves (16777215).');
    game.wizard = false;
    has(' You have slippery gloves.');
    make_glib(0);
    lacks('slippery');
});

for (const [key, line, past] of [
    ['HFumbling', ' You fumble.', ' You fumbled.'],
    ['HHunger', ' You hunger rapidly.', ' You hungered rapidly.'],
    ['HSleepy', ' You fall asleep uncontrollably (30).', ' You fell asleep uncontrollably (30).'],
]) {
    test(`magic reveals an unknown real ${key} source without leaking it into basic mode`, async () => {
        await setup();
        incr_itimeout(key, 30);
        assert.ok(!status().includes(line));
        has(line, MAGICENLIGHTENMENT);
        has(past, MAGICENLIGHTENMENT, ENL_GAMEOVERALIVE);
        set_itimeout(key, 0);
        assert.ok(!status(MAGICENLIGHTENMENT).includes(line));
    });
}

for (const [type, mask, text] of [
    [ONAMES.GAUNTLETS_OF_FUMBLING, W_ARMG, 'fumble'],
    [ONAMES.RIN_HUNGER, W_RINGL, 'hunger rapidly'],
]) {
    test('basic disclosure requires known worn cause: ' + text, async () => {
        await setup();
        const obj = await item(type);
        await setworn(obj, mask);
        assert.ok(!status().some(line => line.startsWith(` You ${text}`)));
        observe_object(obj);
        discover_object(type, true, true, false);
        assert.ok(status().some(line => line.startsWith(` You ${text}`)));
        await setworn(null, mask);
        assert.ok(!status(MAGICENLIGHTENMENT).some(line => line.startsWith(` You ${text}`)));
    });
}

test('real deaf roleplay conduct uses the source suffix in debug mode only', async () => {
    await roleSetup('Wizard', 'neutral', 'OPTIONS=deaf\n');
    has(' You are deaf from birth.');
    game.wizard = false;
    has(' You are deaf.');
});

test('punishment uses the ball simple name and keeps its actual owner', async () => {
    await setup();
    await punish(null);
    const ball = game.u.uball;
    has(' You are chained to a heavy iron ball.');
    assert.equal(game.u.uball, ball);
});

for (const seen of [false, true]) {
    test(`real wielded reflection shield uses ${seen ? 'silver' : 'smooth'} description`, async () => {
        await setup();
        const shield = await item(ONAMES.SHIELD_OF_REFLECTION);
        await ready_weapon(shield);
        if (seen)
            observe_object(shield);
        else
            shield.dknown = 0; // Explicit unseen-item source boundary after real ownership transfer.
        has(` You are wielding a ${seen ? 'silver' : 'smooth'} shield.`);
    });
}

for (const wetness of [1, 3]) {
    test(`real towel wetting ${wetness} uses the status wet-towel description`, async () => {
        await setup();
        const towel = await item(ONAMES.TOWEL);
        await ready_weapon(towel);
        await wet_a_towel(towel, wetness, false);
        has(' You are wielding a wet towel.');
        assert.equal(game.u.uwep, towel);
    });
}

for (const [type, word] of [[ONAMES.TOWEL, 'a towel'], [ONAMES.FOOD_RATION, 'some food'],
    [ONAMES.DAGGER, 'a dagger']]) {
    test(`retained ordinary wielded item class ${word}`, async () => {
        await setup();
        await ready_weapon(await item(type));
        has(` You are wielding ${word}.`);
    });
}

test('actual weapon practice and credits use correct present and final enhancement tense', async () => {
    await setup();
    const weapon = await item(ONAMES.DAGGER);
    await ready_weapon(weapon);
    const type = weapon_type(weapon);
    await add_weapon_skill(10);
    await use_skill(type, 1000);
    assert.equal(can_advance(type, false), true);
    assert.ok(status().some(line => line.endsWith(' and can enhance that.')));
    assert.ok(status(BASICENLIGHTENMENT, ENL_GAMEOVERALIVE)
        .some(line => line.endsWith(' and could have enhanced that.')));
});

test('real two-weapon setup and practice retain combined skill enhancement wording', async () => {
    await roleSetup('Ranger', 'neutral');
    const primary = await item(ONAMES.DAGGER);
    const secondary = await item(ONAMES.SHORT_SWORD);
    await ready_weapon(primary);
    setuswapwep(secondary);
    await polymon(PMNAMES.PM_MARILITH); // Legal multiple-weapon form can bypass a restricted role skill.
    await dotwoweapon();
    assert.equal(!!game.u.twoweap, true);
    has(' You are wielding two weapons at once.');
    await add_weapon_skill(10);
    await use_skill(weapon_type(primary), 1000);
    assert.ok(status().some(line => line.includes('You can enhance skill')));
    assert.ok(status(BASICENLIGHTENMENT, ENL_GAMEOVERALIVE)
        .some(line => line.includes('You could have enhanced skill')));
});

test('real Monk suit producer reports penalty in basic mode, suppressed when polymorphed', async () => {
    await roleSetup('Monk', 'neutral');
    const suit = await item(ONAMES.LEATHER_ARMOR);
    await setworn(suit, W_ARM);
    assert.equal(game.iflags.tux_penalty, true);
    has(' You have a huge penalty to hit (-20) due to your suit.');
    game.wizard = false;
    has(' You have a huge penalty to hit due to your suit.');
    await polymon(PMNAMES.PM_WOOD_NYMPH);
    lacks('penalty to hit');
});

test('another role wearing the same real suit does not inherit the Monk penalty', async () => {
    await setup();
    await setworn(await item(ONAMES.LEATHER_ARMOR), W_ARM);
    assert.equal(game.iflags.tux_penalty, false);
    lacks('penalty to hit');
    lacks('wear any armor');
});

test('real attributes menu holds its status page, preserves all timers and resumes without a turn', async () => {
    const run = await setup();
    await make_confused(25, false);
    await make_slimed(25, null);
    make_glib(25);
    clearMessages();
    seed();
    const before = { moves: game.moves, intr: { ...game.u.intrinsic }, props: { ...game.u.uprops } };
    const held = await pauseAt(run, () => rhack(24), () => screen(run).includes('You are confused.'));
    const visible = screen(run);
    held.resume(27);
    await held.pending;
    assert.equal(held.stopped, true);
    assert.ok(visible.includes('You are turning into slime.'));
    assert.ok(visible.includes('You have slippery fingers (25).'));
    assert.deepEqual({ moves: game.moves, intr: { ...game.u.intrinsic }, props: { ...game.u.uprops } }, before);
    assert.equal(game.context.move, 0);
    assert.deepEqual(getRngLog(), []);
});
