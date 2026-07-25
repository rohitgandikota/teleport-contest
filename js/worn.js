// worn.js — what a monster or the hero currently has on.
// C ref: src/worn.c
//
// Nothing here draws.

import { game } from './gstate.js';
import { W_ARM, W_ARMC, W_ARMH, W_ARMS, W_ARMG, W_ARMF, W_ARMU, W_AMUL } from './const.js';
import { OCLASSES, ONAMES } from './objects_data.js';
import { MFLAGS, MONSYMS, PMNAMES } from './monst_data.js';
import { verysmall, nohands, is_animal, mindless, slithy, cantweararm,
         has_horns } from './mondata.js';
import { is_shirt, is_cloak, is_helmet, is_shield, is_gloves, is_boots,
         is_suit, is_flimsy, bimanual, WrappingAllowed } from './obj.js';
import { ARM_BONUS } from './do_wear.js';

// src/worn.c which_armor() — the object worn in a given slot, or null.
//
// Monsters do not don armour in this port yet (m_dowear is absent), so the
// minvent scan finds nothing for them. That is the honest answer for a monster
// carrying an unworn shield, and it is the same answer the C gives; it becomes
// wrong only once m_dowear exists, at which point this needs no change.
export function which_armor(mon, flag) {
    if (mon === game.youmonst) {
        switch (flag) {
        case W_ARM:  return game.uarm  || null;
        case W_ARMC: return game.uarmc || null;
        case W_ARMH: return game.uarmh || null;
        case W_ARMS: return game.uarms || null;
        case W_ARMG: return game.uarmg || null;
        case W_ARMF: return game.uarmf || null;
        case W_ARMU: return game.uarmu || null;
        default:     return null;   /* impossible("bad flag in which_armor") */
        }
    } else {
        for (const obj of (mon.minvent || []))
            if (obj.owornmask & flag)
                return obj;
        return null;
    }
}

// src/worn.c:757 m_dowear() — try every armour slot in the C's order.
//
// Reached by 20% of random games (tools/generalize.mjs). Neither this nor
// m_dowear_type contains a single rn2/rnd/rn1, so it cannot move the RNG
// stream directly; what it does is set owornmask and misc_worn_check, which
// nothing else in this port sets, and which which_armor(), can_touch_safely()
// and mfndpos()' dig arm all read.
export function m_dowear(mon, creation) {
    const RACE_EXCEPTION = true;
    const data = game.mons[mon.mnum];

    /* Note the restrictions here are the same as in dowear in do_wear.c
     * except for the additional restriction on intelligence. */
    if (verysmall(data) || nohands(data) || is_animal(data))
        return;
    /* give mummies a chance to wear their wrappings
     * and let skeletons wear their initial armor */
    if (mindless(data)
        && (!creation || (data.mlet !== MONSYMS.S_MUMMY
                          && data.pmidx !== PMNAMES.PM_SKELETON)))
        return;

    m_dowear_type(mon, W_AMUL, creation, false);
    const can_wear_armor = !cantweararm(data); /* for suit, cloak, shirt */
    /* can't put on shirt if already wearing suit */
    if (can_wear_armor && !(mon.misc_worn_check & W_ARM))
        m_dowear_type(mon, W_ARMU, creation, false);
    if (can_wear_armor || WrappingAllowed(data))
        m_dowear_type(mon, W_ARMC, creation, false);
    m_dowear_type(mon, W_ARMH, creation, false);
    if (!MON_WEP(mon) || !bimanual(MON_WEP(mon)))
        m_dowear_type(mon, W_ARMS, creation, false);
    m_dowear_type(mon, W_ARMG, creation, false);
    if (!slithy(data) && data.mlet !== MONSYMS.S_CENTAUR)
        m_dowear_type(mon, W_ARMF, creation, false);
    if (can_wear_armor)
        m_dowear_type(mon, W_ARM, creation, false);
    else
        m_dowear_type(mon, W_ARM, creation, RACE_EXCEPTION);
}

// include/monst.h:210 MON_WEP() — monsters do not wield in this port yet.
const MON_WEP = (mon) => mon.mw || null;

