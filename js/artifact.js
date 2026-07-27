// artifact.js — artifact identity, powers and the tests that gate them.
// C ref: src/artifact.c
//
// The data lives in two generated files: js/artilist_data.js (the ART_*
// indices and the display names) and js/artilist_records.js (the 36 records
// themselves). This file is the logic over them.

import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { artilist } from './artilist_records.js';
import { ART_NONARTIFACT } from './artilist_data.js';
import { SPFX_DBONUS, SPFX_ATTK, SPFX_DMONS, SPFX_DCLAS, SPFX_DFLAG1,
         SPFX_DFLAG2, SPFX_DALIGN, AD_PHYS, AD_FIRE, AD_COLD, AD_ELEC,
         AD_MAGM, AD_STUN, AD_DRST, AD_DRLI, AD_STON,
         A_NONE } from './const.js';
import { defended, resists_cold, resists_elec, resists_poison } from './mondata.js';
/* resists_fire and resists_drli are NOT DEFINED anywhere in the port, and
   resists_ston is a non-exported stub in js/dog.js. An earlier check here
   grepped for the NAMES and found mentions rather than definitions, which is
   how they got imported and broke the module. Those branches are recorded. */
import { sgn } from './hacklib.js';

function note_unported_artifact(what) {
    (game.unported ||= new Set()).add(what);
}

// src/artifact.c spec_applies() — does this artifact's bonus apply to `mtmp`?
//
// The first line is the common case and the one that matters most: an
// artifact with neither a damage bonus nor a special attack applies only when
// its attack is ordinary physical.
//
// The dispatch below it is a chain of mutually exclusive spfx bits, in C's
// order, and the order IS the logic -- DMONS is checked before DCLAS, so an
// artifact flagged for both targets the monster rather than the class.
//
// adtyp arrives as an AD_* NAME from js/artilist_records.js rather than a
// number, so the switch compares against the imported constants by value
// through a lookup rather than on the raw field. See that file's header for
// why the names were kept.
export function spec_applies(weap, mtmp) {
    const AD = { AD_PHYS, AD_FIRE, AD_COLD, AD_ELEC, AD_MAGM, AD_STUN,
                 AD_DRST, AD_DRLI, AD_STON };
    const adtyp = typeof weap.attk?.adtyp === 'string'
        ? (AD[weap.attk.adtyp] ?? 0) : (weap.attk?.adtyp ?? 0);

    if (!(weap.spfx & (SPFX_DBONUS | SPFX_ATTK)))
        return adtyp === AD_PHYS;

    const yours = (mtmp === game.youmonst);
    const ptr = mtmp.data ?? game.mons[mtmp.mnum];

    if (weap.spfx & SPFX_DMONS) {
        /* C compares &mons[weap->mtype] by address; ours compares the index */
        return ptr === game.mons[Number(weap.mtype)];
    } else if (weap.spfx & SPFX_DCLAS) {
        return Number(weap.mtype) === ptr.mlet;
    } else if (weap.spfx & SPFX_DFLAG1) {
        return (ptr.mflags1 & Number(weap.mtype)) !== 0;
    } else if (weap.spfx & SPFX_DFLAG2) {
        if (ptr.mflags2 & Number(weap.mtype))
            return true;
        if (yours) {
            /* the hero arm needs Upolyd, urace.selfmask and u.ulycn */
            note_unported_artifact('spec_applies:DFLAG2_hero');
        }
        return false;
    } else if (weap.spfx & SPFX_DALIGN) {
        if (yours) {
            note_unported_artifact('spec_applies:DALIGN_hero');
            return false;
        }
        return ptr.maligntyp === A_NONE
            || sgn(ptr.maligntyp) !== Number(weap.alignment);
    } else if (weap.spfx & SPFX_ATTK) {
        if (defended(mtmp, adtyp))
            return false;

        /* The hero-side arms all read intrinsics that need the uprops
           struct; the monster-side ones work today. Recorded per branch
           rather than as one lump so the gap stays legible. */
        switch (adtyp) {
        case AD_FIRE:
            if (yours) { note_unported_artifact('spec_applies:Fire_resistance'); return false; }
            note_unported_artifact('spec_applies:resists_fire');
            return false;
        case AD_COLD:
            if (yours) { note_unported_artifact('spec_applies:Cold_resistance'); return false; }
            return !resists_cold(mtmp);
        case AD_ELEC:
            if (yours) { note_unported_artifact('spec_applies:Shock_resistance'); return false; }
            return !resists_elec(mtmp);
        case AD_MAGM:
        case AD_STUN:
            if (yours) { note_unported_artifact('spec_applies:Antimagic'); return false; }
            return !(rn2(100) < ptr.mr);      /* THE ONLY DRAW IN THIS FUNCTION */
        case AD_DRST:
            if (yours) { note_unported_artifact('spec_applies:Poison_resistance'); return false; }
            return !resists_poison(mtmp);
        case AD_DRLI:
            if (yours) { note_unported_artifact('spec_applies:Drain_resistance'); return false; }
            note_unported_artifact('spec_applies:resists_drli');
            return false;
        case AD_STON:
            if (yours) { note_unported_artifact('spec_applies:Stone_resistance'); return false; }
            note_unported_artifact('spec_applies:resists_ston');
            return false;
        default:
            /* C calls impossible("Weird weapon special attack.") */
            note_unported_artifact('spec_applies:weird_special_attack');
        }
    }
    return false;
}

// src/artifact.c:993 bane_applies() — does this artifact's DAMAGE BONUS apply?
//
// The copy-and-mask is the whole trick and must not be simplified away:
//
//     atmp = *oart;
//     atmp.spfx &= SPFX_DBONUS;   /* clear other spfx fields */
//
// C hands spec_applies a COPY carrying only the damage-bonus bits, so the
// SPFX_ATTK arm of spec_applies cannot fire even for an artifact that also
// has a special attack. Passing `oart` straight through would let a
// dual-flagged artifact take the wrong branch -- which reads as a plausible
// simplification and is a behaviour change.
//
// The C compares `oart != &artilist[ART_NONARTIFACT]` by address; ours is an
// index test, because ART_NONARTIFACT is index 0 of the same table.
export function bane_applies(oart, mon) {
    if (oart && oart !== artilist[ART_NONARTIFACT]
        && (oart.spfx & SPFX_DBONUS) !== 0) {
        const atmp = { ...oart, spfx: oart.spfx & SPFX_DBONUS };
        if (spec_applies(atmp, mon))
            return true;
    }
    return false;
}
