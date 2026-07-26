// dogmove.js — pet movement and the eating bookkeeping that goes with it.
// C ref: src/dogmove.c
//
// The file exists now but holds only what has been ported. dog_move itself
// (the pet's per-turn decision, src/dogmove.c around line 1150) is NOT here,
// and it is the first divergence for 7 of the 44 public sessions -- the
// single largest blocker in the port. See docs/plan/STATUS.md for its shape
// and the traps in it (the reservoir sampler at dogmove.c:1255 uses a
// PRE-increment, rn2(++chcnt)).

import { game } from './gstate.js';
import { M_AP_TYPE, M_AP_NOTHING, MMOVE_NOTHING, MMOVE_MOVED, MMOVE_DIED,
         MMOVE_DONE, EDOG, has_edog } from './const.js';
import { distu } from './hacklib.js';
import { DEADMONSTER } from './monst.js';
import { carnivorous, herbivorous } from './mondata.js';
import { cansee, couldsee } from './vision.js';
import { newsym } from './display.js';
import { MONSYMS } from './monst_data.js';

// src/dogmove.c:1448 finish_meating() — the monster stops eating.
//
// Not just a flag clear. A monster that was eating a MIMIC has taken on the
// mimic's appearance, and that appearance has to be reset and the square
// redrawn, or the pet keeps rendering as whatever it was chewing on.
//
// The mlet test excludes real mimics: an actual mimic that stops eating keeps
// its disguise, because the disguise is what it is rather than what it ate.
export function finish_meating(mtmp) {
    mtmp.meating = 0;
    if (M_AP_TYPE(mtmp) !== M_AP_NOTHING
        && game.mons[mtmp.mnum].mlet !== MONSYMS.S_MIMIC) {
        /* was eating a mimic and now appearance needs resetting */
        mtmp.m_ap_type = M_AP_NOTHING;
        mtmp.mappearance = 0;
        newsym(mtmp.mx, mtmp.my);
    }
}

// src/dogmove.c:9-11 — file-local hunger thresholds, in turns since the pet
// last ate. C keeps these private to dogmove.c, so they live here too.
const DOG_HUNGRY = 300;
const DOG_WEAK   = 500;
const DOG_STARVE = 750;

// src/dogmove.c:362 dog_hunger() — the pet gets weak, then starves.
//
// No draw. The three arms below the DOG_WEAK gate are mutually exclusive and
// their ORDER encodes the rule:
//
//   neither carnivore nor herbivore  cannot starve at all: hungrytime is
//                                    just pushed forward. C notes it is kept
//                                    from going too high because the pet
//                                    might polymorph into something that CAN
//                                    starve.
//   first time weak                  mhpmax is cut to a THIRD and the lost
//                                    amount is stored in mhpmax_penalty, not
//                                    discarded, so feeding can give it back.
//                                    mconf is set: a starving pet is confused.
//   already penalised, past STARVE   dies.
//
// The DEADMONSTER check inside the second arm matters: cutting mhpmax to a
// third can drop mhp below 1 on its own, so a pet can die from the penalty
// itself rather than from reaching DOG_STARVE.
//
// dog_starve and the four message variants are recorded; every state change
// is real.
export function dog_hunger(mtmp, edog) {
    if (game.moves > edog.hungrytime + DOG_WEAK) {
        const ptr = game.mons[mtmp.mnum];
        if (!carnivorous(ptr) && !herbivorous(ptr)) {
            edog.hungrytime = game.moves + DOG_WEAK;
            /* but not too high; it might polymorph */
        } else if (!edog.mhpmax_penalty) {
            /* starving pets are limited in healing */
            const newmhpmax = (mtmp.mhpmax / 3) | 0;
            mtmp.mconf = 1;
            edog.mhpmax_penalty = mtmp.mhpmax - newmhpmax;
            mtmp.mhpmax = newmhpmax;
            if (mtmp.mhp > mtmp.mhpmax)
                mtmp.mhp = mtmp.mhpmax;
            if (DEADMONSTER(mtmp)) {
                note_dogmove_unported('dog_hunger:dog_starve');
                return true;
            }
            if (cansee(mtmp.mx, mtmp.my))
                note_dogmove_unported('dog_hunger:confused_msg');
            else if (couldsee(mtmp.mx, mtmp.my))
                note_dogmove_unported('dog_hunger:beg');
            else
                note_dogmove_unported('dog_hunger:worried_msg');
            note_dogmove_unported('dog_hunger:stop_occupation');
        } else if (game.moves > edog.hungrytime + DOG_STARVE
                   || DEADMONSTER(mtmp)) {
            note_dogmove_unported('dog_hunger:dog_starve');
            return true;
        }
    }
    return false;
}

