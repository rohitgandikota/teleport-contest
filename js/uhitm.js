// uhitm.js — the hero attacking, or declining to attack, a monster.
// C ref: src/uhitm.c
//
// Only do_attack()'s is_safemon branch is ported: the path taken when the hero
// walks into a pet or other peaceful. That path is not a corner case. Probing
// domove with an m_at() counter shows seed0030's hero steps onto a tame
// monster sixteen times in one session, and each of those is an rn2(7) the C
// draws and we do not.
//
// The hostile path (attack_checks and everything past it) is the real combat
// code and is recorded, not faked.

import { game } from './gstate.js';
import { rn2, rnd } from './rng.js';
import { is_safemon } from './display.js';
import { monflee } from './monmove.js';
import { IS_OBSTRUCTED, MON_POLE_DIST } from './const.js';
import { PMNAMES, MFLAGS } from './monst_data.js';
import { adjalign, near_capacity } from './attrib.js';
import { abon, hitval, weapon_hit_bonus } from './weapon.js';
import { find_mac } from './worn.js';
import { worn } from './do_wear.js';
import { is_orc } from './mondata.js';
import { is_blade, is_axe, set_ustuck } from './mon.js';
import { is_weptool } from './mkobj.js';
import { OCLASSES } from './objects_data.js';
import { sgn } from './hacklib.js';
import { ATTKS } from './monst_data.js';
import { W_ARM, W_ARMS, P_BARE_HANDED_COMBAT, P_BASIC } from './const.js';
import { is_undead } from './mondata.js';
import { A_LAWFUL } from './const.js';

function note_unported_uhitm(what) {
    (game.unported ||= new Set()).add(`uhitm:${what}`);
}

// include/mondata.h:29 passes_walls()
const passes_walls = (ptr) => (ptr.mflags1 & MFLAGS.M1_WALLWALK) !== 0;

// include/mondata.h:150 is_longworm() — an identity test against three
// specific permonst entries, NOT a flag test.
const is_longworm = (ptr) =>
    ptr.pmidx === PMNAMES.PM_BABY_LONG_WORM
    || ptr.pmidx === PMNAMES.PM_LONG_WORM
    || ptr.pmidx === PMNAMES.PM_LONG_WORM_TAIL;

// src/mon.c helpless()
const helpless = (mon) =>
    !!(mon.msleeping || !mon.mcanmove || (mon.mfrozen | 0) > 0);

// src/uhitm.c:462 do_attack() — returns TRUE if the hero's move is used up.
//
// Returning FALSE is what lets the caller swap places with the monster, so the
// three arms below are "you stop", "it doesn't budge", and "go ahead and swap".
export function do_attack(mtmp) {
    if (is_safemon(mtmp) && !game.context?.forcefight) {
        /* u_wield_art(ART_STORMBRINGER) — no artifact is wielded this early */
        const mdat = game.mons[mtmp.mnum];

        /* src/uhitm.c:474 — the rn2(7) fires on EVERY step onto a peaceful,
           before any of the cheaper terms, because || evaluates left to right
           and Punished is false for an unpunished hero. */
        const foo = !!(game.u.uprops?.PUNISHED || !rn2(7)
                       || (is_longworm(mdat) && mtmp.wormno)
                       || (IS_OBSTRUCTED(game.level.at(game.u.ux, game.u.uy)?.typ)
                           && !passes_walls(mdat)));

        /* the in-shop check only runs when foo is false; it needs the shop
           bookkeeping and is recorded rather than guessed */
        let inshop = false;
        if (!foo && mtmp.isshk)
            note_unported_uhitm('do_attack:tended_shop');

        if (inshop || foo) {
            if (mtmp.isshk)
                note_unported_uhitm('do_attack:dopay');
            if (mtmp.mtame)     /* see 'additional considerations' in the C */
                monflee(mtmp, rnd(6), false, false);
            note_unported_uhitm('do_attack:in_the_way_message');
            return true;
        } else if (mtmp.mfrozen || helpless(mtmp)
                   || (mdat.mmove === 0 && rn2(6))) {
            note_unported_uhitm('do_attack:doesnt_seem_to_move');
            return true;
        } else {
            return false;       /* caller swaps places with it */
        }
    }

    /* everything past here is attack_checks() and the combat code */
    note_unported_uhitm('do_attack:combat');
    return true;
}

