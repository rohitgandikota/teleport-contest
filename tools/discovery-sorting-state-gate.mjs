#!/usr/bin/env node

// Stored state behind independent C discovery and identification recordings.
// Constructed controls below exercise source decisions without claiming new
// native coverage. Neither sorted output nor expected names come from JS.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeScreen, renderCell } from '../frozen/screen-decode.mjs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { ONAMES as O, OCLASSES as C } from '../js/objects_data.js';
import { ART_MAGICBANE, ART_FROST_BRAND } from '../js/artilist_data.js';
import { FROMOUTSIDE, TIMEOUT, OBJ_INVENT, NON_PM } from '../js/const.js';
import { get_sortdisco } from '../js/o_init.js';
import { not_fully_identified, xname, doname, OBJ_NAME } from '../js/objnam.js';
import { loot_classify, inv_order, fully_identify_obj } from '../js/invent.js';
import { disp_artifact_discoveries } from '../js/artifact.js';
import { make_blinded } from '../js/potion.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const replay = segment => runSegment({ ...segment, storage: new InMemoryStorage() });
const orderDescriptions = ['by order of discovery within each class',
    'sortloot order (by class with some sub-class groupings)',
    'alphabetical within each class', 'alphabetical across all classes'];
let count = 0;
for (const name of ['discovery-sort-order', 'discovery-sorting-details',
                    'discovery-identification']) {
    const input = read(`gen-sessions/recipes/${name}.json`);
    const recorded = read(`gen-sessions/generated/${name}.session.json`);
    for (const [i, segment] of input.segments.entries()) {
        const cLines = recorded.segments[i].steps.flatMap(st =>
            decodeScreen(st.screen).map(row => row.map(renderCell).join('').trimEnd()));
        const title = cLines.filter(row => row.startsWith('Discoveries, ')).at(-1);
        await replay(segment);
        count++;
        if (title) {
            const idx = orderDescriptions.indexOf(title.slice('Discoveries, '.length));
            assert.ok(idx >= 0, segment.name + ': C displayed a known sort mode');
            assert.equal(get_sortdisco(true), 'osca'[idx], segment.name + ': persisted sort');
        }
        assert.equal(game.iflags.override_ID || 0, 0, 'temporary ID override cleared');
        assert.equal(game.objects[O.SPE_FORCE_BOLT].oc_uname || '', '',
            'sorting never names a temporary spellbook');
        assert.equal(OBJ_NAME(game.objects[O.SLIME_MOLD]), 'fruit',
            'C generic type name is distinct from the preferred fruit');
        for (const obj of game.invent || []) {
            assert.ok(obj.o_id > 0, 'no dummy discovery objects enter inventory');
            assert.equal(obj.where, OBJ_INVENT);
        }
        const s = segment.name;
        if (name === 'discovery-sort-order')
            continue;
        if (s.startsWith('class-')) {
            assert.equal(game.flags.menu_style,
                ['traditional', 'combination', 'full', 'partial'].indexOf(s.slice(6)));
        }
        if (s.startsWith('one-class-'))
            assert.equal(game.invent.length, 1);
        if (s === 'menu-style-live') assert.equal(game.flags.menu_style, 0);
        if (s === 'menu-style-cancel') assert.equal(game.flags.menu_style ?? 2, 2);
        if (/^(relics|tools|armor|weapons|gems|food)-identified$/.test(s)
            || ['artifact-identified', 'artifact-dump', 'artifact-alphabetical',
                'mixed-alphabetical', 'identified-menu-empty', 'identify-blind',
                'identify-all-accelerator', 'identify-invert', 'amulet-identified',
                'non-aligned-artifact', 'chaotic-role-artifact', 'novel-identified'].includes(s)) {
            assert.ok(game.invent.length > 0, s + ': real objects were identified');
            for (const obj of game.invent)
                assert.equal(not_fully_identified(obj), false, s + ': fully identified');
        }
        if (s.startsWith('relics-') || s === 'mixed-alphabetical') {
            for (const t of [O.BELL_OF_OPENING, O.SPE_BOOK_OF_THE_DEAD,
                             O.CANDELABRUM_OF_INVOCATION]) {
                assert.ok(game.objects[t].oc_encountered);
                assert.equal(!!game.objects[t].oc_name_known,
                    s === 'relics-identified' || s === 'mixed-alphabetical');
            }
        }
        if (['artifact-unknown', 'reveal-cancel', 'reveal-blind'].includes(s)) {
            assert.deepEqual(game.artidisco || [], [], s + ': revelation is not discovery');
            assert.equal(!!game.invent[0].known, false);
            assert.equal(game.invent[0].oartifact, ART_MAGICBANE);
        }
        if (['artifact-identified', 'artifact-dump', 'artifact-alphabetical',
             'mixed-alphabetical', 'identified-menu-empty', 'identify-blind',
             'chaotic-role-artifact'].includes(s))
            assert.deepEqual(game.artidisco, [ART_MAGICBANE]);
        if (s === 'non-aligned-artifact')
            assert.deepEqual(game.artidisco, [ART_FROST_BRAND]);
        if (s === 'identify-one' || s === 'identify-class') {
            assert.equal(game.objects[O.POT_SPEED].oc_name_known, 1);
            assert.equal(!!game.objects[O.POT_HEALING].oc_name_known, s === 'identify-class');
            assert.equal(!!game.objects[O.RIN_SEARCHING].oc_name_known, false);
        }
        if (s === 'named-order') {
            assert.equal(game.objects[O.POT_SPEED].oc_uname, 'Zeta');
            assert.equal(game.objects[O.POT_HEALING].oc_uname, 'Alpha');
            assert.equal(game.level.annotation || '', '', 'type names are not level annotations');
        }
        if (s === 'unseen-spell-star' || s === 'unseen-spell-blind-star') {
            const blind = s.includes('blind');
            assert.ok(cLines.includes('* spellbook of force bolt (thin)'));
            assert.equal(cLines.includes('  spellbook of force bolt (thin)'), !blind,
                'C classifies the dummy after writing the first encountered marker');
            assert.equal(!!game.objects[O.SPE_FORCE_BOLT].oc_encountered, !blind);
            assert.equal((game.invent || []).length, 0, 'classification makes no real spellbook');
        }
        if (s.includes('blind')) {
            assert.ok(game.u.uroleplay.blind);
            assert.ok(game.u.intrinsic.HBlinded & FROMOUTSIDE,
                s + ': permanent blindness retains its intrinsic source');
            if (s === 'reveal-blind')
                assert.equal(!!game.invent[0].dknown, false, 'temporary revelation cannot observe');
        }
        if (s === 'amulet-wish-decline' || s === 'amulet-identified') {
            assert.equal(game.u.uevent.amulet_wish, 1, 'initial Amulet wish occurs once');
            assert.equal(game.invent.length, 1, 'declining does not create a random object');
            assert.equal(game.invent[0].otyp, O.AMULET_OF_YENDOR);
            assert.equal(!!game.objects[O.AMULET_OF_YENDOR].oc_name_known,
                s === 'amulet-identified');
        }
        if (s === 'novel-encountered' || s === 'novel-identified')
            assert.equal(!!game.objects[O.SPE_NOVEL].oc_name_known, s === 'novel-identified');
    }
}

