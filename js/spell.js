// spell.js — spellcasting.
// C ref: src/spell.c

import { game } from './gstate.js';
import { pline } from './display.js';
import { ECMD_OK, weight } from './invent.js';
import { worn } from './do_wear.js';
import { ACURR } from './attrib.js';
import { isqrt } from './hacklib.js';
import { is_metallic } from './obj.js';
import { ONAMES } from './objects_data.js';
import { PMNAMES } from './monst_data.js';
import { W_ARM, W_ARMC, W_ARMS, W_ARMH, W_ARMG, W_ARMF, W_WEP,
         P_CLERIC_SPELL, P_UNSKILLED, P_ISRESTRICTED } from './const.js';

// src/spell.c — NO_SPELL sentinel and the spell list accessor.
const NO_SPELL = 0;

// src/spell.c spellid() — the spell in slot `spidx`, or NO_SPELL.
export function spellid(spidx) {
    const sp = game.spl_book?.[spidx];
    return sp ? sp.sp_id : NO_SPELL;
}

// src/spell.c:24 spellev() — the spell's level.
export function spellev(spidx) {
    return game.spl_book?.[spidx]?.sp_lev ?? 0;
}

// src/spell.c:856 spell_skilltype() — oc_skill is #defined to oc_subtyp.
export function spell_skilltype(booktype) {
    return game.objects[booktype].oc_subtyp;
}

// src/spell.c:106 — the metal-armour penalties. Not role-specific: headgear,
// gauntlets and footwear interfere with anyone.
const uarmhbon = 4;    /* metal helmets interfere with the mind */
const uarmgbon = 6;    /* casting channels through the hands */
const uarmfbon = 2;    /* all metal interferes to some degree */

// src/spell.c:2173 percent_success() — the hero's chance of casting `spell`.
//
// Draws nothing, and every term matters because the single visible draw is
// `rnd(100) > percent_success(spell)` in spelleffects_check.
//
// Two halves: splcaster is intrinsic ability (role base plus armour
// penalties, capped at 20), and chance is learned ability (the casting stat,
// adjusted by how far the hero's level and skill are from the spell's). They
// are combined at the end, and a heavy shield divides the learned half.
export function percent_success(spell) {
    let chance, splcaster, special, statused, difficulty, skill;
    const skilltype = spell_skilltype(spellid(spell));
    /* Knights get no metal-armour penalty for clerical spells */
    const paladin_bonus = Role_if(PMNAMES.PM_KNIGHT)
                          && skilltype === P_CLERIC_SPELL;

    const uarm = worn(W_ARM), uarmc = worn(W_ARMC), uarms = worn(W_ARMS);
    const uarmh = worn(W_ARMH), uarmg = worn(W_ARMG), uarmf = worn(W_ARMF);
    const uwep = worn(W_WEP);

    splcaster = game.urole.spelbase;
    special = game.urole.spelheal;
    statused = ACURR(game.urole.spelstat);

    if (uarm && is_metallic(uarm) && !paladin_bonus)
        splcaster += (uarmc && uarmc.otyp === ONAMES.ROBE)
                     ? Math.trunc(game.urole.spelarmr / 2) : game.urole.spelarmr;
    else if (uarmc && uarmc.otyp === ONAMES.ROBE)
        splcaster -= game.urole.spelarmr;
    if (uarms)
        splcaster += game.urole.spelshld;

    if (uwep && uwep.otyp === ONAMES.QUARTERSTAFF)
        splcaster -= 3;                 /* small bonus */

    if (!paladin_bonus) {
        if (uarmh && is_metallic(uarmh)) splcaster += uarmhbon;
        if (uarmg && is_metallic(uarmg)) splcaster += uarmgbon;
        if (uarmf && is_metallic(uarmf)) splcaster += uarmfbon;
    }

    if (spellid(spell) === game.urole.spelspec)
        splcaster += game.urole.spelsbon;

    /* `healing spell' bonus */
    const sid = spellid(spell);
    if (sid === ONAMES.SPE_HEALING || sid === ONAMES.SPE_EXTRA_HEALING
        || sid === ONAMES.SPE_CURE_BLINDNESS || sid === ONAMES.SPE_CURE_SICKNESS
        || sid === ONAMES.SPE_RESTORE_ABILITY || sid === ONAMES.SPE_REMOVE_CURSE)
        splcaster += special;

    if (splcaster > 20)
        splcaster = 20;

    /* learned ability, from the casting stat */
    chance = Math.trunc(11 * statused / 2);

    skill = P_SKILL(skilltype);
    skill = Math.max(skill, P_UNSKILLED) - 1;   /* unskilled => 0 */
    difficulty = (spellev(spell) - 1) * 4
                 - ((skill * 6) + Math.trunc(game.u.ulevel / 3) + 1);

    if (difficulty > 0) {
        /* too low level or unskilled */
        chance -= isqrt(900 * difficulty + 2000);
    } else {
        /* above level; diminishing returns for low-level spells */
        const learning = Math.trunc(15 * -difficulty / spellev(spell));
        chance += learning > 20 ? 20 : learning;
    }

    if (chance < 0) chance = 0;
    if (chance > 120) chance = 120;

    /* anything but a light shield makes casting very awkward */
    if (uarms && weight(uarms) > game.objects[ONAMES.SMALL_SHIELD].oc_weight) {
        if (spellid(spell) === game.urole.spelspec)
            chance = Math.trunc(chance / 2);
        else
            chance = Math.trunc(chance / 4);
    }

    chance = Math.trunc(chance * (20 - splcaster) / 15) - splcaster;

    if (chance > 100) chance = 100;
    if (chance < 0) chance = 0;
    return chance;
}

// include/skills.h:115 P_SKILL()
const P_SKILL = (type) => game.u.weapon_skills?.[type]?.skill ?? P_ISRESTRICTED;

// src/role.c Role_if()
const Role_if = (pm) => game.urole?.malenum === pm || game.urole?.mnum === pm;

// src/spell.c:2024 dovspell() — '+', list known spells.
// Only the "no spells" path is ported; the menu path lands with the tty menu
// system. A Tourist starts with no spells, which is the case seed8000 hits.
export async function dovspell() {
    if (spellid(0) === NO_SPELL) {
        await pline("You don't know any spells right now.");
    }
    return ECMD_OK;
}