// src/uhitm.c:331 check_caitiff() — a Knight's chivalry and a Samurai's giri.
//
// Draws nothing, but it calls adjalign(-1), which moves the hero's alignment
// record AND raises ualign.abuse. find_roll_to_hit calls it once per attack
// sequence, guarded by `if (!(*attk_count)++)`, so it must not fire on the
// second and later attacks of a multi-attack turn.
//
// The two You() messages need pline plumbing and are recorded; the alignment
// change is the part that persists.
export function check_caitiff(mtmp) {
    if (game.u.ualign.record <= -10)
        return;

    const d = game.mons[mtmp.mnum];

    if (Role_if(PMNAMES.PM_KNIGHT) && game.u.ualign.type === A_LAWFUL
        && !is_undead(d)
        && (helpless(mtmp) || (mtmp.mflee && !mtmp.mavenge))) {
        note_unported_uhitm('check_caitiff:caitiff_message');
        adjalign(-1);
    } else if (Role_if(PMNAMES.PM_SAMURAI) && mtmp.mpeaceful) {
        /* attacking peaceful creatures is bad for the samurai's giri */
        note_unported_uhitm('check_caitiff:dishonor_message');
        adjalign(-1);
    }
}

// src/role.c Role_if()
const Role_if = (pm) => game.urole?.malenum === pm || game.urole?.pmidx === pm;

// src/uhitm.c find_roll_to_hit() — the number the d20 must beat.
//
// Draws nothing itself; hitum rolls rnd(20) against the value it returns.
// attk_count and role_roll_penalty are C out-parameters, passed here as a
// single mutable object so the caller sees both.
//
// The check_caitiff() call is guarded by `if (!(*attk_count)++)`, so it fires
// on the FIRST attack of a sequence only -- a multi-attack turn must not
// penalise the hero's alignment repeatedly.
export function find_roll_to_hit(mtmp, aatyp, weapon, out) {
    const ptr = game.mons[mtmp.mnum];
    out.role_roll_penalty = 0;              /* default is `none' */

    /* include/you.h:464 Luck is uluck + moreluck */
    const Luck = (game.u.uluck || 0) + (game.u.moreluck || 0);

    let tmp = 1 + abon() + find_mac(mtmp) + (game.u.uhitinc || 0)
              + (sgn(Luck) * Math.trunc((Math.abs(Luck) + 2) / 3))
              + game.u.ulevel;              /* maybe_polyd: not polymorphed */

    /* some actions should occur only once during multiple attacks */
    if (!(out.attk_count++))
        check_caitiff(mtmp);

    /* adjust vs. monster state */
    if (mtmp.mstun)      tmp += 2;
    if (mtmp.mflee)      tmp += 2;
    if (mtmp.msleeping)  tmp += 2;
    if (!mtmp.mcanmove)  tmp += 4;

    /* role/race adjustments */
    if (Role_if(PMNAMES.PM_MONK)) {
        if (worn(W_ARM))
            tmp -= (out.role_roll_penalty = game.urole.spelarmr);
        else if (!game.u.uwep && !worn(W_ARMS))
            tmp += Math.trunc(game.u.ulevel / 3) + 2;
    }
    if (is_orc(ptr) && Race_if(PMNAMES.PM_ELF))
        tmp++;

    /* encumbrance: with a lot of luggage, your agility diminishes */
    const tmp2 = near_capacity();
    if (tmp2 !== 0)
        tmp -= (tmp2 * 2) - 1;
    if (game.u.utrap)
        tmp -= 3;

    /* hitval applies when wielding a weapon; weapon_hit_bonus applies to any
       weapon attack, bare-handed included, and to a martial artist's kick */
    if (aatyp === ATTKS.AT_WEAP || aatyp === ATTKS.AT_CLAW) {
        if (weapon)
            tmp += hitval(weapon, mtmp);
        tmp += weapon_hit_bonus(weapon);
    } else if (aatyp === ATTKS.AT_KICK && martial_bonus()) {
        tmp += weapon_hit_bonus(null);
    }

    return tmp;
}

// src/role.c Race_if()
const Race_if = (pm) => game.urace?.malenum === pm || game.urace?.pmidx === pm;

/* include/skills.h:81 martial_bonus() — mirrored from js/weapon.js, which
   cannot be imported here without closing a cycle. */
const martial_bonus = () =>
    Role_if(PMNAMES.PM_SAMURAI) || Role_if(PMNAMES.PM_MONK);

// src/uhitm.c mon_maybe_unparalyze() — a paralysed monster may snap out of it.
//
// DRAWS, and the draw is unconditional on the monster being unable to move:
// hitum calls this between find_roll_to_hit and its own rnd(20), so a frozen
// target costs an rn2(10) that a mobile one does not.
export function mon_maybe_unparalyze(mtmp) {
    if (!mtmp.mcanmove) {
        if (!rn2(10)) {
            mtmp.mcanmove = 1;
            mtmp.mfrozen = 0;
        }
    }
}

