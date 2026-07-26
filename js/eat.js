// eat.js — nutrition.
// C ref: src/eat.c
//
// Only gethungry()'s once-per-turn draw is ported. 5.0 randomised the trigger:
// it used to be (moves % 20), and is now an explicit rn2(20), which is why a
// port that tracks the turn counter correctly still has to make the call.

import { game } from './gstate.js';
import { done } from './end.js';
import { set_occupation } from './allmain.js';
import { rn2 } from './rng.js';
import { NOT_HUNGRY, ECMD_OK, ECMD_TIME, SATIATED, KILLED_BY, CHOKING,
         A_LAWFUL } from './const.js';
import { ONAMES } from './objects_data.js';
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

    /* src/eat.c doeat() tail — the tin, corpse and conduct arms above this
       need their own subsystems; what is ported is the ordinary-food path,
       which is the one that reaches choke(). */
    if (otmp.otyp === ONAMES.TIN || otmp.otyp === ONAMES.CORPSE
        || otmp.globby) {
        note_unported_eat('doeat:tin_or_corpse');
        return ECMD_TIME;
    }

    const v = (game.context.victual ||= {});
    v.piece = otmp;
    v.o_id = otmp.o_id;
    v.usedtime = 0;
    v.reqtime = game.objects[otmp.otyp].oc_delay;

    /* nutrition units per round eating */
    if (v.reqtime === 0 || !otmp.oeaten)
        v.nmod = 0;
    else if (otmp.oeaten >= v.reqtime)
        v.nmod = -Math.trunc(otmp.oeaten / v.reqtime);
    else
        v.nmod = v.reqtime % otmp.oeaten;

    /* THE death condition: latched ONCE here from the hunger state at the
       moment the meal starts, not re-tested per bite. */
    v.canchoke = (game.u.uhs === SATIATED);

    start_eating(otmp, false);
    return ECMD_TIME;
}

// src/eat.c start_eating() — begin (or resume) a meal.
//
// bite() is called BEFORE usedtime is incremented, so a one-turn meal eaten
// while Satiated chokes on the very first call rather than after finishing.
export function start_eating(otmp, already_partly_eaten) {
    const v = game.context.victual;

    v.fullwarn = 0;
    v.doreset = 0;
    v.eating = 1;

    if (bite()) {
        /* survived choking; finish off food that is nearly done */
        if (++v.usedtime >= v.reqtime)
            note_unported_eat('start_eating:done_eating');
        return;
    }

    if (++v.usedtime >= v.reqtime) {
        note_unported_eat('start_eating:done_eating');
        return;
    }

    set_occupation(eatfood, `eating ${otmp.oname ?? ''}`, 0);
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
    } else {
        /* Role_if(PM_KNIGHT) && u.ualign.type == A_LAWFUL -> adjalign(-1),
           "gluttony is unchivalrous". Needs the hero's role and alignment
           record; it changes no draw. */
        note_unported_eat('choke:knight_adjalign');
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

// src/eat.c eatfood() — the occupation callback. Returns 1 while still busy,
// 0 when the meal is over (or was interrupted).
//
// usedtime is incremented BEFORE bite(), and the test is <= reqtime rather
// than < , so the last turn of a meal still takes a bite. Writing it as < , or
// biting before incrementing, drops that final bite -- and for a Satiated hero
// that final bite is the one that chokes.
export function eatfood() {
    const v = game.context.victual;
    let food = v?.piece;

    if (food && !carried(food) && !obj_here(food, game.u.ux, game.u.uy))
        food = null;
    if (!food) {
        /* maybe it was stolen? */
        note_unported_eat('eatfood:do_reset_eat');
        return 0;
    }
    if (!v.eating)
        return 0;

    if (++v.usedtime <= v.reqtime) {
        if (bite())
            return 0;
        return 1;                       /* still busy */
    }
    note_unported_eat('eatfood:done_eating');
    return 0;
}

// src/invent.c carried() — is this object in the hero's inventory?
const carried = (o) => (game.invent || []).includes(o);

// src/invent.c obj_here() — is this object on that square?
const obj_here = (o, x, y) => o.ox === x && o.oy === y;
