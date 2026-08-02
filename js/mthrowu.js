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
