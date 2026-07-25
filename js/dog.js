// dog.js — the starting pet.
// C ref: src/dog.c
//
// makedog() runs between u_on_upstairs() and u_init_inventory_attrs()
// (src/allmain.c:814), not with the rest of hero setup. Getting that ordering
// wrong puts the pet's draws on the wrong side of the inventory's.
//
// The cost is small but very visible in the log: one rn2(2) from pet_type()
// when the role has no fixed pet, then a whole collect_coords() ring shuffle
// from enexto() to place it.

import { game } from './gstate.js';
import { obj_resists } from './zap.js';
import { COLNO, ROWNO } from './const.js';
import { OCLASSES } from './objects_data.js';
import { MFLAGS } from './monst_data.js';
import { rn2 } from './rng.js';
import { PMNAMES } from './monst_data.js';
import { makemon, MM_EDOG, NO_MINVENT } from './makemon.js';

const NON_PM = -1;

// gu.urole.petnum is a PM_ name in the generated role table.
function petnumOf(role) {
    const p = role?.petnum;
    if (typeof p === 'number') return p;
    if (!p || p === 'NON_PM') return NON_PM;
    return PMNAMES[p] !== undefined ? PMNAMES[p] : NON_PM;
}

// src/dog.c:93 pet_type()
export function pet_type() {
    const petnum = petnumOf(game.urole);
    if (petnum !== NON_PM)
        return petnum;
    if (game.preferred_pet === 'c')
        return PMNAMES.PM_KITTEN;
    if (game.preferred_pet === 'd')
        return PMNAMES.PM_LITTLE_DOG;
    return rn2(2) ? PMNAMES.PM_KITTEN : PMNAMES.PM_LITTLE_DOG;
}

// src/dog.c:111 makedog()
export function makedog() {
    if (game.preferred_pet === 'n') {
        game.context.startingpet_typ = NON_PM;
        return null;
    }

    const pettype = game.context.startingpet_typ = pet_type();

    /* NO_MINVENT stops makemon() giving a pony an already-worn saddle */
    const mtmp = makemon(game.mons[pettype], game.u.ux, game.u.uy,
                         MM_EDOG | NO_MINVENT);
    if (!mtmp)
        return null;

    initedog(mtmp);
    return mtmp;
}

// src/dog.c initedog() — tame flags only, no draw.
function initedog(mtmp) {
    mtmp.mtame = 10;
    mtmp.mpeaceful = 1;
    mtmp.mavenge = 0;
    mtmp.mleashed = 0;
}

// ---------------------------------------------------------------------------
// The pet's turn. dog_goal() scans a 5-square radius for something worth
// walking to, and calls dogfood() on every object it finds.
// ---------------------------------------------------------------------------

// include/dog.h — dogfood() return values, best first.
export const DOGFOOD = 0, CADAVER = 1, ACCFOOD = 2, MANFOOD = 3, APPORT = 4,
             POISON = 5, UNDEF = 6, TABU = 7;

// src/dog.c:995 dogfood() — only the part that draws is ported.
//
// The second test is the one that matters for the stream:
//
//     if (is_quest_artifact(obj) || obj_resists(obj, 0, 95))
//
// obj_resists always draws rn2(100) for an ordinary object and, with ochance 0,
// always returns false. So EVERY object the pet looks at costs exactly one
// rn2(100) here — which is why the recordings show obj_resists arriving before
// dog_goal's own rn2(8) rather than after it, even though the C line that names
// can_carry() sits later in the same condition.
export function dogfood(mon, obj) {
    if (obj.opoisoned && !resists_poison(mon))
        return POISON;
    if (is_quest_artifact(obj) || obj_resists(obj, 0, 95))
        return obj.cursed ? TABU : APPORT;

    /* The classification that follows draws nothing: it is a switch on
       oclass and a set of predicate tests. Not ported yet — reaching it is
       recorded so the gap is visible rather than guessed at. */
    note_unported('dogfood classification');
    return UNDEF;
}

/* src/artifact.c is not ported; no session generates a quest artifact this
   early, and the call draws nothing either way. */
function is_quest_artifact(obj) { return false; }

/* src/mondata.h resists_poison() */
function resists_poison(mon) {
    return !!(mon.data?.mresists & MFLAGS.MR_POISON);
}

function note_unported(what) {
    (game.unported ||= new Set()).add(what);
}

// src/dogmove.c:495 dog_goal() — pick somewhere worth walking to.
//
// Only the object search is ported. It walks the level's object list (fobj,
// newest-first) and calls dogfood() on everything inside a 5-square box around
// the pet, so it costs one rn2(100) per nearby object before any of its own
// draws. That is the whole reason obj_resists shows up ahead of dog_goal's
// rn2(8) in the recordings.
const SQSRCHRADIUS = 5;

