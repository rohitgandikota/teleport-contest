// mhitm.js — one monster attacking another.
// C ref: src/mhitm.c
//
// This is the monster-vs-monster twin of js/uhitm.js. A pet attacking a newt
// runs through here, which is why it matters well before the hero fights
// anything unusual: dog_move()'s attack branch and pet_ranged_attk() both end
// in mattackm(), and until that lands a pet that decides to attack does
// nothing instead.
//
// Ported so far: the three leaves below. mattackm() itself, hitmm(), mdamagem()
// and passivemm() are NOT here yet -- see docs/plan/STATUS.md for the sizing.

import { game } from './gstate.js';
import { Deaf } from './youprop.js';
import { You_hear } from './pline.js';
import { M_AP_TYPE, M_ATTK_MISS, M_ATTK_HIT, M_ATTK_DEF_DIED } from './const.js';
import { d } from './rng.js';
import { mhitm_adtyping, mhitm_knockback } from './uhitm.js';
import { touch_petrifies } from './dog.js';
import { resists_ston } from './mon.js';
import { MON_WEP, mon_offmap } from './monst.js';
import { PMNAMES } from './monst_data.js';
import { ATTKS } from './monst_data.js';
import { seemimic } from './mon.js';
import { newsym, canspotmon, pline } from './display.js';
import { mdistu } from './monmove.js';
import { Monnam, mon_nam_too } from './do_name.js';
import { could_seduce } from './mhitu.js';

// src/mhitm.c:27 noises() — the message when a fight happens out of sight.
//
// The rate limit is the interesting part and it is stateful in a way that is
// easy to drop: a noise is reported only when the far/near classification
// CHANGES, or when more than 10 moves have passed since the last one. So a
// long brawl in the next room produces one message, not one per blow.
//
// gf.far_noise and gn.noisetime are C globals; they live on `game` here.
export async function noises(magr, mattk) {
    const farq = (mdistu(magr) > 15);

    if (!Deaf() && (farq !== game.far_noise || game.moves - (game.noisetime | 0) > 10)) {
        game.far_noise = farq;
        game.noisetime = game.moves;
        await You_hear(
            ((mattk.aatyp === ATTKS.AT_EXPL) ? 'an explosion' : 'some noises')
            + (farq ? ' in the distance' : '') + '.');
    }
}

// src/mhitm.c:40 pre_mm_attack() — bring both parties out of hiding.
//
// C's comment is worth keeping: this happens even when the hero cannot see it,
// "because the formerly concealed monster is now in action". A mimic that
// attacks stops being a mimic whether or not anyone is watching.
//
// Note `showit` is only ever set when gv.vis is already true, so the newsym()
// calls it guards are for the case where the hero CAN see the square but the
// creature was concealed a moment ago.
export function pre_mm_attack(magr, mdef) {
    let showit = false;

    /* unhiding or unmimicking happens even if hero can't see it
       because the formerly concealed monster is now in action */
    if (M_AP_TYPE(mdef)) {
        seemimic(mdef);
        showit ||= game.vis;
    } else if (mdef.mundetected) {
        mdef.mundetected = 0;
        showit ||= game.vis;
    }
    if (M_AP_TYPE(magr)) {
        seemimic(magr);
        showit ||= game.vis;
    } else if (magr.mundetected) {
        magr.mundetected = 0;
        showit ||= game.vis;
    }

    if (game.vis) {
        if (!canspotmon(magr))
            map_invisible(magr.mx, magr.my);
        else if (showit)
            newsym(magr.mx, magr.my);
        if (!canspotmon(mdef))
            map_invisible(mdef.mx, mdef.my);
        else if (showit)
            newsym(mdef.mx, mdef.my);
    }
}

// src/display.c:378 map_invisible() — remember an unseen monster as 'I'.
//
// Needs the glyph layer (GLYPH_INVISIBLE and show_glyph), which is not ported,
// so it is recorded rather than guessed. Painting the wrong thing here would
// put an 'I' on the map that C does not put there, or miss one it does.
function map_invisible(x, y) {
    (game.unported ||= new Set()).add('display:map_invisible');
}

// src/mhitm.c:76 missmm() — feedback for a monster-vs-monster attack that misses.
//
// The seduction arm is not a flavour detail: could_seduce() decides between
// "misses" and "pretends to be friendly to", and a mcan'd (cancelled) monster
// always misses regardless.
export async function missmm(magr, mdef, mattk) {
    pre_mm_attack(magr, mdef);

    if (game.vis) {
        await pline(`${Monnam(magr)} ${
            (magr.mcan || !could_seduce(magr, mdef, mattk))
                ? 'misses' : 'pretends to be friendly to'
        } ${mon_nam_too(mdef, magr)}.`);
    } else {
        await noises(magr, mattk);
    }
}

// src/mhitm.c mdamagem() — apply one monster's attack damage to another.
//
// THE FIRST LINE IS THE POINT: d(damn, damd) is the damage roll, and it is
// the first RNG call any monster-vs-monster attack makes. Until this landed
// the whole branch was declined and that draw never happened.
//
// Ported: the roll, the mhitm_data setup, the mhitm_adtyping dispatch, the
// mhitm_knockback call (which draws twice more), and the damage application.
// Recorded: the petrification block, which needs attk_protection/monstone and
// fires only against a petrifying defender, and the death path, which needs
// monkilled.
export function mdamagem(magr, mdef, mattk, mwep, dieroll) {
    const pa = magr.data, pd = mdef.data;
    const mhm = {
        damage: d(mattk.damn | 0, mattk.damd | 0),
        hitflags: M_ATTK_MISS,
        permdmg: 0,
        specialdmg: 0,
        dieroll: dieroll,
        done: false,
    };

    if ((touch_petrifies(pd)
         || (mattk.adtyp === ATTKS.AD_DGST && pd.pmidx === PMNAMES.PM_MEDUSA))
        && !resists_ston(magr)) {
        /* attk_protection(), poly_when_stoned(), mon_to_stone() and
           monstone() are unported; the attacker turning to stone is a whole
           death path and is not guessed at. */
        (game.unported ||= new Set()).add('mdamagem:petrify_attacker');
        return M_ATTK_MISS;
    }

    mhitm_adtyping(magr, mattk, mdef, mhm);

    if (mhitm_knockback(magr, mdef, mattk, mhm.hitflags, MON_WEP(magr) !== null)
        && (((mhm.hitflags & (M_ATTK_DEF_DIED | M_ATTK_HIT)) !== 0)
            || mon_offmap(mdef)))
        return mhm.hitflags;

    if (mhm.done)
        return mhm.hitflags;

    if (!mhm.damage)
        return mhm.hitflags;

    mdef.mhp -= mhm.damage;
    if (mdef.mhp < 1) {
        /* monkilled() and the corpse/zombify bookkeeping around it are
           unported. The hit points ARE deducted above, so the defender is
           left dead; what is missing is the death itself. */
        (game.unported ||= new Set()).add('mdamagem:monkilled');
        return M_ATTK_DEF_DIED;
    }
    return (mhm.hitflags |= M_ATTK_HIT);
}