// src/dogmove.c:977 dog_move() — the pet's per-turn decision.
//
// HEAD ONLY. 381 lines in C. This is the first divergence for 7 of the 44
// public sessions (8 once the combat gate is wired), so it is the largest
// single blocker in the port; the position-scoring loop that follows this
// head is the part that draws, and it is NOT here yet. See STATUS.
//
// The early returns are ported because every pet turn passes through them
// and each one has a distinct return value the caller branches on:
//
//   no edog and not a minion   MMOVE_NOTHING, after impossible(). Tame
//                              ANGELS have isminion and an ispriest struct
//                              instead of an edog, which is why the test is
//                              not simply has_edog.
//   dog_hunger says starved    MMOVE_DIED
//   steed under Conflict       thrown, MMOVE_MOVED
//   udist == 0                 MMOVE_NOTHING -- tamed while swallowed
//   dog_invent returns 2       MMOVE_DIED or MMOVE_DONE by DEADMONSTER
//   dog_invent returns 1       jumps straight to newdogpos: it is eating
//
// Note udist is FORCED to 1 for a steed rather than measured: you are on it,
// so the distance is definitionally adjacent, and that feeds the approach
// logic below.
//
// dog_hunger, dog_invent, mon_offmap, resist_conflict and dismount_steed are
// recorded. The scoring loop and newdogpos are absent, so this returns
// MMOVE_NOTHING at the end rather than guessing a move.
export function dog_move(mtmp, after) {
    const edog = (mtmp.mtame && has_edog(mtmp)) ? EDOG(mtmp) : 0;
    let udist, whappr;

    /* Tame Angels have isminion set and an ispriest structure instead of an
       edog structure. */
    if (!edog && !mtmp.isminion) {
        note_dogmove_unported('dog_move:impossible_non_pet');
        return MMOVE_NOTHING;
    }

    const omx = mtmp.mx, omy = mtmp.my;
    if (edog && dog_hunger(mtmp, edog))
        return MMOVE_DIED;                      /* starved */

    udist = distu(omx, omy);
    /* Let steeds eat and maybe throw rider during Conflict */
    if (mtmp === game.u.usteed) {
        if (game.u.uprops?.CONFLICT
            && !note_dogmove_unported('dog_move:resist_conflict')) {
            note_dogmove_unported('dog_move:dismount_steed');
            return MMOVE_MOVED;
        }
        udist = 1;
    } else if (!udist) {
        /* maybe we tamed him while being swallowed --jgm */
        return MMOVE_NOTHING;
    }

    if (edog) {
        const j = note_dogmove_unported('dog_move:dog_invent') ? 1 : 0;
        if (j === 2 || note_dogmove_unported('dog_move:mon_offmap'))
            return DEADMONSTER(mtmp) ? MMOVE_DIED : MMOVE_DONE;
        /* j === 1 would goto newdogpos (eating); newdogpos is not ported */

        whappr = ((game.moves - edog.whistletime) < 5);
    } else
        whappr = 0;

    /* THE POSITION-SCORING LOOP IS NOT PORTED. It is where the draws are:
       rn2(MTSZ * (k - j)) in the mtrack backtrack check, then
       rn2(++chcnt) -- a reservoir sampler over equally-good squares, and the
       PRE-increment is load-bearing -- plus rn2(3) and rn2(12).
       Returning MMOVE_NOTHING rather than guessing a move. */
    note_dogmove_unported('dog_move:scoring_loop');
    return MMOVE_NOTHING;
}

function note_dogmove_unported(what) {
    (game.unported ||= new Set()).add('dogmove:' + what);
    return false;
}