export function dog_goal(mtmp, edog, after, udist, whappr) {
    const omx = mtmp.mx, omy = mtmp.my;

    const min_x = Math.max(omx - SQSRCHRADIUS, 1);
    const max_x = Math.min(omx + SQSRCHRADIUS, COLNO - 1);
    const min_y = Math.max(omy - SQSRCHRADIUS, 0);
    const max_y = Math.min(omy + SQSRCHRADIUS, ROWNO - 1);

    let gtyp = UNDEF;
    for (const obj of (game.level.objects || [])) {
        const nx = obj.ox, ny = obj.oy;
        if (nx >= min_x && nx <= max_x && ny >= min_y && ny <= max_y) {
            const otyp = dogfood(mtmp, obj);
            /* skip inferior goals */
            if (otyp > gtyp || otyp === UNDEF)
                continue;
            /* the branches past here need cursed_object_at(),
               could_reach_item(), can_reach_location() and m_cansee(); the
               APPORT one draws rn2(8) and then can_carry(). */
            note_unported('dog_goal goal selection');
            break;
        }
    }

    note_unported('dog_goal follow-player');
    return 0;
}

// src/dogmove.c:977 dog_move() — the pet's turn.
//
// dog_hunger() and dog_invent() come first in C and both draw; neither is
// ported, so this reaches dog_goal()'s search only. The stream is right up to
// the point one of those would have fired.
export function dog_move(mtmp, after) {
    const edog = mtmp.mtame ? (mtmp.edog || {}) : null;
    if (!edog) return 0;

    /* src/dogmove.c dog_hunger() draws nothing — it is a comparison of
       moves against edog->hungrytime plus messages. Not ported; when it
       matters it kills a starving pet, which no public session reaches. */
    note_unported('dog_hunger');

    const udist = distu(mtmp.mx, mtmp.my);
    dog_invent(mtmp, edog, udist);
    dog_goal(mtmp, edog, after, udist, 0);
    return 0;
}

// src/dogmove.c:410 dog_invent() — the pet drops what it carries, or picks up
// what it is standing on.
//
// Both halves are guarded, and in the common case — nothing carried, nothing
// underfoot — this draws NOTHING. That is what the recordings show: seed0101
// and seed0102 both go straight from distfleeck to dog_goal's first dogfood.
// Getting the guards right therefore matters as much as the draws.
/* src/dogmove.c:138 nofetch[] = { BALL_CLASS, CHAIN_CLASS, ROCK_CLASS } */
const nofetch = [OCLASSES.BALL_CLASS, OCLASSES.CHAIN_CLASS, OCLASSES.ROCK_CLASS];

export function dog_invent(mtmp, edog, udist) {
    if (helpless(mtmp) || mtmp.meating)
        return 0;

    const omx = mtmp.mx, omy = mtmp.my;

    if (droppables(mtmp)) {
        if (!rn2(udist + 1) || !rn2(edog.apport))
            if (rn2(10) < edog.apport) {
                note_unported('relobj');           /* the drop itself */
                if (edog.apport > 1) edog.apport--;
                edog.dropdist = udist;
                edog.droptime = game.moves;
            }
    } else {
        const obj = (game.level.objects || [])
                        .find(o => o.ox === omx && o.oy === omy);
        if (obj && !nofetch.includes(obj.oclass)) {
            const edible = dogfood(mtmp, obj);

            if (edible <= CADAVER
                || (edog.mhpmax_penalty && edible === ACCFOOD)) {
                /* could_reach_item() and dog_eat() are not ported; dog_eat
                   draws, so stop here rather than guess. */
                note_unported('dog_eat');
                return 0;
            }
            /* can_carry() itself draws nothing, but it and could_reach_item()
               decide whether the rn2(20) below happens at all. */
            note_unported('dog_invent pickup');
        }
    }
    return 0;
}

/* src/mon.c droppables() — the first thing in the pet's pack it would drop.
   Our monsters carry no inventory yet, so this is empty rather than wrong;
   m_initinv() is the gap, and it is recorded there. */
function droppables(mtmp) {
    return (mtmp.minvent && mtmp.minvent.length) ? mtmp.minvent[0] : null;
}

/* src/mondata.h helpless() */
function helpless(mtmp) {
    return !!(mtmp.msleeping || !mtmp.mcanmove || (mtmp.mfrozen | 0) > 0);
}

// src/hack.c distu() — squared distance from the hero.
function distu(x, y) {
    const dx = x - game.u.ux, dy = y - game.u.uy;
    return dx * dx + dy * dy;
}
