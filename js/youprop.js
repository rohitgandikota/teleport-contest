// youprop.js — the hero-property macros from include/youprop.h.
//
// Same role js/monst.js plays for include/monst.h, js/obj.js for include/obj.h
// and js/mondata.js for include/mondata.h: a header's macros are shared by
// every C file that includes it, so they need one JS home rather than a
// private copy per module.
//
// Hallucination arrived here because two modules wanted it and js/invent.js
// had it as a private `return false` stub. A stub is fine while nothing sets
// the property, but it goes on being quietly wrong after something does, and
// nothing catches that. Reading the real uprops entry costs the same and
// starts telling the truth by itself.
//
// Nothing here draws.

import { game } from './gstate.js';
import { is_flyer } from './mondata.js';

// include/youprop.h:116 HHallucination — u.uprops[HALLUC].intrinsic.
// The C comment above it reads "Hallucination is solely a timeout", which is
// why this is .intrinsic and there is no EHallucination to go with it.
export const HHallucination = () => !!game.u?.uprops?.HALLUC;

// include/youprop.h:117 HHalluc_resistance, :118 EHalluc_resistance,
// :119 Halluc_resistance. The port models uprops as a flat prop -> value map
// rather than C's {intrinsic, extrinsic, blocked} struct, so the two halves
// collapse into the one read; when uprops grows the struct, split them here.
export const Halluc_resistance = () => !!game.u?.uprops?.HALLUC_RES;

// include/youprop.h:120 Hallucination()
export const Hallucination = () => HHallucination() && !Halluc_resistance();

// include/youprop.h:123 HDeaf, :124 EDeaf, :125 Deaf.
// As with HALLUC above, the flat uprops map collapses intrinsic and extrinsic
// into one read. u.uroleplay.deaf is the deaf conduct, chosen at startup.
export const Deaf = () => !!game.u?.uprops?.DEAF || !!game.u?.uroleplay?.deaf;

// include/youprop.h:279 Underwater()
export const Underwater = () => !!game.u?.uinwater;

// include/youprop.h:399 Unaware — (gm.multi < 0 && (unconscious() ||
// is_fainted())).
//
// The multi test comes first in the C and it is a real short circuit, not a
// cheap-test-first optimisation: with multi >= 0 the macro is FALSE whatever
// the other two return. So this is exactly right whenever the hero is not in a
// multi-turn occupation, which is the overwhelmingly common case, and only the
// multi < 0 branch is a gap. unconscious() and is_fainted() both need sleep
// and fainting state that is not ported; recording there rather than guessing
// keeps the gap visible instead of burying it in a `return false`.
export const Unaware = () => {
    if (!(game.multi < 0))
        return false;               /* definitively false, nothing to guess */
    (game.unported ||= new Set()).add('youprop:Unaware');
    return false;
};

// include/youprop.h:152 See_invisible — (HSee_invisible || ESee_invisible).
export const See_invisible = () => !!game.u?.uprops?.SEE_INVIS;

// include/youprop.h:198 Invis — ((HInvis || EInvis) && !BInvis).
// The flat uprops map has no blocked slot, so the BInvis term has nowhere to
// live yet; nothing blocks invisibility today, so this is right for now and
// the term goes in when uprops grows the struct.
// include/youprop.h:198 Invis — INCOMPLETE, and deliberately flagged.
//
//     #define Invis ((HInvis || EInvis) && !BInvis)
//
// The !BInvis term is MISSING here and cannot be written yet: uprops has no
// {intrinsic, extrinsic, blocked} structure, so there is nothing to read a
// blocked bit from. Today every term is false so the result is right by
// accident; the moment uprops is initialised this will report invisibility
// for a hero whose invisibility is BLOCKED.
//
// Fix this WITH the uprops structure, not before and not after.
export const Invis = () => !!game.u?.uprops?.INVIS;

// include/youprop.h:240 Levitation — ((HLevitation || ELevitation) && !BLevitation).
//
// The !BLevitation term is MISSING here, exactly as in Invis above: uprops
// has no blocked field to read yet. Today every term is false so the answer
// is right by accident; once uprops is initialised this reports levitation
// for a hero whose levitation is BLOCKED. Fix it WITH the structure.
export const Levitation = () => !!game.u?.uprops?.LEVITATION;

