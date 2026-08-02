// mthrowu.js — monsters throwing and shooting.
// C ref: src/mthrowu.c
//
// monmulti() first: it is the volley-size roll, and its rnd(multishot) is
// the first draw of every monster shot. monshoot()/m_throw()/ohitmon() —
// the flight itself — are the remaining consumers and arrive with thrwmu.

import { game } from './gstate.js';
import { rnd } from './rng.js';
import { rounddiv } from './hack.js';
import { is_ammo, matching_launcher, ammo_and_launcher } from './wield.js';
import { multishot_class_bonus } from './dothrow.js';
import { is_prince, is_lord, is_mplayer, is_elf, is_orc,
         is_gnome } from './mondata.js';
import { OCLASSES, ONAMES } from './objects_data.js';
import { should_mulch_missile } from './dothrow.js';
import { delobj, m_at } from './mon.js';
import { down_gate, ship_object } from './dokick.js';
import { flooreffects } from './do.js';
import { place_object } from './mkobj.js';
import { stackobj } from './invent.js';
import { u_at } from './const.js';

// src/mthrowu.c:198 monmulti() — how many missiles this volley holds.
//
// The rnd(multishot) fires only when the stack, launcher and confusion
// guards all pass; a lone dagger or a confused monster throws exactly one
// and draws nothing here.
export function monmulti(mtmp, otmp, mwep) {
    const mdat = game.mons[mtmp.mnum];
    let multishot = 1;

    if (otmp.quan > 1 /* no point checking if there's only 1 */
        /* ammo requires corresponding launcher be wielded */
        && (is_ammo(otmp)
                ? matching_launcher(otmp, mwep)
                /* otherwise any stackable (non-ammo) weapon */
                : otmp.oclass === OCLASSES.WEAPON_CLASS)
        && !mtmp.mconf) {
        /* Assumes lords are skilled, princes are expert */
        if (is_prince(mdat))
            multishot += 2;
        else if (is_lord(mdat))
            multishot++;
        /* fake players treated as skilled (regardless of role limits) */
        else if (is_mplayer(mdat))
            multishot++;

        /* Elven Craftsmanship makes for light, quick bows */
        if (otmp.otyp === ONAMES.ELVEN_ARROW && !otmp.cursed)
            multishot++;
        if (mwep && mwep.otyp === ONAMES.ELVEN_BOW
            && ammo_and_launcher(otmp, mwep) && !mwep.cursed)
            multishot++;
        /* 1/3 of launcher enchantment */
        if (ammo_and_launcher(otmp, mwep) && mwep.spe > 1)
            multishot += rounddiv(mwep.spe, 3);
        /* Some randomness */
        multishot = rnd(multishot);

        /* class bonus */
        multishot += multishot_class_bonus(mtmp.mnum, otmp, mwep);

        /* racial bonus */
        if ((is_elf(mdat) && otmp.otyp === ONAMES.ELVEN_ARROW
             && mwep && mwep.otyp === ONAMES.ELVEN_BOW)
            || (is_orc(mdat) && otmp.otyp === ONAMES.ORCISH_ARROW
                && mwep && mwep.otyp === ONAMES.ORCISH_BOW)
            || (is_gnome(mdat) && otmp.otyp === ONAMES.CROSSBOW_BOLT
                && mwep && mwep.otyp === ONAMES.CROSSBOW))
            multishot++;
    }

    if (otmp.quan < multishot)
        multishot = otmp.quan;
    if (multishot < 1)
        multishot = 1;
    return multishot;
}

// src/mthrowu.c drop_throw() — the missile lands (or breaks). Returns
// whether the object is gone. passive_obj (rot/corrode the missile against
// the target's passive defense) records, gated on an actual hit.
export async function drop_throw(obj, ohit, x, y) {
    let broken;

    if (obj.otyp === ONAMES.CREAM_PIE || obj.oclass === OCLASSES.VENOM_CLASS
        || (ohit && obj.otyp === ONAMES.EGG)) {
        broken = true;
    } else {
        broken = !!(ohit && should_mulch_missile(obj));
    }

    if (broken) {
        delobj(obj);
    } else {
        if (down_gate(x, y) !== -1)
            broken = !!ship_object(obj, x, y, false);
        if (!broken) {
            let mtmp = m_at(x, y);
            if (!(broken = await flooreffects(obj, x, y, 'fall'))) {
                place_object(obj, x, y);
                if (!mtmp && u_at(x, y))
                    mtmp = game.youmonst;
                if (mtmp && ohit)
                    note_unported_mthrowu('drop_throw:passive_obj');
                stackobj(obj);
            }
        }
    }
    game.thrownobj = null;
    return broken;
}

function note_unported_mthrowu(what) {
    (game.unported ||= new Set()).add('mthrowu:' + what);
}