// src/uhitm.c double_punch() — chance of a second bare-handed hit.
//
// DRAWS rn2(5), but ONLY when bare-handed above Basic skill. C's own table:
// unskilled and basic 0%, skilled 20%, expert 40%, master 60%, grandmaster
// 80%. Note the guard is `!uwep && !uarms` -- a shield suppresses it as
// surely as a weapon does.
export function double_punch() {
    /* P_BARE_HANDED_COMBAT and P_MARTIAL_ARTS are the same skill */
    const skl_lvl = game.u.weapon_skills[P_BARE_HANDED_COMBAT].skill;

    if (!game.u.uwep && !worn(W_ARMS) && skl_lvl > P_BASIC)
        return (skl_lvl - P_BASIC) > rn2(5);
    return false;
}

// src/uhitm.c:5198 missum() — the hero's attack misses.
//
// Draws nothing itself. Its three messages need pline plumbing and are
// recorded, but the WAKEUP is behaviour, not a message: a monster that was
// asleep stops being asleep, and wakeup() in turn calls setmangry(), which
// makes a peaceful monster hostile. That is state a later turn depends on.
//
// wakeup() is not ported -- it opens a chain through wake_msg, seemimic,
// finish_meating, growl, setmangry, ghod_hitsu and hot_pursuit -- so it is
// recorded here rather than approximated. Approximating it by just clearing
// msleeping would leave a peaceful monster peaceful after being attacked,
// which is a worse wrong answer than doing nothing.
export function missum(mdef, mattk, wouldhavehit) {
    if (wouldhavehit)   /* a monk missing due to the body-armour penalty */
        note_unported_uhitm('missum:cumbersome_armor_message');

    note_unported_uhitm('missum:miss_message');

    if (!helpless(mdef))
        note_unported_uhitm('missum:wakeup');
}

// src/uhitm.c known_hitum() — resolve a hit or miss that the hero knows about.
//
// THE FIRST FUNCTION IN THIS CHAIN THAT DRAWS, and the draws are nested:
// rn2(25) gates the flee check, and only if that passes does rn2(3) decide
// whether monflee gets rnd(100) or 0. So a healthy monster costs one draw, a
// wounded one that passes the gate costs two or three.
//
// mhit is C's in/out parameter: a Vorpal Blade hit against a headless target
// is converted back to a miss. It is passed as a one-element array so the
// caller sees the change, and the conduct counter is rolled back with it --
// a miss must not count as having hit with a weapon.
//
// hmon (the damage) and cutworm (long worms) are recorded, not approximated.
// Without hmon the monster takes no damage, so mhp stays equal to oldhp and
// the Vorpal-miss branch fires every time; that is noted at the branch so the
// behaviour is not mistaken for a bug later.
export function known_hitum(mon, weapon, mhit, rollneeded, armorpenalty,
                            uattk, dieroll) {
    let malive = true;
    /* hmon() might destroy the weapon; remember the aspect for cutworm */
    const slice_or_chop = !!(weapon && (is_blade(weapon) || is_axe(weapon)));

    if (game.override_confirmation)
        note_unported_uhitm('known_hitum:bloodthirsty_blade_message');

    if (!mhit[0]) {
        missum(mon, uattk, (rollneeded + armorpenalty > dieroll));
    } else {
        const oldhp = mon.mhp;
        const oldweaphit = game.u.uconduct?.weaphit ?? 0;

        /* KMH, conduct */
        if (weapon && (weapon.oclass === OCLASSES.WEAPON_CLASS
                       || is_weptool(weapon, game.objects))) {
            game.u.uconduct = game.u.uconduct || {};
            game.u.uconduct.weaphit = oldweaphit + 1;
        }

        /* hmon() applies the damage and may kill the monster */
        note_unported_uhitm('known_hitum:hmon');

        if (malive) {
            if (!rn2(25) && mon.mhp < mon.mhpmax / 2 && !game.u.uswallow) {
                monflee(mon, !rn2(3) ? rnd(100) : 0, false, true);

                if (game.u.ustuck === mon && !game.u.uswallow)
                    set_ustuck(null);
            }
            /* Vorpal Blade hit converted to miss: headless monster or worm
               tail. NOTE: with hmon unported the monster never loses hp, so
               this fires on every hit. It is faithful to the C given no
               damage was applied. */
            if (mon.mhp === oldhp) {
                mhit[0] = 0;
                game.u.uconduct.weaphit = oldweaphit;  /* a miss is not a hit */
            }
            if (mon.wormno && mhit[0])
                note_unported_uhitm('known_hitum:cutworm');
        }
    }
    return malive;
}
