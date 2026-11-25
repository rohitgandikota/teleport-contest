// Public enlightenment and real producers. Numeric extremes and endgame counts
// are explicit source-state fixtures; ordinary keyboard evidence is separate.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup, clearMessages, seed } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { enlightenment, BASICENLIGHTENMENT as BASIC,
    MAGICENLIGHTENMENT as MAGIC, ENL_GAMEOVERALIVE as ALIVE,
    ENL_GAMEOVERDEAD as DEAD } from '../js/insight.js';
import { mksobj, curse, uncurse, add_to_container } from '../js/mkobj.js';
import { addinv, fully_identify_obj, hidden_gold } from '../js/invent.js';
import { setworn } from '../js/worn.js';
import { Ring_on, find_ac, stuck_ring } from '../js/do_wear.js';
import { setuwep } from '../js/wield.js';
import { artifact_exists } from '../js/artifact.js';
import { adjattrib } from '../js/attrib.js';
import { polymon } from '../js/polyself.js';
import { make_hallucinated, make_glib } from '../js/potion.js';
import { getRngLog } from '../js/rng.js';
import { rhack } from '../js/cmd.js';
import { optfn_playmode } from '../js/options.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { W_RINGL, W_RINGR, W_ARMG, W_ARMH, ONAME_WISH, LEFT_HANDED } from '../js/const.js';

function view(mode = BASIC, final = 0) {
    const lines = enlightenment(mode, final);
    assert.ok(Array.isArray(lines), 'synchronous public return');
    return lines;
}
function characteristic(name, mode = BASIC, final = 0) {
    return view(mode, final).find(line => line.startsWith(` Your ${name} `));
}
async function item(type, spe = 0) {
    const obj = mksobj(type, false, false);
    obj.spe = spe; // Signed enchantment source fixture, applied by real owners.
    return await addinv(obj);
}
async function gold(amount, container = null) {
    const obj = mksobj(ONAMES.GOLD_PIECE, false, false);
    obj.quan = amount;
    return container ? await add_to_container(container, obj) : await addinv(obj);
}
async function box(known = true, parent = null) {
    const obj = mksobj(ONAMES.SACK, false, false);
    if (parent)
        await add_to_container(parent, obj);
    else
        await addinv(obj);
    if (known)
        fully_identify_obj(obj);
    return obj;
}

test('actual worn ring refreshes stale AC through basic inspection', async () => {
    await setup();
    const before = game.u.uac;
    const obj = await item(ONAMES.RIN_PROTECTION, 3);
    setworn(obj, W_RINGL);
    assert.equal(game.u.uac, before, 'setworn does not recompute AC');
    seed();
    assert.ok(view().includes(` Your armor class is ${before - 3}.`));
    assert.equal(game.u.uac, before - 3);
    assert.equal(game.disp.botl, true);
    assert.deepEqual(getRngLog(), []);
});
for (const [spe, ac, word] of [[99, -99, 'best'], [-99, 99, 'worst']]) {
    test(`real protection ring reaches the ${word} AC cap and final wording`, async () => {
        await setup();
        const obj = await item(ONAMES.RIN_PROTECTION, spe);
        setworn(obj, W_RINGL);
        await Ring_on(obj);
        if (spe > 0) {
            const other = await item(ONAMES.RIN_PROTECTION, spe);
            setworn(other, W_RINGR);
            await Ring_on(other);
        }
        assert.equal(game.u.uac, ac);
        assert.ok(view().includes(` Your armor class is ${ac}, the ${word} possible.`));
        assert.ok(view(BASIC, ALIVE).includes(` Your armor class was ${ac}, the ${word} possible.`));
    });
}
test('ordinary AC does not claim an extreme', async () => {
    await setup();
    find_ac();
    assert.ok(view().includes(` Your armor class is ${game.u.uac}.`));
});

