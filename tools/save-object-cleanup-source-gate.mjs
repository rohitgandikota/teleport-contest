#!/usr/bin/env node
// Whole-function pinned-C witnesses and changed-JS scope hashes, not a C oracle.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const hash = text => createHash('sha256').update(text).digest('hex');
const c = new Map();
const js = new Map();
const sources = [];
const checks = [];

function readFunction(language, file, name) {
    const path = language === 'C' ? `nethack-c/recorder/src/${file}.c` : `js/${file}.js`;
    const source = readFileSync(new URL(path, root), 'utf8');
    const pattern = language === 'C' ? `^${name}\\([^]*?^}`
        : `^(?:export )?(?:async )?function ${name}\\([^]*?^}`;
    const match = source.match(new RegExp(pattern, 'm'));
    assert.ok(match, `${path}: ${name}`);
    sources.push({ language, path, function: name,
        line: source.slice(0, match.index).split('\n').length,
        sha256: hash(match[0]), fileSha256: hash(source) });
    return match[0];
}

for (const [file, names] of Object.entries({
    save: ['dosave0'],
    end: ['done_object_cleanup', 'really_done'],
    restore: ['inven_inuse'],
    ball: ['placebc_core', 'unplacebc_core', 'check_restriction',
        'placebc', 'unplacebc_and_covet_placebc', 'lift_covet_and_placebc'],
    invent: ['useup', 'useupall', 'freeinv', 'freeinv_core', 'stackobj', 'perm_invent_toggled'],
    mkobj: ['place_object'],
    eat: ['food_disappears'],
    detect: ['object_detect']
})) {
    for (const name of names)
        c.set(`${file}.${name}`, readFunction('C', file, name));
}
for (const [file, names] of Object.entries({
    save: ['dosave0'], end: ['done_object_cleanup'], restore: ['inven_inuse']
})) {
    for (const name of names)
        js.set(`${file}.${name}`, readFunction('JS', file, name));
}

function ordered(source, needles) {
    let offset = 0;
    for (const needle of needles) {
        const index = source.indexOf(needle, offset);
        assert.ok(index >= offset, `missing/out of order: ${needle}`);
        offset = index + needle.length;
    }
}

function check(name, body) {
    body();
    checks.push(name);
}

check('C cleanup precedes save guard, file creation and later shutdown/date/free phases', () => {
    ordered(c.get('save.dosave0'), ['program_state.saving++', 'notice_mon_off()',
        'done_object_cleanup()', '!program_state.something_worth_saving',
        'nhfp = create_savefile()', 'if (!nhfp)', 'vision_recalc(2)',
        'change_luck(-1)', 'savelev(', 'savegamestate(']);
});
check('C cleanup order is quiet consumption, thrown, kicked, chain override, inventory flag', () => {
    ordered(c.get('end.done_object_cleanup'), ['inven_inuse(TRUE)',
        'ox = u.ux + u.dx', '!isok(ox, oy) || !accessible(ox, oy)',
        'gt.thrownobj->where == OBJ_FREE', 'place_object(gt.thrownobj, ox, oy)',
        'stackobj(gt.thrownobj), gt.thrownobj = 0',
        'gk.kickedobj->where == OBJ_FREE', 'place_object(gk.kickedobj, ox, oy)',
        'stackobj(gk.kickedobj), gk.kickedobj = 0', 'uchain->where == OBJ_FREE',
        'lift_covet_and_placebc(override_restriction)',
        'iflags.perm_invent = FALSE', 'perm_invent_toggled(TRUE)']);
});
check('C normal end already uses this shared cleanup, guarded only for panic', () => {
    assert.match(c.get('end.really_done'), /if \(!program_state\.panicking\)\s*done_object_cleanup\(\)/);
});
check('C inventory captures next before consuming and makes only the finishing message optional', () => {
    ordered(c.get('restore.inven_inuse'), ['otmp2 = otmp->nobj', 'if (otmp->in_use)',
        'if (!quietly)', 'pline("Finishing off %s...", xname(otmp))', 'useup(otmp)']);
    ordered(c.get('invent.useupall'), ['setnotworn(obj)', 'freeinv(obj)', 'obfree(obj']);
    ordered(c.get('invent.useup'), ['obj->quan > 1L', 'obj->in_use = FALSE',
        'obj->quan--', 'weight(obj)', 'update_inventory()', 'useupall(obj)']);
});
check('C ball placement accepts the override and handles the carried ball separately', () => {
    assert.match(c.get('ball.check_restriction'), /restriction == override_restriction/);
    ordered(c.get('ball.lift_covet_and_placebc'), ['check_restriction(pin)',
        'uchain->where != OBJ_FREE', 'placebc_core()']);
    ordered(c.get('ball.placebc_core'), ['flooreffects(uchain', 'if (carried(uball))',
        'flooreffects(uball', 'place_object(uball', 'place_object(uchain', 'bcrestriction = 0']);
});
check('C floor settlement retains shared held effects and incoming merge owner', () => {
    assert.match(c.get('mkobj.place_object'), /obj_no_longer_held\(otmp\)/);
    assert.match(c.get('invent.stackobj'), /merged\(&obj, &otmp\)/);
});
check('JS mirrors quiet consumption and awaits each original inventory item', () => {
    ordered(js.get('restore.inven_inuse'), ['quietly = false', '[...(game.invent || [])]',
        'if (obj.in_use)', 'if (!quietly)', 'await pline(', 'await useup(obj)']);
});
check('JS shared cleanup preserves C target, free-only and override decisions', () => {
    ordered(js.get('end.done_object_cleanup'), ['await inven_inuse(true)',
        'isok(ox, oy)', "['thrownobj', 'kickedobj']", 'obj.where === OBJ_FREE',
        'await place_object(obj, ox, oy)', 'stackobj(obj)', 'game[field] = null',
        'u.uchain.where === OBJ_FREE', 'await lift_covet_and_placebc(override_restriction)',
        'game.iflags.perm_invent = false']);
    assert.doesNotMatch(js.get('end.done_object_cleanup'), /await flooreffects/);
});
check('JS checkpoint follows completed cleanup and catches only storage refusal', () => {
    ordered(js.get('save.dosave0'), ['await done_object_cleanup()',
        'const rollback = save_checkpoint()', 'change_luck(-1)', 'savelev(',
        'savegamestate(', 'JSON.stringify(', 'try {\n            game.storage.setItem',
        'catch (error)', 'rollback()', 'return false', 'state.saving--']);
});
check('persistent inventory is not a supported active window in this pinned build/port', () => {
    const config = readFileSync(new URL('nethack-c/recorder/include/config.h', root), 'utf8');
    assert.match(config, /\/\* #define TTY_PERM_INVENT \*\//);
    const options = readFileSync(new URL('js/options.js', root), 'utf8');
    const supported = options.match(/const wc_supported_names = \[[^]*?\];/);
    assert.ok(supported);
    assert.doesNotMatch(supported[0], /perm_invent/);
});
check('C object detection exposes the retained local pile at the hero square', () => {
    ordered(c.get('detect.object_detect'), ['for (obj = fobj', 'u_at(obj->ox, obj->oy)',
        'unconstrain_map()', 'svl.level.objects[x][y]', 'map_object(obj, 1)',
        'if (!glyph_is_object(glyph_at(u.ux, u.uy)))',
        'newsym(u.ux, u.uy)', 'browse_map(ter_typ, "object")']);
});

console.log(JSON.stringify({ evidence: 'static pinned source, not native execution',
    checks, sources, passed: checks.length }, null, 4));