// src/worn.c:799 m_dowear_type() — pick the best item for one slot and wear it.
function m_dowear_type(mon, flag, creation, racialexception) {
    let old, best, oldmask = 0, m_delay = 0;
    const data = game.mons[mon.mnum];

    if (mon.mfrozen)
        return; /* probably putting previous item on */

    old = which_armor(mon, flag);
    if (old && old.cursed)
        return;
    if (old && flag === W_AMUL && old.otyp !== ONAMES.AMULET_OF_GUARDING)
        return; /* no amulet better than life-saving or reflection */
    best = old;

    let outer_break = false;
    for (const obj of (mon.minvent || [])) {
        if (outer_break) break;
        switch (flag) {
        case W_AMUL:
            if (obj.oclass !== OCLASSES.AMULET_CLASS
                || (obj.otyp !== ONAMES.AMULET_OF_LIFE_SAVING
                    && obj.otyp !== ONAMES.AMULET_OF_REFLECTION
                    && obj.otyp !== ONAMES.AMULET_OF_GUARDING))
                continue;
            if (!best || obj.otyp !== ONAMES.AMULET_OF_GUARDING) {
                best = obj;
                if (best.otyp !== ONAMES.AMULET_OF_GUARDING) {
                    outer_break = true; /* life-saving or reflection; use it */
                    break;
                }
            }
            continue; /* skip post-switch armor handling */
        case W_ARMU:
            if (!is_shirt(obj)) continue;
            break;
        case W_ARMC:
            if (!is_cloak(obj)) continue;
            /* mummy wrapping is only cloak allowed when bigger than human */
            if (data.msize > MFLAGS.MZ_HUMAN && obj.otyp !== ONAMES.MUMMY_WRAPPING)
                continue;
            /* the minvis/See_invisible arm needs the invisibility state */
            break;
        case W_ARMH:
            if (!is_helmet(obj)) continue;
            if (obj.otyp === ONAMES.HELM_OF_OPPOSITE_ALIGNMENT
                && (mon.ispriest || mon.isminion))
                continue;
            /* (flimsy exception matches polyself handling) */
            if (has_horns(data) && !is_flimsy(obj))
                continue;
            break;
        case W_ARMS:
            if (!is_shield(obj)) continue;
            break;
        case W_ARMG:
            if (!is_gloves(obj)) continue;
            break;
        case W_ARMF:
            if (!is_boots(obj)) continue;
            break;
        case W_ARM:
            if (!is_suit(obj)) continue;
            if (racialexception && (racial_exception(mon, obj) < 1))
                continue;
            break;
        }
        if (outer_break) break;
        if (obj.owornmask)
            continue;
        if (best && (ARM_BONUS(best) + extra_pref(mon, best)
                     >= ARM_BONUS(obj) + extra_pref(mon, obj)))
            continue;
        best = obj;
    }

    if (!best || best === old)
        return;

    /* same auto-cursing behavior as for hero */
    const autocurse = ((best.otyp === ONAMES.HELM_OF_OPPOSITE_ALIGNMENT
                        || best.otyp === ONAMES.DUNCE_CAP) && !best.cursed);
    /* if wearing a cloak, account for the time spent removing and re-wearing
       it when putting on a suit or shirt */
    if ((flag === W_ARM || flag === W_ARMU) && (mon.misc_worn_check & W_ARMC))
        m_delay += 2;
    if (old) {
        m_delay += game.objects[old.otyp].oc_delay;
        oldmask = old.owornmask;        /* needed later by artifact_light() */
        old.owornmask = 0;              /* avoid doname() "(being worn)" */
    }

    if (!creation) {
        /* the "<Mon> puts on <armour>." messages need doname/Monnam */
        m_delay += game.objects[best.otyp].oc_delay;
        mon.mfrozen = m_delay;
        if (mon.mfrozen)
            mon.mcanmove = 0;
    }
    if (old) {
        update_mon_extrinsics(mon, old, false, creation);
        old.owornmask = 0;
        /* artifact_light()/end_burn() need the light-source code */
    }
    mon.misc_worn_check |= flag;
    best.owornmask |= flag;
    if (autocurse)
        best.cursed = true;             /* curse(best) */
    update_mon_extrinsics(mon, best, true, creation);
}

// src/worn.c extra_pref() — currently only speed boots.
function extra_pref(mon, obj) {
    if (obj) {
        if (obj.otyp === ONAMES.SPEED_BOOTS && mon.permspeed !== MFAST)
            return 20;
    }
    return 0;
}

// src/worn.c racial_exception() — hobbits may wear elven armour (LoTR).
function racial_exception(mon, obj) {
    /* raceptr(mon) is the monster's own permonst unless it is the hero */
    if (game.mons[mon.mnum].pmidx === PMNAMES.PM_HOBBIT && is_elven_armor(obj))
        return 1;
    return 0;
}

// include/obj.h:299 is_elven_armor()
const is_elven_armor = (o) =>
    o.otyp === ONAMES.ELVEN_LEATHER_HELM || o.otyp === ONAMES.ELVEN_MITHRIL_COAT
    || o.otyp === ONAMES.ELVEN_CLOAK || o.otyp === ONAMES.ELVEN_SHIELD
    || o.otyp === ONAMES.ELVEN_BOOTS;

/* src/worn.c update_mon_extrinsics() — grants and revokes the properties an
   item confers. Monster intrinsics are not tracked in this port, so there is
   nothing yet to update; the slot bookkeeping above is the part that matters
   to which_armor() and it is done. */
function update_mon_extrinsics(mon, obj, on, silently) {
    note_unported_worn('update_mon_extrinsics');
}

const MFAST = 2;   /* include/monst.h — permspeed value */

function note_unported_worn(what) {
    (game.unported ||= new Set()).add(what);
}