for (const [wallet, stashed, first, second] of [
    [0, 0, ' Your wallet is empty.', null],
    [1, 0, ' Your wallet contains 1 zorkmid.', null],
    [0, 1, ' Your wallet is empty, but', ' you have 1 zorkmid stashed away in your pack.'],
    [1, 2, ' Your wallet contains 1 zorkmid, and', ' you have 2 more stashed away in your pack.'],
    [2, 3, ' Your wallet contains 2 zorkmids, and', ' you have 3 more stashed away in your pack.'],
]) {
    test(`real carried coins and known container: ${wallet}/${stashed}`, async () => {
        await setup();
        if (wallet)
            await gold(wallet);
        if (stashed)
            await gold(stashed, await box());
        seed();
        const lines = view();
        assert.ok(lines.includes(first), lines.join('\n'));
        if (second)
            assert.equal(lines[lines.indexOf(first) + 1], second);
        else
            assert.ok(!lines.some(line => line.includes('stashed away')));
        assert.deepEqual(getRngLog(), []);
    });
}
test('unknown nested gold is disclosed only at final or after real identification', async () => {
    await setup();
    const outer = await box();
    const inner = await box(false, outer);
    await gold(17, inner);
    assert.equal(hidden_gold(game.invent, false), 0);
    assert.ok(!view().some(line => line.includes('stashed away')));
    for (const final of [ALIVE, DEAD]) {
        game.u.umortality = final === DEAD ? 1 : 0;
        assert.ok(view(BASIC, final).includes(' you had 17 zorkmids stashed away in your pack.'));
    }
    assert.equal(inner.cknown, 0, 'final disclosure does not identify the container');
    fully_identify_obj(inner);
    assert.ok(view().includes(' you have 17 zorkmids stashed away in your pack.'));
});
for (const [wallet, stashed] of [[1, 0], [0, 1], [1, 1], [0, 0]]) {
    test(`real hallucination preserves currency draw count for wallet/pack ${wallet}/${stashed}`, async () => {
        await setup();
        if (wallet)
            await gold(wallet);
        if (stashed)
            await gold(stashed, await box());
        await make_hallucinated(100, false, 0);
        clearMessages();
        seed();
        view();
        assert.equal(getRngLog().length, wallet || stashed ? 1 : 0);
        if (wallet || stashed)
            assert.match(getRngLog()[0], /rn2\(21\)/, 'C currencies table has 21 entries');
    });
}