// C not_fully_identified's rknown, statue and undiscovered-artifact tails.
const obj = { otyp: O.LONG_SWORD, oclass: C.WEAPON_CLASS,
    quan: 1, known: 1, dknown: 1, bknown: 1, rknown: 0, corpsenm: NON_PM };
game.objects[O.LONG_SWORD].oc_name_known = 1;
assert.equal(not_fully_identified(obj), true, 'iron sword needs erosion knowledge');
obj.rknown = 1;
assert.equal(not_fully_identified(obj), false);
obj.oartifact = ART_FROST_BRAND;
game.artidisco = [];
assert.equal(not_fully_identified(obj), true, 'artifact discovery is independent of type');
game.artidisco = [ART_FROST_BRAND];
assert.equal(not_fully_identified(obj), false);
assert.equal(disp_artifact_discoveries(-1), 1, 'count-only path creates no window');
assert.equal(not_fully_identified({ oclass: C.COIN_CLASS }), false);
const statue = { ...obj, otyp: O.STATUE, oclass: C.ROCK_CLASS, oartifact: 0 };
game.objects[O.STATUE].oc_name_known = 1;
assert.equal(not_fully_identified(statue), true);
statue.cknown = 1;
assert.equal(not_fully_identified(statue), false);
const tin = { ...obj, otyp: O.TIN, oclass: C.FOOD_CLASS, oartifact: 0 };
fully_identify_obj(tin);
assert.equal(tin.cknown, 1);
assert.equal(tin.lknown || 0, 0, 'a tin has no lock knowledge');

// Classification respects the configured class order, including its fallback.
const cookie = {};
game.flags.sortpack = true;
game.flags.inv_order = [C.POTION_CLASS, ...inv_order().filter(c => c !== C.POTION_CLASS)];
loot_classify(cookie, { otyp: O.POT_SPEED, oclass: C.POTION_CLASS, dknown: 1 });
assert.equal(cookie.orderclass, 1);
game.flags.sortpack = false;
loot_classify(cookie, { otyp: O.POT_SPEED, oclass: C.POTION_CLASS, dknown: 1 });
assert.equal(cookie.orderclass, 5, 'C default sortloot order differs from packorder');
const helmet = { otyp: O.HELMET, oclass: C.ARMOR_CLASS, dknown: 1 };
const oldcat = game.objects[O.HELMET].oc_armcat;
game.objects[O.HELMET].oc_armcat = -1;
loot_classify(cookie, helmet);
assert.equal(cookie.subclass, 8, 'C guards invalid signed armor subclasses');
game.objects[O.HELMET].oc_armcat = oldcat;

// A display-only override preserves the actual blinded object's knowledge.
const blindCase = read('gen-sessions/recipes/discovery-identification.json')
    .segments.find(s => s.name === 'reveal-blind');
await replay(blindCase);
const art = game.invent[0];
const before = [art.known, art.dknown, art.bknown, art.rknown,
    game.objects[art.otyp].oc_name_known];
game.artiexist[ART_MAGICBANE].found = 0;
game.iflags.override_ID = '\t';
assert.equal(xname(art), 'Magicbane');
assert.ok(doname(art).includes('Magicbane'));
game.iflags.override_ID = 0;
assert.deepEqual([art.known, art.dknown, art.bknown, art.rknown,
    game.objects[art.otyp].oc_name_known], before);
assert.equal(game.artiexist[ART_MAGICBANE].found, 0, 'blind override does not find the artifact');
await make_blinded(9, false);
assert.equal(game.u.intrinsic.HBlinded & TIMEOUT, 9);
await make_blinded(0, false);
assert.ok(game.u.intrinsic.HBlinded & FROMOUTSIDE);
assert.equal(game.u.ublind, 1, 'clearing temporary blindness preserves the permanent source');
console.log(`discovery sorting state: PASS (${count} C scenarios plus source controls)`);
