// eat.js — nutrition.
// C ref: src/eat.c
//
// Only gethungry()'s once-per-turn draw is ported. 5.0 randomised the trigger:
// it used to be (moves % 20), and is now an explicit rn2(20), which is why a
// port that tracks the turn counter correctly still has to make the call.

import { game } from './gstate.js';
import { done } from './end.js';
import { rn2 } from './rng.js';
import { NOT_HUNGRY, ECMD_OK, ECMD_TIME } from './const.js';
import { getobj } from './invent.js';

// src/eat.c:3170 gethungry()
export function gethungry() {
    const u = game.u;

    if (u.uinvulnerable)
        return;                       /* forced to fast while praying */

    /* src/eat.c:3191 — rn2(20) replaces the old (int) (svm.moves % 20L) */
    const accessorytime = rn2(20);

    if (accessorytime % 2) {
        /* regeneration and encumbrance burn food; neither is ported */
    } else {
        /* ring of hunger / slow digestion; not ported */
    }

    if (u.uhunger !== undefined)
        u.uhunger--;
}

// src/eat.c:126 init_uhunger() — the hero starts well fed.
//
// exerper() reads uhunger every tenth move to decide which attribute to
// exercise, and each branch spends a different draw: NOT_HUNGRY exercises
// Constitution with rn2(19), while SATIATED and FAINTING both decrement with
// rn2(2). Leaving uhunger unset made every comparison fall through to FAINTING
// and drew the wrong one.
export function init_uhunger() {
    game.u.uhunger = 900;
    game.u.uhs = NOT_HUNGRY;
}

// src/eat.c floorfood() — offer each edible thing at the hero's feet with a
// y/n prompt, then fall through to getobj() for something carried.
//
// Each floor prompt reads ONE key, so the total depends on what is underfoot:
// a bear trap, iron bars, gold and a food item each add one. That makes the
// count data-dependent, and our floor contents are known to differ from C's on
// some levels, so guessing it would misalign a session rather than fix it.
// Only the clean case is ported — nothing edible underfoot, straight to
// getobj — and anything else is recorded.
export async function floorfood(verb, corpsecheck) {
    const here = (game.level?.objects || [])
        .filter(o => o.ox === game.u.ux && o.oy === game.u.uy);
    const trap = (game.level?.traps || [])
        .find(t => t.tx === game.u.ux && t.ty === game.u.uy);

    if (trap || here.length) {
        note_unported_eat('floorfood:floor prompts');
        return null;
    }

    return await getobj(verb, null, 0);
}

// src/eat.c doeat() — the 'e' command.
//
// The eating itself needs the nutrition, corpse and tin code. What is ported is
// the object prompt, because a session that eats and does not have its
// inventory letter consumed runs that letter as a command instead.
export async function doeat() {
    const otmp = await floorfood('eat', 0);

    if (!otmp)
        return ECMD_OK;

    note_unported_eat('doeat:eating');
    return ECMD_TIME;
}

function note_unported_eat(what) {
    (game.unported ||= new Set()).add(what);
}

// src/eat.c:245 choke() — the hero eats past Satiated and dies.
//
// This is seed0030's first death and the blocker for seven sessions. The
// guard is the SATIATED state, not the food: eating an ordinary meal chokes
// only when u.uhs is already SATIATED, and anything else returns immediately
// unless it is an amulet of strangulation.
//
// The rn2(20) is the only draw, and it is short-circuited by Breathless or
// Hunger, so a hero with either spends nothing here.
export function choke(food) {
    /* only happens if you were satiated */
    if (game.u.uhs !== SATIATED) {
        if (!food || food.otyp !== ONAMES.AMULET_OF_STRANGULATION)
            return;
    } else if (Role_if(PM_KNIGHT) && game.u.ualign?.type === A_LAWFUL) {
        note_unported_eat('choke:adjalign');   /* gluttony is unchivalrous */
    }

    note_unported_eat('choke:exercise');

    /* Breathless and Hunger are intrinsics this port does not track, so the
       rn2(20) is always the deciding test here. */
    if (!rn2(20)) {
        if (food && food.otyp === ONAMES.AMULET_OF_STRANGULATION)
            return;                     /* "choke, but recover your composure" */
    }

    game.killer = { format: KILLED_BY, name: 'quick snack' };
    pline('You choke over it.');
    pline('You die...');
    done(CHOKING);
}

// src/eat.c:3132 bite() — one turn of eating. Returns 1 if the hero choked and
// survived, 0 otherwise.
//
// The choke gate is the whole reason this function matters here:
//
//     if (victual.canchoke && u.uhunger >= 2000) { choke(piece); return 1; }
//
// so the death is a consequence of ACCUMULATED nutrition, not of the meal.
export function bite() {
    const v = game.context?.victual;
    if (!v)
        return 0;

    if (v.canchoke && game.u.uhunger >= 2000) {
        choke(v.piece);
        return 1;
    }
    if (v.doreset) {
        note_unported_eat('bite:do_reset_eat');
        return 0;
    }
    note_unported_eat('bite:nutrition');
    return 0;
}
