import { game } from './gstate.js';
import { cmdq_add_ec, cmdq_add_key } from './cmd.js';
import { doswapweapon, dowield, doquiver_core, is_ammo } from './wield.js';
import { is_pole } from './u_init.js';
import { You } from './pline.js';
import { ammo_and_launcher } from './wield.js';
import { ECMD_OK, ECMD_TIME, ECMD_CANCEL, CQ_CANNED } from './const.js';
import { getobj, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, GETOBJ_DOWNPLAY,
         GETOBJ_PROMPT, GETOBJ_ALLOWCNT } from './invent.js';
import { OCLASSES, ONAMES } from './objects_data.js';
import { throws_rocks } from './mondata.js';
import { getdir } from './cmd.js';

// dothrow.js — throwing, firing, and the path a thrown thing takes.
// C ref: src/dothrow.c
//
// walk_path() is here first because several unrelated things need it: jump()
// walks the hero's leap through it, throwit() walks a missile, and the polearm
// code checks reach with it. It draws nothing at all — it is pure geometry —
// but every caller decides where something ENDS UP from its result, and a
// wrong endpoint moves the hero or an object without costing a single PRNG
// call, which is the kind of divergence the RNG log cannot show.

// src/dothrow.c throw_obj() — ask a direction, then throw.
//
// res starts at ECMD_TIME and only a cancelled getdir() changes it, so a throw
// that reaches this point takes a turn. The throw itself needs the multishot,
// trajectory and damage code; what is ported is the direction read, which is
// the second of the two extra keys 't' costs.
export async function throw_obj(obj, shotlimit) {
    const res = ECMD_TIME;

    /* ask "in what direction?" */
    if (!await getdir(null))
        return ECMD_OK; /* ECMD_CANCEL — no time passes */

    note_unported_dothrow('throw_obj:throwit');
    return res;
}

// src/dothrow.c dothrow() — the 't' command.
//
// ok_to_throw() reads nothing (it only fails for notake, nohands or being
// overloaded), then getobj() takes the object letter and throw_obj() the
// direction. Three keys in total, and leaving them unconsumed ran both as
// commands.
// src/dothrow.c throw_ok() — which objects getobj should suggest for 't'.
//
// The '-' choice is EXCLUDED outright, so the prompt has no "- " prefix the
// way the quiver's does. A wielded single item is downplayed but still
// selectable; coins and weapons are suggested, gems only when slinging.
function throw_ok(obj) {
    if (!obj)
        return GETOBJ_EXCLUDE;

    /* welded/AutoReturn/Mjollnir need the wield and artifact code */
    if (obj.quan === 1
        && (obj === game.u.uwep || (obj === game.u.uswapwep && game.u.twoweap)))
        return GETOBJ_DOWNPLAY;

    if (obj.oclass === OCLASSES.COIN_CLASS)
        return GETOBJ_SUGGEST;

    /* uslinging() needs the wielded launcher's skill; a sling is rare enough
       that the not-slinging arm is the one every recorded session takes. */
    if (obj.oclass === OCLASSES.WEAPON_CLASS)
        return GETOBJ_SUGGEST;

    /* gy.youmonst.data is the hero's current form; this port keeps it as
       u.umonnum indexing game.mons. Guarded because the boulder arm is only
       reachable for a rock-throwing polyform. */
    const uptr = game.mons?.[game.u?.umonnum];
    if (uptr && throws_rocks(uptr) && obj.otyp === ONAMES.BOULDER)
        return GETOBJ_SUGGEST;

    return GETOBJ_DOWNPLAY;
}

export async function dothrow() {
    const obj = await getobj('throw', throw_ok, GETOBJ_PROMPT | GETOBJ_ALLOWCNT);

    return obj ? await throw_obj(obj, 0) : ECMD_OK;
}

function note_unported_dothrow(what) {
    (game.unported ||= new Set()).add(what);
}

// src/dothrow.c:656 walk_path() — Bresenham from src to dest, calling
// check_proc at every step and stopping early when it returns false.
//
// On failure dest_cc is rewritten to the LAST square that passed, which is how
// callers learn where the path was blocked. C's comment notes the algorithm
// handles slanted moves suboptimally — a diagonal that clips a corner fails
// rather than routing around it — and that quirk is part of the behaviour.
export function walk_path(src_cc, dest_cc, check_proc, arg) {
    let err;
    let x, y, dx, dy, x_change, y_change, i, prev_x, prev_y;
    let keep_going = true;

    dx = dest_cc.x - src_cc.x;
    dy = dest_cc.y - src_cc.y;
    prev_x = x = src_cc.x;
    prev_y = y = src_cc.y;

    if (dx < 0) {
        x_change = -1;
        dx = -dx;
    } else {
        x_change = 1;
    }
    if (dy < 0) {
        y_change = -1;
        dy = -dy;
    } else {
        y_change = 1;
    }
    i = err = 0;
    if (dx < dy) {
        while (i++ < dy) {
            prev_x = x;
            prev_y = y;
            y += y_change;
            err += dx << 1;
            if (err > dy) {
                x += x_change;
                err -= dy << 1;
            }
            /* check for early exit condition */
            if (!(keep_going = check_proc(arg, x, y)))
                break;
        }
    } else {
        while (i++ < dx) {
            prev_x = x;
            prev_y = y;
            x += x_change;
            err += dy << 1;
            if (err > dx) {
                y += y_change;
                err -= dx << 1;
            }
            /* check for early exit condition */
            if (!(keep_going = check_proc(arg, x, y)))
                break;
        }
    }

    if (keep_going)
        return true; /* successful */

    dest_cc.x = prev_x;
    dest_cc.y = prev_y;
    return false;
}

