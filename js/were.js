// were.js — lycanthropes.
// C ref: src/were.c
//
// were_change() draws every turn boundary for every werecreature on the
// level (the rn2 whose size depends on day/night and moon phase), so a
// level with a werejackal on it desyncs immediately without this.

import { game } from './gstate.js';
import { rn1, rn2, rnd } from './rng.js';
import { pline } from './display.js';
import { You_hear } from './pline.js';
import { Monnam, pmname } from './do_name.js';
import { canseemon } from './display.js';
import { newsym } from './display.js';
import { helpless } from './monst.js';
import { healmon, wake_nearto } from './mon.js';
import { is_human } from './mondata.js';
import { MFLAGS, PMNAMES } from './monst_data.js';
import { night } from './calendar.js';
import { Deaf, Hallucination, Protection_from_shape_changers }
    from './youprop.js';
import { FULL_MOON, NO_MM_FLAGS } from './const.js';

/* include/mondata.h:96 is_were() */
export const is_were = (ptr) => (ptr.mflags2 & MFLAGS.M2_WERE) !== 0;

// src/were.c:140 were_summon(). Return the counts and generic species name
// which summonmu() uses for its visible and unseen feedback.
export async function were_summon(ptr, yours) {
    let visible = 0;
    let total = 0;
    let generic = 'creature';

    if (Protection_from_shape_changers() && !yours)
        return { total, visible, generic };

    const [{ makemon }, { tamedog }] = await Promise.all([
        import('./makemon.js'), import('./dog.js'),
    ]);
    for (let i = rnd(5); i > 0; --i) {
        let typ = -1;
        switch (ptr.pmidx) {
        case PMNAMES.PM_WERERAT:
        case PMNAMES.PM_HUMAN_WERERAT:
            typ = rn2(3) ? PMNAMES.PM_SEWER_RAT
                         : rn2(3) ? PMNAMES.PM_GIANT_RAT
                                  : PMNAMES.PM_RABID_RAT;
            generic = 'rat';
            break;
        case PMNAMES.PM_WEREJACKAL:
        case PMNAMES.PM_HUMAN_WEREJACKAL:
            typ = rn2(7) ? PMNAMES.PM_JACKAL
                         : rn2(3) ? PMNAMES.PM_COYOTE : PMNAMES.PM_FOX;
            generic = 'jackal';
            break;
        case PMNAMES.PM_WEREWOLF:
        case PMNAMES.PM_HUMAN_WEREWOLF:
            typ = rn2(5) ? PMNAMES.PM_WOLF
                         : rn2(2) ? PMNAMES.PM_WARG
                                  : PMNAMES.PM_WINTER_WOLF;
            generic = 'wolf';
            break;
        default:
            continue;
        }
        const helper = makemon(game.mons[typ], game.u.ux, game.u.uy,
                               NO_MM_FLAGS);
        if (helper) {
            total++;
            if (canseemon(helper))
                visible++;
            if (yours)
                await tamedog(helper, null, false);
        }
    }
    return { total, visible, generic };
}

// src/were.c:47 counter_were()
export function counter_were(pm) {
    const P = PMNAMES;
    switch (pm) {
    case P.PM_WEREWOLF:          return P.PM_HUMAN_WEREWOLF;
    case P.PM_HUMAN_WEREWOLF:    return P.PM_WEREWOLF;
    case P.PM_WEREJACKAL:        return P.PM_HUMAN_WEREJACKAL;
    case P.PM_HUMAN_WEREJACKAL:  return P.PM_WEREJACKAL;
    case P.PM_WERERAT:           return P.PM_HUMAN_WERERAT;
    case P.PM_HUMAN_WERERAT:     return P.PM_WERERAT;
    default:                     return -1 /* NON_PM */;
    }
}

// src/were.c:96 new_were() — transform between human and beast form.
export async function new_were(mon) {
    if (Protection_from_shape_changers()
        && is_human(mon.data || game.mons[mon.mnum])) {
        return;
    }
    const pm = counter_were(mon.mnum);
    if (pm < 0)
        return;

    if (canseemon(mon) && !Hallucination())
        await pline(`${Monnam(mon)} changes into a ${
            is_human(game.mons[pm]) ? 'human'
                : pmname(game.mons[pm], 2).slice(4) /* skip "were" */}.`);

    /* set_mon_data() */
    mon.mnum = pm;
    mon.data = game.mons[pm];
    if (helpless(mon)) {
        mon.msleeping = 0;
        mon.mfrozen = 0;
        mon.mcanmove = 1;
    }
    /* regenerate by 1/4 of the lost hit points */
    healmon(mon, Math.trunc((mon.mhpmax - mon.mhp) / 4), 0);
    newsym(mon.mx, mon.my);
    const [{ mon_break_armor }, { possibly_unwield }]
        = await Promise.all([import('./worn.js'), import('./weapon.js')]);
    await mon_break_armor(mon, false);
    await possibly_unwield(mon, false);

    if (game.context?.mon_moving && !mon.mpeaceful) {
        const { onscary, monnear, monflee } = await import('./monmove.js');
        if (onscary(mon.mux, mon.muy, mon)
            && monnear(mon, mon.mux, mon.muy)) {
            await monflee(mon, rn1(9, 2), true, true);
        }
    }
}

// src/were.c:9 were_change() — maybe shift form; the rn2 size depends on
// night() and the moon phase.
export async function were_change(mon) {
    const ptr = game.mons[mon.mnum];
    if (!is_were(ptr))
        return;

    if (is_human(ptr)) {
        if (!Protection_from_shape_changers()
            && !rn2(night()
                    ? (game.flags?.moonphase === FULL_MOON ? 3 : 30)
                    : (game.flags?.moonphase === FULL_MOON ? 10 : 50))) {
            await new_were(mon); /* change into animal form */
            game.were_changes = (game.were_changes || 0) + 1;
            if (!Deaf() && !canseemon(mon)) {
                let howler = null;
                switch (mon.mnum) {
                case PMNAMES.PM_WEREWOLF:   howler = 'wolf'; break;
                case PMNAMES.PM_WEREJACKAL: howler = 'jackal'; break;
                default: break;
                }
                if (howler) {
                    await You_hear(`a ${howler} howling at the moon.`);
                    wake_nearto(mon.mx, mon.my, 4 * 4);
                }
            }
        }
    } else if (!rn2(30) || Protection_from_shape_changers()) {
        await new_were(mon); /* change back into human form */
        game.were_changes = (game.were_changes || 0) + 1;
    }
}
