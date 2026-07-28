// zap.js — wands, spells and the rays they throw.
// C ref: src/zap.c
//
// Only obj_resists() is here so far. It is the first thing needed from this
// file because meatmetal() calls it before eating anything, which puts its
// rn2(100) into the stream ahead of the next monster's turn.

import { game } from './gstate.js';
import { OCLASSES } from './objects_data.js';
import { DEADMONSTER } from './monst.js';
import { killed, shieldeff_mon } from './mon.js';
import { ONAMES } from './objects_data.js';
import { rn2, rnd } from './rng.js';
import { is_rider } from './makemon.js';
import { getobj, GETOBJ_SUGGEST, GETOBJ_EXCLUDE, update_inventory } from './invent.js';
import { getdir } from './cmd.js';
import { fall_asleep } from './timeout.js';
import { pline_The, You } from './pline.js';
import { pline } from './display.js';
import { nothing_happens, ECMD_TIME, ECMD_CANCEL, NODIR } from './const.js';

// src/zap.c:1459 obj_resists() — does this object survive being destroyed?
//
// ochance/achance are PERCENTAGES, and the artifact one is checked against the
// same single draw, so the rn2(100) is spent whether or not the object is an
// artifact. Skipping the draw for ordinary objects would desynchronise the
// stream even when the answer happened to be right.
export function obj_resists(obj, ochance, achance) {
    if (obj.otyp === ONAMES.AMULET_OF_YENDOR
        || obj.otyp === ONAMES.SPE_BOOK_OF_THE_DEAD
        || obj.otyp === ONAMES.CANDELABRUM_OF_INVOCATION
        || obj.otyp === ONAMES.BELL_OF_OPENING
        || (obj.otyp === ONAMES.CORPSE && is_rider(game.mons[obj.corpsenm]))) {
        return true;
    } else {
        const chance = rn2(100);

        return chance < (obj.oartifact ? achance : ochance);
    }
}

// src/zap.c:3547 exclam() — the punctuation that ends a hit message, and it
// encodes the damage: "?" for a negative force, "." for 4 or less, "!" above
// that. force == 0 happens with e.g. a sleep ray.
export function exclam(force) {
    return (force < 0) ? '?' : (force <= 4) ? '.' : '!';
}

// src/zap.c:6100 resist() — the magic-resistance saving throw.
//
// One draw, and its MODULUS is computed rather than constant:
//
//     resisted = rn2(100 + alev - dlev) < mtmp->data->mr;
//
// alev comes from the item class attacking (a wand is 12, an instrument or
// artifact 10, a scroll 9, a potion 6, a ring 5, a spell your own level) and
// dlev from the monster, clamped to 50 above and raised to 1 below. So the
// span of the roll differs per call and rn2's argument is NOT interchangeable
// with a fixed 100 -- getting alev wrong changes the stream, not just the
// odds.
//
// The fake-player shortcut returns BEFORE the draw, so a Conflict ring test
// against an mplayer costs nothing.
//
// Damage halving is (damage + 1) / 2, rounding UP, so a resisted 1 point
// still does 1.
//
// shieldeff_mon, monkilled and the m_using distinction are recorded; killed
// is real.
export function resist(mtmp, oclass, damage, tell) {
    let alev, dlev;

    /* fake players always pass resistance test against Conflict */
    if (oclass === OCLASSES.RING_CLASS && !damage && !tell
        && note_zap_unported('resist:is_mplayer'))
        return 1;                       /* NO DRAW on this path */

    /* attack level */
    switch (oclass) {
    case OCLASSES.WAND_CLASS:   alev = 12; break;
    case OCLASSES.TOOL_CLASS:   alev = 10; break;   /* instrument */
    case OCLASSES.WEAPON_CLASS: alev = 10; break;   /* artifact */
    case OCLASSES.SCROLL_CLASS: alev = 9;  break;
    case OCLASSES.POTION_CLASS: alev = 6;  break;
    case OCLASSES.RING_CLASS:   alev = 5;  break;
    default:                    alev = game.u.ulevel; break;   /* spell */
    }
    /* defense level */
    dlev = mtmp.m_lev;
    if (dlev > 50)
        dlev = 50;
    else if (dlev < 1)
        dlev = note_zap_unported('resist:is_mplayer2') ? game.u.ulevel : 1;

    const resisted = rn2(100 + alev - dlev) < game.mons[mtmp.mnum].mr;
    if (resisted) {
        if (tell)
            shieldeff_mon(mtmp);
        damage = ((damage + 1) / 2) | 0;
    }

    if (damage) {
        mtmp.mhp -= damage;
        if (DEADMONSTER(mtmp)) {
            if (game.m_using)
                note_zap_unported('resist:monkilled');
            else
                killed(mtmp);
        }
    }
    return resisted;
}

