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
import { u_at, M_AP_MONSTER, XKILL_NOMSG } from './const.js';
import { MON_WEP } from './monst.js';
import { DEADMONSTER, is_vampshifter } from './monst.js';
import { cansee } from './vision.js';
import { observe_object } from './o_init.js';
import { find_mac } from './worn.js';
import { omon_adj } from './dothrow.js';
import { hit, miss, exclam } from './zap.js';
import { distant_name, mshot_xname, xname, an, the } from './objnam.js';
import { pline, canspotmon } from './display.js';
import { pline_The } from './pline.js';
import { seemimic, setmangry, xkilled, mondied } from './mon.js';
import { dmgval } from './weapon.js';
import { resists_acid, resists_poison, resists_ston, noncorporeal,
         amorphous, nonliving } from './mondata.js';
import { mon_nam, Monnam, hliquid } from './do_name.js';
import { mhim } from './mondata.js';
import { s_suffix } from './hacklib.js';
import { mon_hates_silver, touch_petrifies } from './dog.js';
import { stone_missile, is_poisonable } from './obj.js';
import { passes_rocks } from './uhitm.js';
import { obj_extract_self } from './invent.js';
import { MATERIALS } from './objects_data.js';

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

// src/mthrowu.c:321 ohitmon() — an object launched by someone other than
// the hero attacks a monster. Returns 1 when the object stops (hit, or
// range exhausted). potionhit, munstone and minstapetrify record, each
// gated on the object that needs it.
export async function ohitmon(mtmp, otmp, range, verbose) {
    const mdat = game.mons[mtmp.mnum];
    const mon_launcher = game.marcher ? MON_WEP(game.marcher) : null;
    let damage, tmp;

    game.notonhead = (game.bhitpos.x !== mtmp.mx
                      || game.bhitpos.y !== mtmp.my);
    const ismimic = (mtmp.m_ap_type ?? 0) !== 0
                    && mtmp.m_ap_type !== M_AP_MONSTER;
    const vis = cansee(game.bhitpos.x, game.bhitpos.y);
    if (vis)
        observe_object(otmp);

    tmp = 5 + find_mac(mtmp) + omon_adj(mtmp, otmp, false);
    /* High level monsters will be more likely to hit, but only against
       the target the archer was aiming at. */
    if (game.marcher && game.mtarget === mtmp) {
        if (game.marcher.m_lev > 5)
            tmp += game.marcher.m_lev - 5;
        if (mon_launcher && mon_launcher.oartifact)
            note_unported_mthrowu('ohitmon:spec_abon');
    }
    if (tmp < rnd(20)) {
        if (!ismimic) {
            if (vis)
                await miss(distant_name(otmp, mshot_xname), mtmp);
            else if (verbose && !game.mtarget)
                await pline('It is missed.');
        }
        if (!range) { /* Last position; object drops */
            await drop_throw(otmp, 0, mtmp.mx, mtmp.my);
            return 1;
        }
    } else if (otmp.oclass === OCLASSES.POTION_CLASS) {
        if (ismimic)
            seemimic(mtmp);
        mtmp.msleeping = 0;
        note_unported_mthrowu('ohitmon:potionhit');
        return 1;
    } else {
        const material = game.objects[otmp.otyp].oc_material;
        const harmless = (stone_missile(otmp) && passes_rocks(mdat));

        damage = dmgval(otmp, mtmp);
        if (otmp.otyp === ONAMES.ACID_VENOM && resists_acid(mtmp))
            damage = 0;
        if (ismimic)
            seemimic(mtmp);
        mtmp.msleeping = 0;
        if (vis) {
            if (otmp.otyp === ONAMES.EGG) {
                await pline(`Splat!  ${Monnam(mtmp)} is hit with `
                            + `${otmp.known
                                 ? an(game.mons[otmp.corpsenm].name)
                                 : 'an'} egg!`);
            } else {
                const how = !harmless
                    ? exclam(damage)
                    : ` but passes harmlessly through ${mhim(mtmp)}.`;
                await hit(distant_name(otmp, mshot_xname), mtmp, how);
            }
        } else if (verbose && !game.mtarget) {
            await pline(`${otmp.otyp === ONAMES.EGG ? 'Splat!  ' : ''}`
                        + `${Monnam(mtmp)} is hit${exclam(damage)}`);
        }

        if (otmp.opoisoned && is_poisonable(otmp)) {
            if (resists_poison(mtmp)) {
                if (vis)
                    await pline_The(`poison doesn't seem to affect `
                                    + `${mon_nam(mtmp)}.`);
            } else {
                if (rn2(30)) {
                    damage += rnd(6);
                } else {
                    if (vis)
                        await pline_The('poison was deadly...');
                    damage = mtmp.mhp;
                }
            }
        }
        if (material === MATERIALS.SILVER && mon_hates_silver(mtmp)) {
            const flesh = (!noncorporeal(mdat) && !amorphous(mdat));

            /* note: extra silver damage is handled by dmgval() */
            if (vis) {
                let m_name = mon_nam(mtmp);
                if (flesh)
                    m_name = s_suffix(m_name) + ' flesh';
                await pline_The(`silver sears ${m_name}!`);
            } else if (verbose && !game.mtarget) {
                await pline(`${flesh ? 'Its flesh' : 'It'} is seared!`);
            }
        }
        if (otmp.otyp === ONAMES.ACID_VENOM && cansee(mtmp.mx, mtmp.my)) {
            if (resists_acid(mtmp)) {
                if (vis || (verbose && !game.mtarget))
                    await pline(`${Monnam(mtmp)} is unaffected.`);
            } else {
                if (vis)
                    await pline_The(`${hliquid('acid')} burns `
                                    + `${mon_nam(mtmp)}!`);
                else if (verbose && !game.mtarget)
                    await pline('It is burned!');
            }
        }
        if (otmp.otyp === ONAMES.EGG
            && touch_petrifies(game.mons[otmp.corpsenm])) {
            note_unported_mthrowu('ohitmon:egg_petrify');
            if (resists_ston(mtmp))
                damage = 0;
        }

        /* might already be dead (if petrified) */
        if (!harmless && !DEADMONSTER(mtmp)) {
            mtmp.mhp -= damage;
            if (DEADMONSTER(mtmp)) {
                if (vis || (verbose && !game.mtarget))
                    await pline(`${Monnam(mtmp)} is `
                        + `${(nonliving(mdat) || is_vampshifter(mtmp)
                              || !canspotmon(mtmp))
                             ? 'destroyed' : 'killed'}!`);
                /* don't blame hero for unknown rolling boulder trap */
                if (!game.context?.mon_moving
                    && (otmp.otyp !== ONAMES.BOULDER || range >= 0
                        || otmp.otrapped))
                    await xkilled(mtmp, XKILL_NOMSG);
                else
                    await mondied(mtmp);
            }
        }

        /* blinding venom and cream pie do 0 damage, but verify
           that the target is still alive anyway */
        if (!DEADMONSTER(mtmp)
            && can_blnd_mt(otmp)) {
            if (vis && mtmp.mcansee)
                await pline(`${Monnam(mtmp)} is blinded by `
                    + `${the((otmp.oclass === OCLASSES.VENOM_CLASS)
                             ? 'venom'
                             : (otmp.otyp === ONAMES.CREAM_PIE)
                               ? 'pie' : xname(otmp))}.`);
            mtmp.mcansee = 0;
            tmp = (mtmp.mblinded ?? 0) + rnd(25) + 20;
            if (tmp > 127)
                tmp = 127;
            mtmp.mblinded = tmp;
        }

        if (!DEADMONSTER(mtmp) && !game.context?.mon_moving)
            await setmangry(mtmp, true);

        const objgone = await drop_throw(otmp, 1, game.bhitpos.x,
                                         game.bhitpos.y);
        if (!objgone && range === -1) { /* special case */
            obj_extract_self(otmp);     /* free it for motion again */
            return 0;
        }
        return 1;
    }
    return 0;
}

/* src/uhitm.c can_blnd() reduced to the arms ohitmon can reach: blinding
   venom (AT_SPIT) and cream pie always can, anything else cannot blind
   through a thrown hit. The full can_blnd matrix arrives with mhitu. */
function can_blnd_mt(otmp) {
    return otmp.otyp === ONAMES.BLINDING_VENOM
           || otmp.otyp === ONAMES.CREAM_PIE;
}
