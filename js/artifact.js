// artifact.js — artifact bookkeeping.
// C ref: src/artifact.c
//
// Only the slice the wish flow (readobjnam/makewish/oname) needs so far:
// name lookup, the artiexist tracking table, and the counters other code
// keys draws off (mksobj's `rn2(20 + 10 * nartifact_exist())`). The combat
// and intrinsic halves of artifact.c are not ported yet.

import { game } from './gstate.js';
import { fuzzymatch } from './hacklib.js';
import { ONAMES } from './objects_data.js';
import { artifact_names, artifact_otyps, ART_GRIMTOOTH } from './artilist_data.js';
import { ONAME_VIA_NAMING, ONAME_WISH, ONAME_GIFT, ONAME_VIA_DIP,
         ONAME_LEVEL_DEF, ONAME_BONES, ONAME_RANDOM,
         ONAME_KNOW_ARTI } from './const.js';

/* include/artilist.h — artilist[i].otyp, resolved from the generated
   ONAMES-key table. Index 0 is the dummy (STRANGE_OBJECT == 0). */
const arti_otyp = artifact_otyps.map((k) => ONAMES[k] ?? 0);

/* NROFARTIFACTS — artilist entries minus the index-0 dummy */
const NROFARTIFACTS = artifact_names.length - 1;

/* src/decl.c artiexist[] / zero_artiexist — creation tracking. Lives on
   game so save/restore can carry it once that machinery covers it. */
function artiexist() {
    if (!game.artiexist) {
        game.artiexist = [];
        for (let i = 0; i <= NROFARTIFACTS; i++)
            game.artiexist.push({ exists: 0, found: 0, gift: 0, wish: 0,
                                  named: 0, viadip: 0, lvldef: 0, bones: 0,
                                  rndm: 0 });
    }
    return game.artiexist;
}

// include/artifact.h:87 is_art()
export function is_art(obj, art) {
    return !!(obj && obj.oartifact === art);
}

// src/artifact.c:2837 permapoisoned() — currently only Grimtooth.
export function permapoisoned(obj) {
    return (obj && is_art(obj, ART_GRIMTOOTH));
}

// src/artifact.c artifact_name() — return the full name if 'name' names an
// artifact, else null; otyp_p (a {v} box) receives the base object type.
export function artifact_name(name, otyp_p, fuzzy) {
    let aname;

    if (name.toLowerCase().startsWith('the '))
        name = name.slice(4);

    for (let m = 1; m <= NROFARTIFACTS; m++) {
        aname = artifact_names[m];
        if (aname.toLowerCase().startsWith('the '))
            aname = aname.slice(4);
        if (!fuzzy ? name.toLowerCase() === aname.toLowerCase()
                   : fuzzymatch(name, aname, ' -', true)) {
            if (otyp_p)
                otyp_p.v = arti_otyp[m];
            return artifact_names[m];
        }
    }

    return null;
}

// src/artifact.c exist_artifact()
export function exist_artifact(otyp, name) {
    if (otyp && name)
        for (let m = 1; m <= NROFARTIFACTS; m++)
            if (arti_otyp[m] === otyp && artifact_names[m] === name)
                return artiexist()[m].exists ? true : false;
    return false;
}

// src/artifact.c artifact_exists() — an artifact has just been created or is
// being "un-created" for a chance to be created again later.
export function artifact_exists(otmp, name, mod, flgs) {
    if (otmp && name)
        for (let m = 1; m <= NROFARTIFACTS; m++)
            if (arti_otyp[m] === otmp.otyp && artifact_names[m] === name) {
                otmp.oartifact = mod ? m : 0;
                otmp.age = 0;
                if (otmp.otyp === ONAMES.RIN_INCREASE_DAMAGE)
                    otmp.spe = 0;
                if (mod) { /* means being created rather than un-created */
                    /* one--and only one--of these should always be set */
                    if ((flgs & (ONAME_VIA_NAMING | ONAME_WISH | ONAME_GIFT
                                 | ONAME_VIA_DIP | ONAME_LEVEL_DEF
                                 | ONAME_BONES | ONAME_RANDOM)) === 0)
                        flgs |= ONAME_RANDOM; /* the default origin */
                    artifact_origin(otmp, flgs);
                } else { /* uncreate */
                    /* clear all the flag bits */
                    const arex = artiexist()[m];
                    for (const k of Object.keys(arex))
                        arex[k] = 0;
                }
                break;
            }
    return;
}

// src/artifact.c nartifact_exist() — how many artifacts have been created.
export function nartifact_exist() {
    let a = 0;

    if (!game.artiexist)
        return 0;
    for (let i = 1; i <= NROFARTIFACTS; ++i)
        if (game.artiexist[i].exists)
            ++a;

    return a;
}

// src/artifact.c artifact_origin() — set artifact tracking flags;
// calling sequence: oname() -> artifact_exists() -> artifact_origin() or
// makewish() -> artifact_origin() to add the KNOW_ARTI bit.
export function artifact_origin(arti, aflags) {
    const a = arti.oartifact;

    if (a) {
        const arex = artiexist()[a];
        /* start by clearing all bits; most are mutually exclusive */
        for (const k of Object.keys(arex))
            arex[k] = 0;
        /* set 'exists' bit back on; not specified via flag bit in aflags */
        arex.exists = 1;
        if ((aflags & ONAME_KNOW_ARTI) !== 0)
            arex.found = 1;
        /* should be exactly one of wish, gift, via_dip, via_naming,
           level_def (quest), bones, and random */
        if ((aflags & ONAME_WISH) !== 0)
            arex.wish = 1;
        if ((aflags & ONAME_GIFT) !== 0)
            arex.gift = 1;
        if ((aflags & ONAME_VIA_DIP) !== 0)
            arex.viadip = 1;
        if ((aflags & ONAME_VIA_NAMING) !== 0)
            arex.named = 1;
        if ((aflags & ONAME_LEVEL_DEF) !== 0)
            arex.lvldef = 1;
        if ((aflags & ONAME_BONES) !== 0)
            arex.bones = 1;
        if ((aflags & ONAME_RANDOM) !== 0)
            arex.rndm = 1;
    }
}