const note_zap_unported = (w) => {
    (game.unported ||= new Set()).add('zap:' + w);
    return false;
};

function note_unported_zap(what) {
    (game.unported ||= new Set()).add('zap:' + what);
}

// src/zap.c:2618 zap_ok() — getobj callback for 'z'.
export function zap_ok(obj) {
    if (obj && obj.oclass === OCLASSES.WAND_CLASS)
        return GETOBJ_SUGGEST;
    return GETOBJ_EXCLUDE;
}

// src/zap.c:2514 zappable() — does the wand have a charge to spend?
//
// The wrest roll rn2(WAND_WREST_CHANCE=121) fires ONLY at exactly zero
// charges; a wand with charges pays none.
export async function zappable(wand) {
    if (wand.spe < 0 || (wand.spe === 0 && rn2(121)))
        return 0;
    if (wand.spe === 0)
        await You("wrest one last charge from the worn-out wand.");
    wand.spe--;
    return 1;
}

// src/zap.c:2705 zapyourself() — the hero zapped themself.
//
// Only the WAN_SLEEP arm is live (Sleep_resistance is absent for every
// fresh hero except elves, whose resistance field is real when set); every
// other wand records. Returns the retributive damage, 0 for sleep.
export async function zapyourself(obj, ordinary) {
    let damage = 0;

    switch (obj.otyp) {
    case ONAMES.WAN_SLEEP:
    case ONAMES.SPE_SLEEP: {
        if (game.u.uprops?.SLEEP_RES?.intrinsic
            || game.u.uprops?.SLEEP_RES?.extrinsic) {
            note_unported_zap('zapyourself:sleep_resisted');
            break;
        }
        if (ordinary)
            await pline_The("sleep ray hits you!");
        else
            await You("fall asleep!");
        /* monstunseesu(M_SEEN_SLEEP) — monster memory, recorded */
        fall_asleep(-rnd(50), true);
        break;
    }
    default:
        note_unported_zap(`zapyourself:otyp=${obj.otyp}`);
        break;
    }
    return damage;
}

// src/zap.c:2627 dozap() — the 'z' command.
export async function dozap() {
    /* nohands/check_capacity cannot fire for a fresh hero */
    const obj = await getobj("zap", zap_ok, 0);
    if (!obj)
        return ECMD_CANCEL;

    /* check_unpaid — shops, recorded when billing exists */

    const need_dir = game.objects[obj.otyp].oc_dir !== NODIR;
    if (!(await zappable(obj))) {
        await pline(nothing_happens);
    } else if (obj.cursed && !rn2(100)) {   /* WAND_BACKFIRE_CHANCE */
        note_unported_zap('dozap:backfire');
        return ECMD_TIME;
    } else if (need_dir && !(await getdir(null))) {
        if (!game.u?.ublind)
            note_unported_zap('dozap:glows_and_fades');
        /* make him pay for knowing !NODIR */
    } else if (need_dir && !game.u.dx && !game.u.dy && !game.u.dz) {
        const damage = await zapyourself(obj, true);
        if (damage) {
            note_unported_zap('dozap:losehp');
        }
    } else {
        /* weffects(): the directional/beam engine, recorded */
        note_unported_zap(`dozap:weffects otyp=${obj.otyp}`);
    }
    if (obj && obj.spe < 0) {
        note_unported_zap('dozap:turns_to_dust');
    } else {
        update_inventory(); /* maybe used a charge */
    }
    return ECMD_TIME;
}