// include/youprop.h:253 Flying — note the steed term: riding a flying mount
// counts, which is why this cannot be a plain uprops read.
export const Flying = () =>
    !!game.u?.uprops?.FLYING
    || !!(game.u?.usteed && is_flyer(game.u.usteed.data));

// include/youprop.h Fire_resistance — (HFire_resistance || EFire_resistance).
export const Fire_resistance = () => !!game.u?.uprops?.FIRE_RES;

// include/youprop.h:147 Hunger — (HHunger || EHunger).
//
// No blocked term, unlike Invis, so this one IS complete in shape: when
// uprops grows the struct, the two halves become
// uprops[HUNGER].intrinsic and .extrinsic and nothing else changes.
export const Hunger = () => !!game.u?.uprops?.HUNGER;

// include/youprop.h:182 Clairvoyant — ((HClairvoyant || EClairvoyant)
// && !BClairvoyant).
//
// This one already had its blocked term modelled, unlike Invis: the call
// sites in js/allmain.js and js/attrib.js test a SEPARATE pseudo-property
// key, uprops.BLOCKED_CLAIRVOYANT, standing in for
// uprops[CLAIRVOYANT].blocked. That is a structure the C does not have, so
// when uprops grows the real struct the pseudo-key must be FOLDED IN here
// and deleted rather than left alongside.
export const Clairvoyant = () =>
    !!game.u?.uprops?.CLAIRVOYANT && !game.u?.uprops?.BLOCKED_CLAIRVOYANT;

// The next block is straight from include/youprop.h. Note the three SHAPES,
// which is why each is written out rather than generated: some combine
// intrinsic and extrinsic, some are intrinsic ONLY, and none of these has a
// blocked term (unlike Invis and Levitation above).

// include/youprop.h:138 Wounded_legs — (HWounded_legs || EWounded_legs)
export const Wounded_legs = () => !!game.u?.uprops?.WOUNDED_LEGS;

// include/youprop.h:345 Regeneration — (HRegeneration || ERegeneration)
export const Regeneration = () => !!game.u?.uprops?.REGENERATION;

// include/youprop.h:129 Fumbling — (HFumbling || EFumbling)
export const Fumbling = () => !!game.u?.uprops?.FUMBLING;

// include/youprop.h:81 Stunned — HStun. INTRINSIC ONLY: there is no EStun
// term, so an item cannot confer it. The property key is STUNNED while the
// C intrinsic macro is HStun; do not let the name difference suggest a
// second property.
export const Stunned = () => !!game.u?.uprops?.STUNNED;

// include/youprop.h:84 Confusion — HConfusion. Intrinsic only, as Stunned.
export const Confusion = () => !!game.u?.uprops?.CONFUSION;

// include/youprop.h:108 Sick — u.uprops[SICK].intrinsic. Intrinsic only,
// and C spells it out rather than going through an HSick macro.
export const Sick = () => !!game.u?.uprops?.SICK;

// include/youprop.h:111 Vomiting — u.uprops[VOMITING].intrinsic.
export const Vomiting = () => !!game.u?.uprops?.VOMITING;

// include/youprop.h Teleport_control — (HTeleport_control || ETeleport_control)
export const Teleport_control = () => !!game.u?.uprops?.TELEPORT_CONTROL;

// include/youprop.h:190 Detect_monsters — (HDetect_monsters || EDetect_monsters)
export const Detect_monsters = () => !!game.u?.uprops?.DETECT_MONSTERS;

// include/youprop.h:156 Blind_telepat — (HTelepat || ETelepat). NOTE THE NAME:
// the macro is Blind_telepat while the property key is TELEPAT, and there is
// no separate "Telepat" macro. Reading the key name as the macro name would
// invent one.
export const Blind_telepat = () => !!game.u?.uprops?.TELEPAT;

// include/youprop.h:170 Warn_of_mon — (HWarn_of_mon || EWarn_of_mon)
export const Warn_of_mon = () => !!game.u?.uprops?.WARN_OF_MON;

// include/youprop.h:186 Infravision — (HInfravision || EInfravision)
export const Infravision = () => !!game.u?.uprops?.INFRAVISION;
