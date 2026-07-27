// lock.js — locks, doors and the commands that operate on them.
// C ref: src/lock.c
//
// doopen_indir() is the reason this file exists now: it is the only draw on the
// 'o' command's path, an rnl(20) tested against the average of Strength,
// Dexterity and Constitution, and a session that opens a door runs one call
// short of C without it.

import { game } from './gstate.js';
import { rnl } from './rng.js';
import {
    A_STR, A_DEX, A_CON, D_CLOSED, D_LOCKED, D_NODOOR, D_BROKEN, D_ISOPEN,
    D_TRAPPED, IS_DOOR, ECMD_OK, ECMD_TIME,
} from './const.js';
import { newsym } from './display.js';
import { exercise, acurrstr, ACURR } from './attrib.js';
import { get_adjacent_loc } from './cmd.js';
import { m_at } from './mon.js';
import { is_door_mappear } from './monst.js';
import { canspotmon } from './display.js';
import { M_AP_TYPE, M_AP_FURNITURE, M_AP_OBJECT, OBJ_AT } from './const.js';

function note_unported_lock(what) {
    (game.unported ||= new Set()).add(what);
}

// include/mondata.h verysmall()
function verysmall(ptr) {
    return ptr.msize < 1; /* MZ_SMALL */
}

// src/lock.c doopen_indir() — open the door in the chosen direction.
//
// Only the branch that reaches a known-CLOSED door draws. Everything above it
// is messages and refusals, which cost no PRNG; the draw is rnl(20) against
// (Str + Dex + Con) / 3, so a wrong attribute makes the door open when C says
// it resists without changing the call count.
export async function doopen_indir(x, y) {
    const res = ECMD_OK;
    const cc = { x: 0, y: 0 };

    if (verysmall(game.mons[game.u.umonnum])) {
        /* "You're too small to pull the door open." */
        return res;
    }

    if (x > 0 && y >= 0) {
        cc.x = x;
        cc.y = y;
    } else if (!await get_adjacent_loc(null, null, game.u.ux, game.u.uy, cc)) {
        return ECMD_OK;
    }

    const door = game.level.at(cc.x, cc.y);
    if (!door || !IS_DOOR(door.typ))
        return res;

    if (!(door.doormask & D_CLOSED))
        return res; /* broken / doorless / already open / locked messages */

    /* door is known to be CLOSED */
    if (rnl(20) < Math.trunc((acurrstr() + ACURR(A_DEX) + ACURR(A_CON)) / 3)) {
        /* pline_The("door opens.") */
        if (door.doormask & D_TRAPPED) {
            note_unported_lock('doopen_indir:b_trapped');
            door.doormask = D_NODOOR;
        } else {
            door.doormask = D_ISOPEN;
        }
        newsym(cc.x, cc.y); /* feel_newsym: the hero knows she opened it */
    } else {
        exercise(A_STR, true);
        /* pline_The("door resists!") */
    }

    return ECMD_TIME;
}

// src/lock.c doopen()
export async function doopen() {
    return doopen_indir(0, 0);
}

// src/lock.c:759 stumble_on_door_mimic() — a mimic imitating a door.
//
// Returns TRUE when the "door" turns out to be a monster, which is what stops
// doclose() and doopen_indir() from operating on it.
//
// stumble_onto_mimic() is NOT ported, so the mimic is detected but the
// reveal-and-message half does not happen. Recorded rather than approximated:
// that function wakes the mimic, sets its mappearance and prints, and guessing
// at it would put draws in the stream that C may not make.
export function stumble_on_door_mimic(x, y) {
    const mtmp = m_at(x, y);

    /* Protection_from_shape_changers is an intrinsic we do not model yet; C
       tests it here and a protected hero sees through the mimic instead. */
    if (mtmp && is_door_mappear(mtmp)) {
        note_unported_lock('stumble_on_door_mimic:stumble_onto_mimic');
        return true;
    }
    return false;
}

// src/lock.c:926 obstructed() — is something standing in the doorway?
//
// The mimic arm is the subtle one. A monster mimicking FURNITURE is NOT an
// obstruction (you close the door on it), a monster mimicking an OBJECT jumps
// straight to the object branch via C's `goto objhere`, and anything else
// blocks and is named.
//
// Some_Monnam() is unported, so the "%s blocks the way!" text cannot be built
// faithfully; the message is recorded instead of printed. That matters more
// than it looks -- a message here forces a --More-- when the top line is
// occupied, and a --More-- that C does not make consumes a keystroke the
// session never supplied.
export function obstructed(x, y, quietly) {
    const mtmp = m_at(x, y);
    let objhere = false;

    if (mtmp && M_AP_TYPE(mtmp) !== M_AP_FURNITURE) {
        if (M_AP_TYPE(mtmp) === M_AP_OBJECT) {
            objhere = true;                     /* C: goto objhere */
        } else {
            if (!quietly) {
                /* Some_Monnam() -> Monnam, Someone or Something, and a tail
                   suffix via s_suffix() when the square holds a long worm's
                   tail rather than its head. */
                note_unported_lock('obstructed:blocks_the_way_msg');
            }
            if (!canspotmon(mtmp))
                /* src/display.c:378 map_invisible() remembers the unseen
                   monster as 'I'. Our copy lives in js/mhitm.js and is not
                   exported; it is a display.c function and belongs in
                   js/display.js, so it is recorded here rather than imported
                   across that boundary. */
                note_unported_lock('obstructed:map_invisible');
            return true;
        }
    }
    if (objhere || OBJ_AT(x, y)) {
        if (!quietly)
            note_unported_lock('obstructed:something_in_the_way_msg');
        return true;
    }
    return false;
}
