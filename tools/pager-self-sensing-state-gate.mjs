// Source controls for C pager.c:682-702 through public description and real glyphs.
// Constructed property and swallowed-state guards are not native reach claims.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, form, clearMessages, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {do_screen_description, self_lookat} from '../js/pager.js';
import {newsym, canspotself, glyph_at} from '../js/display.js';
import {vision_reset, vision_recalc} from '../js/vision.js';
import {set_itimeout, make_blinded} from '../js/potion.js';
import {Amulet_on} from '../js/do_wear.js';
import {setworn} from '../js/worn.js';
import {mksobj, mksobj_at} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {dohide} from '../js/polyself.js';
import {hides_under} from '../js/mondata.js';
import {Invisible, Infravision, Unblind_telepat, Detect_monsters, Blind} from '../js/youprop.js';
import {getRngLog} from '../js/rng.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {W_RINGR, W_ARMC, TER_MAP, TER_MON, FROMOUTSIDE} from '../js/const.js';

async function senses(mask, invisible = true) {
    await setup();
    if (mask & 1) form(PMNAMES.PM_DWARF);
    if (mask & 2) {
        const amulet = await addinv(mksobj(ONAMES.AMULET_OF_ESP, false, false));
        await Amulet_on(amulet);
        assert.equal(game.u.uamul, amulet);
    }
    if (mask & 4) set_itimeout('HDetect_monsters', 100);
    if (invisible) set_itimeout('HInvis', 100);
    assert.equal(Infravision(), !!(mask & 1));
    assert.equal(Unblind_telepat(), !!(mask & 2));
    assert.equal(Detect_monsters(), !!(mask & 4));
    assert.equal(Invisible(), invisible);
    clearMessages();
}

function describe(expectedSuffix, expectSelf = true, looked = true, xx = x, yy = y) {
    vision_reset();
    vision_recalc();
    newsym(xx, yy);
    seed();
    const base = self_lookat();
    const result = do_screen_description({x: xx, y: yy}, looked, '@');
    assert.equal(typeof result.then, 'undefined');
    assert.deepEqual(getRngLog(), []);
    if (expectSelf) {
        assert.equal(glyph_at(xx, yy).kind, 'hero');
        assert.equal(result.firstmatch, base + expectedSuffix);
        assert.ok(result.out_str.includes(`(${base + expectedSuffix})`));
        assert.equal(result.pm, null);
    } else {
        assert.ok(!result.firstmatch.includes('called '));
        assert.ok(!result.out_str.includes('[seen:'));
    }
    return result;
}

for (const [mask, expected] of [
    [2, 'telepathy'], [3, 'infravision, telepathy'],
    [4, 'monster detection'], [5, 'infravision, monster detection'],
    [6, 'telepathy, monster detection'], [7, 'infravision, telepathy, monster detection'],
]) test(`invisible self, sensing mask ${mask}: ${expected}`, async () => {
    await senses(mask);
    assert.equal(canspotself(), true);
    describe(` [seen: ${expected}]`);
});

test('ordinary sight suppresses all three sensing explanations', async () => {
    await senses(7, false);
    describe('');
});

test('see-invisible ring suppresses explanation despite real invisibility and ESP', async () => {
    await senses(2);
    const ring = await addinv(mksobj(ONAMES.RIN_SEE_INVISIBLE, false, false));
    await setworn(ring, W_RINGR);
    assert.equal(Invisible(), false);
    describe('');
});

test('real blindness producer suppresses all sensing explanations', async () => {
    await senses(7);
    await make_blinded(100, false);
    assert.equal(Blind(), true);
    describe('');
});

test('swallowed self suppresses the suffix, constructed owner guard only', async () => {
    await senses(7);
    game.u.uswallow = true;
    describe('');
});

test('saved-swallow flag suppresses the suffix, constructed browse guard only', async () => {
    await senses(7);
    game.iflags.save_uswallow = true;
    describe('');
});

test('terrain without monsters does not describe self', async () => {
    await senses(7);
    game.iflags.terrainmode = TER_MAP;
    describe('', false);
});

test('terrain including monsters permits the self-sensing explanation', async () => {
    await senses(2);
    game.iflags.terrainmode = TER_MAP | TER_MON;
    describe(' [seen: telepathy]');
});

test('typed @ never inspects the hero state', async () => {
    await senses(7);
    describe('', false, false);
});

test('invisibility without sensing does not identify self', async () => {
    await senses(0);
    assert.equal(canspotself(), false);
    describe('', false);
});

test('infravision alone cannot spot invisible self', async () => {
    await senses(1);
    assert.equal(canspotself(), false);
    describe('', false);
});

test('intrinsic telepathy alone cannot spot sighted invisible self', async () => {
    await senses(0);
    game.u.intrinsic.HTelepat = FROMOUTSIDE;
    assert.equal(Unblind_telepat(), false);
    assert.equal(canspotself(), false);
    describe('', false);
});

test('intrinsic telepathy with detection does not claim unblind telepathy', async () => {
    await senses(4);
    game.u.intrinsic.HTelepat = FROMOUTSIDE;
    describe(' [seen: monster detection]');
});

test('carried ESP amulet does not provide unblind telepathy', async () => {
    await senses(4);
    const amulet = await addinv(mksobj(ONAMES.AMULET_OF_ESP, false, false));
    assert.notEqual(game.u.uamul, amulet);
    assert.equal(Unblind_telepat(), false);
    describe(' [seen: monster detection]');
});

test('real mummy wrapping blocks invisibility and suppresses the suffix', async () => {
    await senses(2);
    const cloak = await addinv(mksobj(ONAMES.MUMMY_WRAPPING, false, false));
    await setworn(cloak, W_ARMC);
    assert.equal(game.u.blocked.INVIS, W_ARMC);
    assert.equal(Invisible(), false);
    describe('');
});

test('eyeless hidden form suppresses sensing through canonical blindness', async () => {
    await senses(4, false);
    form(PMNAMES.PM_ROCK_PIERCER);
    await dohide();
    assert.equal(game.u.uundetected, 1);
    assert.equal(Invisible(), false);
    assert.equal(canspotself(), true);
    assert.equal(Blind(), true);
    const result = describe('');
    assert.ok(result.firstmatch.includes('hiding on the ceiling'));
});

test('another square never receives the self explanation', async () => {
    await senses(7);
    describe('', false, true, x + 1, y);
});

test('real hide-under producer describes sighted hidden self through detection', async () => {
    await senses(4, false);
    form(PMNAMES.PM_CAVE_SPIDER);
    assert.equal(hides_under(game.youmonst.data), true);
    mksobj_at(ONAMES.ROCK, x, y, false, false);
    await dohide();
    assert.equal(game.u.uundetected, 1);
    assert.equal(Invisible(), false);
    assert.equal(Blind(), false);
    assert.equal(canspotself(), true);
    const result = describe(' [seen: monster detection]');
    // C mhidden_description uses the shown hero glyph, not the hidden object.
    assert.ok(result.firstmatch.includes('hiding under something'));
});