// src/dothrow.c:447 find_launcher() — the launcher in inventory matching this
// ammo, preferring one whose B/U/C is known not-cursed; a known-cursed one is
// skipped outright and an unknown one is the fallback.
export function find_launcher(ammo) {
    let oX = null;

    if (!ammo)
        return null;

    for (const otmp of (game.invent || [])) {
        if (otmp.cursed && otmp.bknown)
            continue; /* known to be cursed, so skip */
        if (ammo_and_launcher(ammo, otmp)) {
            if (otmp.bknown)
                return otmp; /* known-B or known-U (known-C won't get here) */
            if (!oX)
                oX = otmp; /* unknown-BUC; used if no known-BU item found */
        }
    }
    return oX;
}

/*
 * src/dothrow.c:469 dofire() — the 'f' command: fire from the quiver.
 *
 * The shot-count prefix (ok_to_throw/shotlimit) cannot arise here because
 * this port's input path has no count prefixes, so shotlimit is always 0.
 * The polearm/bullwhip arms, autoquiver, and the throw-and-return artifact
 * head are recorded where their state can occur.
 */
export async function dofire() {
    const shotlimit = 0;
    let obj;
    let skip_fireassist = false;
    let res = ECMD_OK;

    if (game.u.uwep && game.u.uwep.oartifact)
        note_unported_dothrow('dofire:AutoReturn');

    obj = game.u.uquiver;
    if (!obj) {
        if (!game.flags.autoquiver) {
            /* if we're wielding a polearm, apply it */
            if (game.u.uwep && is_pole(game.u.uwep)) {
                note_unported_dothrow('dofire:use_pole');
                return ECMD_OK;
            /* if we're wielding a bullwhip, apply it */
            } else if (game.u.uwep && game.u.uwep.otyp === ONAMES.BULLWHIP) {
                note_unported_dothrow('dofire:use_whip');
                return ECMD_OK;
            } else if ((game.iflags.fireassist !== false)
                       && game.u.uswapwep && is_pole(game.u.uswapwep)
                       && !(game.u.uswapwep.cursed && game.u.uswapwep.bknown)) {
                /* we have a known not-cursed polearm as swap weapon.
                   swap to it and retry */
                cmdq_add_ec(CQ_CANNED, doswapweapon);
                cmdq_add_ec(CQ_CANNED, dofire);
                return ECMD_OK; /* haven't taken any time yet */
            } else {
                await You("have no ammunition readied.");
            }
        } else {
            note_unported_dothrow('dofire:autoquiver');
        }
    }

    /* if autoquiver is disabled or has failed, prompt for missile */
    if (!obj) {
        /* this gives its own feedback about populating the quiver slot */
        res = await doquiver_core("fire");
        if (res !== ECMD_OK && res !== ECMD_TIME)
            return res;

        obj = game.u.uquiver;
    }

    if (game.u.uquiver && is_ammo(game.u.uquiver)
        && (game.iflags.fireassist !== false) /* optlist.h:309 — default On */
        && !skip_fireassist) {
        let olauncher;

        if (game.u.uwep && is_pole(game.u.uwep)) {
            note_unported_dothrow('dofire:use_pole');
            return ECMD_OK;
        }
        /* Try to find a launcher */
        if (ammo_and_launcher(game.u.uquiver, game.u.uwep)) {
            obj = game.u.uquiver;
        } else if (ammo_and_launcher(game.u.uquiver, game.u.uswapwep)) {
            /* swap weapons and retry fire */
            cmdq_add_ec(CQ_CANNED, doswapweapon);
            cmdq_add_ec(CQ_CANNED, dofire);
            return res;
        } else if ((olauncher = find_launcher(game.u.uquiver)) != null) {
            /* wield launcher, retry fire */
            if (game.u.uwep && !game.flags.pushweapon)
                cmdq_add_ec(CQ_CANNED, doswapweapon);
            cmdq_add_ec(CQ_CANNED, dowield);
            cmdq_add_key(CQ_CANNED, olauncher.invlet);
            cmdq_add_ec(CQ_CANNED, dofire);
            return res;
        }
    }

    const altres = obj ? await throw_obj(obj, shotlimit) : ECMD_CANCEL;
    /* fire can take time by filling quiver (if that causes something which
       was wielded to be unwielded) even if the throw itself gets cancelled */
    return (res === ECMD_TIME) ? res : altres;
}