for (const [type, slot, name, value] of [
    [ONAMES.GAUNTLETS_OF_POWER, W_ARMG, 'strength', 25],
    [ONAMES.DUNCE_CAP, W_ARMH, 'intelligence', 6],
    [ONAMES.DUNCE_CAP, W_ARMH, 'wisdom', 6],
]) {
    test(`cursed real ${name} equipment hides innate values only in BASIC mode`, async () => {
        await setup();
        const obj = await item(type);
        await curse(obj);
        setworn(obj, slot);
        assert.equal(characteristic(name), ` Your ${name} is ${value}.`);
        assert.match(characteristic(name, BASIC | MAGIC), /base:/);
        uncurse(obj);
        assert.match(characteristic(name), /base:/);
    });
}
test('real Ogresmasher and curse producers hide only constitution without magic disclosure', async () => {
    await setup();
    const obj = mksobj(ONAMES.WAR_HAMMER, false, false);
    artifact_exists(obj, 'Ogresmasher', true, ONAME_WISH);
    assert.ok(obj.oartifact);
    await addinv(obj);
    await setuwep(obj);
    await curse(obj);
    assert.equal(characteristic('constitution'), ' Your constitution is 25.');
    assert.match(characteristic('constitution', BASIC | MAGIC), /base:/);
    uncurse(obj);
    assert.match(characteristic('constitution'), /base:/);
});
for (const blocker of ['ring', 'gloves', 'welded-primary', 'welded-two-handed', 'slippery-gloves']) {
    test(`real ${blocker} blocks removal of sustain ability and suppresses peak`, async () => {
        await setup();
        await adjattrib(0, -1, 1);
        const obj = await item(ONAMES.RIN_SUSTAIN_ABILITY);
        const slot = blocker === 'welded-primary' ? W_RINGR : W_RINGL;
        setworn(obj, slot);
        await Ring_on(obj);
        if (blocker === 'ring') {
            await curse(obj);
        } else if (blocker === 'gloves' || blocker === 'slippery-gloves') {
            const gloves = await item(ONAMES.LEATHER_GLOVES);
            setworn(gloves, W_ARMG);
            if (blocker === 'gloves')
                await curse(gloves);
            else
                await make_glib(10);
        } else {
            const weapon = await item(blocker === 'welded-two-handed'
                ? ONAMES.TWO_HANDED_SWORD : ONAMES.DAGGER);
            await setuwep(weapon);
            await curse(weapon);
        }
        assert.ok(stuck_ring(obj, ONAMES.RIN_SUSTAIN_ABILITY));
        assert.doesNotMatch(characteristic('strength'), /peak:/);
        assert.match(characteristic('strength', BASIC | MAGIC), /peak:/);
    });
}
test('a removable sustain ring and an unrelated cursed ring do not hide innate values', async () => {
    await setup();
    await adjattrib(0, -1, 1);
    const obj = await item(ONAMES.RIN_SUSTAIN_ABILITY);
    setworn(obj, W_RINGL);
    await Ring_on(obj);
    assert.equal(stuck_ring(obj, ONAMES.RIN_SUSTAIN_ABILITY), null);
    assert.match(characteristic('strength'), /peak:/);
    const other = await item(ONAMES.RIN_FIRE_RESISTANCE);
    setworn(other, W_RINGR);
    await curse(other);
    assert.match(characteristic('strength'), /peak:/);
});
test('secondary-hand welded dagger leaves the sustain ring removable', async () => {
    await setup();
    await adjattrib(0, -1, 1);
    const obj = await item(ONAMES.RIN_SUSTAIN_ABILITY);
    setworn(obj, W_RINGR);
    await Ring_on(obj);
    game.u.uhandedness = LEFT_HANDED; // Explicit anatomy fixture for the ring guard.
    const weapon = await item(ONAMES.DAGGER);
    await setuwep(weapon);
    await curse(weapon);
    assert.equal(stuck_ring(obj, ONAMES.RIN_SUSTAIN_ABILITY), null);
    assert.match(characteristic('strength'), /peak:/);
});
test('polymorph hides all innate values even with MAGIC disclosure', async () => {
    await setup();
    assert.equal(await polymon(PMNAMES.PM_STONE_GIANT), 1);
    for (const mode of [BASIC, BASIC | MAGIC]) {
        for (const name of ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'])
            assert.doesNotMatch(characteristic(name, mode), /base:|peak:|limit:/);
    }
});

test('final bones-disabled wording uses simple past, not had disabled', async () => {
    await setup();
    game.flags.bones = false; // Explicit end-game option fixture.
    assert.ok(view(BASIC, ALIVE).includes(' You disabled loading of bones levels.'));
    game.u.umortality = 1;
    assert.ok(view(BASIC, DEAD).includes(' You disabled loading and storing of bones levels.'));
    assert.ok(view().includes(' You have disabled loading of bones levels.'));
});
test('final encountered-bones count uses simple past and preserves plural', async () => {
    await setup();
    game.u.uroleplay.numbones = 2; // End-game counter fixture, no native bones claim.
    assert.ok(view(BASIC, ALIVE).includes(' You encountered 2 bones levels.'));
    assert.ok(view().includes(' You have encountered 2 bones levels.'));
});

test('real BASIC attributes menu suspends and resumes on concealed strength', async () => {
    const run = await setup();
    const obj = await item(ONAMES.GAUNTLETS_OF_POWER);
    await curse(obj);
    setworn(obj, W_ARMG);
    game.rc.opts.playmode = 'normal'; // Use the actual mode-option producer.
    optfn_playmode();
    clearMessages();
    seed();
    run._display.clearInputQueue();
    game.command_queue = [];
    let arrived, release, reads = 0;
    const atPage = new Promise(resolve => { arrived = resolve; });
    run._display.onEmptyQueue = () => {
        assert.ok(++reads < 10);
        const lines = run._display.grid.map(row => row.map(cell => cell.ch).join(''));
        const line = lines.find(text => text.includes('Your strength'));
        if (!line)
            return 32;
        arrived(line.trim());
        return new Promise(resolve => { release = resolve; });
    };
    const beforeMoves = game.moves;
    const operation = rhack(24);
    const line = await Promise.race([atPage, operation.then(() => null)]);
    run._display.onEmptyQueue = () => 27;
    release?.(27);
    await operation;
    assert.equal(line, 'Your strength is 25.');
    assert.equal(game.moves, beforeMoves);
    assert.equal(game.u.uarmg, obj);
    assert.deepEqual(getRngLog(), []);
});


test('MAGIC override follows the real welded-weapon discovery side effect', async () => {
    await setup();
    const ring = await item(ONAMES.RIN_SUSTAIN_ABILITY);
    setworn(ring, W_RINGR);
    await Ring_on(ring);
    const weapon = await item(ONAMES.DAGGER);
    await setuwep(weapon);
    await curse(weapon);
    assert.equal(weapon.bknown, 0);
    seed();
    view(BASIC | MAGIC);
    assert.equal(weapon.bknown, 1, 'stuck_ring/welded runs before MAGIC reveals innate values');
    assert.deepEqual(getRngLog(), []);
});
