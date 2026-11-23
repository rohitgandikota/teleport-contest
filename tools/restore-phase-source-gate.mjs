// Static pinned-source witnesses. This does not execute C or patch JS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
const sources = [];
const body = new Map();
const checks = [];
function readFunction(file, name) {
    const relative = `nethack-c/recorder/src/${file}.c`;
    const source = fs.readFileSync(new URL(relative, root), 'utf8');
    const match = source.match(new RegExp(`^${name}\\([^]*?^}`, 'm'));
    assert.ok(match, `${relative}: ${name}`);
    sources.push({ file: relative, function: name,
        line: source.slice(0, match.index).split('\n').length,
        sha256: hash(match[0]), fileSha256: hash(source) });
    body.set(`${file}.${name}`, match[0]);
    return match[0];
}
for (const [file, names] of Object.entries({
    restore: ['dorecover', 'restlevelfile', 'restlevelstate', 'restgamestate',
        'getlev', 'find_lev_obj', 'restobj', 'restobjchn', 'restmon', 'restmonchn',
        'restcemetery', 'rest_levl',
        'rest_stairs', 'restdamage', 'rest_bubbles', 'reset_oattached_mids',
        'rest_adjust_levelflags', 'moves_to_relative_time', 'relative_time_to_moves',
        'inven_inuse'],
    save: ['dosave0', 'savegamestate', 'savelev', 'savelev_core', 'saveobjchn',
        'savemon', 'savemonchn', 'savetrapchn', 'save_bubbles', 'save_stairs', 'saveobj', 'save_bc'],
    timeout: ['insert_timer', 'write_timer', 'obj_is_local', 'mon_is_local',
        'timer_is_local', 'save_timers', 'restore_timers', 'relink_timers'],
    light: ['save_light_sources', 'restore_light_sources', 'relink_light_sources'],
    mkobj: ['place_object', 'dealloc_obj'],
    do: ['obj_no_longer_held'],
    nhlua: ['restore_luadata'],
    worm: ['save_worm', 'rest_worm'],
    region: ['save_regions', 'rest_regions'],
    mkmaze: ['save_waterlevel', 'restore_waterlevel'],
    mkroom: ['rest_room', 'rest_rooms'],
    track: ['save_track', 'rest_track'],
    display: ['newsym'],
    dog: ['mon_catchup_elapsed_time'],
    mon: ['restore_cham', 'hide_monst'],
    o_init: ['restnames'],
    dungeon: ['load_exclusions']
})) {
    for (const name of names)
        readFunction(file, name);
}
function check(name, run) {
    run();
    checks.push(name);
}
function ordered(source, needles) {
    let after = 0;
    for (const needle of needles) {
        const at = source.indexOf(needle, after);
        assert.ok(at >= after, `missing/out of order: ${needle}`);
        after = at + needle.length;
    }
}
const recover = body.get('restore.dorecover');
check('current/global/temporary/other/original-current phase order', () => {
    ordered(recover, ['REST_GSTATE', 'getlev(nhfp, 0, (xint8) 0)',
        'restgamestate(nhfp)', 'restlevelfile(ledger_no(&u.uz))', 'REST_LEVELS',
        'getlev(nhfp, 0, ltmp)', 'restlevelfile(ltmp)', 'rewind_nhfile(nhfp)',
        'REST_CURRENT_LEVEL', 'getlev(nhfp, 0, (xint8) 0)', 'inven_inuse(FALSE)',
        'vision_reset()', 'run_timers()', 'program_state.restoring = 0']);
    assert.equal(recover.split('getlev(nhfp, 0, (xint8) 0)').length - 1, 2);
});
check('temporary file uses savelev write/free; restlevelstate has no work', () => {
    ordered(body.get('restore.restlevelfile'), ['create_levelfile',
        'nhfp->mode = WRITING | FREEING', 'savelev(nhfp, ltmp)']);
    assert.match(body.get('restore.restlevelstate'), /nothing left for restlevelstate/);
});
check('getlev loads local timers before floor placement, fixes them last', () => {
    ordered(body.get('restore.getlev'), ['program_state.in_getlev = TRUE',
        'rest_levl', 'lev-timestmp', 'rest_stairs', 'rest_adjust_levelflags',
        'rest_rooms', 'restore_timers', 'restore_light_sources',
        'fmon = restmonchn', 'rest_worm', 'newtrap', 'fobj = restobjchn',
        'find_lev_obj', 'level.buriedobjlist = restobjchn', 'billobjs = restobjchn',
        'rest_engravings', 'set_residency', 'restore_cham', 'restdamage',
        'rest_regions', 'rest_bubbles', 'load_exclusions', 'rest_track',
        'relink_timers', 'relink_light_sources', 'reset_oattached_mids']);
});
check('held hook has no restore guard; monster catchup does', () => {
    const held = body.get('do.obj_no_longer_held');
    assert.doesNotMatch(held, /restoring|in_getlev/);
    assert.match(held, /!obj->oerodeproof \|\| !rn2\(10\)/);
    assert.match(body.get('restore.getlev'),
        /if \(!u\.uz\.dlevel \|\| program_state\.restoring == REST_LEVELS\)\s*continue;/);
    const find = body.get('restore.find_lev_obj');
    ordered(find, ['place_object', 'if (u.uz.dlevel)', 'W_BALL | W_CHAIN']);
});
check('global role/hero/timer/inventory/Lua ordering', () => {
    ordered(body.get('restore.restgamestate'), ['gamestate-moves', 'gamestate-context',
        'gamestate-flags', 'role_init()', 'gamestate-you', 'restore_timers',
        'restore_light_sources', 'invent = restobjchn', 'migrating_objs = restobjchn',
        'migrating_mons = restmonchn', 'setworn(otmp', 'setuwep(otmp)',
        'restore_dungeon', 'restlevchn', 'restore_artifacts', 'restnames',
        'restore_luadata', 'relink_timers', 'relink_light_sources']);
    assert.match(body.get('nhlua.restore_luadata'), /if \(!gl.luacore\)\s*l_nhcore_init\(\)/);
});
check('save also loads each dormant level in ledger order', () => {
    ordered(body.get('save.dosave0'), ['savelev(nhfp, ledger_no(&u.uz))',
        'savegamestate(nhfp)', 'u.uz.dnum = u.uz.dlevel = 0',
        'for (ltmp = (xint8) 1; ltmp <= maxledgerno(); ltmp++)',
        'ltmp == ledger_no(&gu.uz_save)', 'getlev(onhfp, svh.hackpid, ltmp)',
        'savelev(nhfp, ltmp)']);
});
check('temporary disposal saves owners first and removes local queues first', () => {
    ordered(body.get('save.savelev_core'), ['save_timers', 'save_light_sources',
        'savemonchn', 'save_worm', 'savetrapchn', 'saveobjchn(nhfp, &fobj)',
        'saveobjchn(nhfp, &svl.level.buriedobjlist)', 'saveobjchn(nhfp, &gb.billobjs)',
        'save_engravings', 'save_regions', 'save_bubbles', 'save_track',
        'clear_level_structures']);
    ordered(body.get('save.saveobjchn'), ['saveobj(nhfp, otmp)', 'saveobjchn(nhfp, &otmp->cobj)',
        'context.victual.o_id', 'otmp->where = OBJ_FREE', 'otmp->timed = 0',
        'otmp->lamplit = 0', 'program_state.freeingdata++', 'dealloc_obj']);
});
check('object/context/backpointer reconstruction does not invoke container entry', () => {
    const objects = body.get('restore.restobjchn');
    ordered(objects, ['newobj()', 'restobj(nhfp, otmp)', 'restobjchn(nhfp, Is_IceBox',
        'otmp3->ocontainer = otmp', 'otmp->bypass = 0', 'context.victual.piece']);
    assert.doesNotMatch(objects, /add_to_container/);
    assert.match(body.get('restore.restobj'), /lua_ref_cnt = 0/);
});
check('timer insertion reverses ties and restore preserves saved IDs', () => {
    assert.match(body.get('timeout.insert_timer'), /curr->timeout >= gnu->timeout/);
    assert.doesNotMatch(body.get('timeout.restore_timers'), /start_timer/);
    assert.match(body.get('timeout.restore_timers'), /insert_timer\(curr\)/);
    assert.match(body.get('timeout.restore_timers'), /if \(ghostly\)\s*curr->timeout \+= adjust/);
});
check('regions age during copy even when monster catchup is skipped', () => {
    assert.match(body.get('region.rest_regions'), /tmstamp = \(svm.moves - tmstamp\)/);
    assert.doesNotMatch(body.get('region.rest_regions'), /REST_LEVELS|REST_GSTATE/);
    assert.match(body.get('restore.relative_time_to_moves'), /svm.moves \+ prevts/);
});
check('bubbles are restored from a saved marker, not u.uz', () => {
    assert.match(body.get('restore.rest_bubbles'), /if \(bbubbly\)\s*restore_waterlevel/);
    assert.match(body.get('mkmaze.restore_waterlevel'), /mv_bubble\(b, 0, 0, TRUE\)/);
});
check('ordinary restore leaves ghost-only attached IDs unchanged', () => {
    assert.match(body.get('restore.reset_oattached_mids'), /ghostly && has_omonst/);
    assert.match(body.get('restore.reset_oattached_mids'), /ghostly && has_omid/);
});
check('newsym must suppress transient restore/saving map writes', () => {
    assert.match(body.get('display.newsym'), /if \(_suppress_map_output\(\)\)\s*return;/);
});

const scopes = {
    save: ['save_checkpoint', 'dosave', 'dosave0', 'savegamestate', 'savelev', 'saveobjchn', 'savemon', 'savemonchn'],
    restore: ['find_lev_obj', 'inven_inuse', 'restobjchn', 'restmon', 'restmonchn',
        'restgamestate', 'restlevelfile', 'legacy_level', 'dorecover', 'rest_stairs', 'getlev'],
    do: ['goto_level'],
    allmain: [],
    nhlua: ['l_nhcore_init', 'restore_luadata', 'nhl_gamestate_save'],
    mkmaze: ['save_waterlevel', 'checkpoint_waterlevel', 'restore_waterlevel'],
    vision: ['checkpoint_vision'],
    worm: ['save_worm', 'rest_worm'],
    display: ['newsym']
};
const javascript = [];
const js = new Map();
for (const [file, names] of Object.entries(scopes)) {
    const relative = `js/${file}.js`;
    const source = fs.readFileSync(new URL(relative, root), 'utf8');
    const record = { file: relative, sha256: hash(source), functions: [] };
    for (const name of names) {
        const match = source.match(new RegExp(`^(?:export )?(?:async )?function ${name}\\([^]*?^}`, 'm'));
        assert.ok(match, `${relative}: ${name}`);
        const text = match[0];
        js.set(`${file}.${name}`, text);
        record.functions.push({ name, line: source.slice(0, match.index).split('\n').length, sha256: hash(text) });
    }
    javascript.push(record);
}
check('JS save and full restore use distinct level loads with C phase order', () => {
    ordered(js.get('save.dosave0'), ['savelev(', 'savegamestate(', 'game.u.uz =',
        'levels.sort(', 'await getlev(', 'savelev(', 'storage.setItem(']);
    ordered(js.get('restore.dorecover'), ['REST_GSTATE', 'await getlev(original)',
        'await restgamestate(saved)', 'restlevelfile(current)', 'REST_LEVELS',
        'await getlev(level)', 'restlevelfile(key)', 'REST_CURRENT_LEVEL',
        'await getlev(original)', 'max_rank_sz()', 'await inven_inuse()',
        'vision_reset()', 'await run_timers()', 'state.restoring = 0']);
    assert.equal(js.get('restore.dorecover').split('await getlev(original)').length - 1, 2);
    assert.match(js.get('restore.getlev'), /gamestate_decode\(gamestate_encode\(record\)\)/);
});
check('JS local owner loading preserves C unresolved placement and catchup boundaries', () => {
    ordered(js.get('restore.getlev'), ['restore_timers(', 'restore_light_sources(',
        'restmonchn(', 'rest_worm(', 'restobjchn(level.objects', 'await find_lev_obj()',
        'restobjchn(buried', 'restobjchn(level._saved_billobjs', 'set_residency(',
        'await mon_catchup_elapsed_time(', 'await restore_cham(', 'hide_monst(',
        'rest_regions(', 'await restore_waterlevel()', 'relink_timers(', 'relink_light_sources(']);
    assert.match(js.get('restore.getlev'),
        /if \(!game\.u\.uz\.dlevel \|\| state\.restoring === REST_LEVELS\)\s*continue;/);
    assert.match(js.get('restore.getlev'), /await hideunder\(mon\)/);
    assert.match(js.get('restore.getlev'), /await hide_monst\(mon\)/);
    assert.match(js.get('restore.find_lev_obj'), /await place_object\(/);
    assert.doesNotMatch(js.get('restore.restobjchn'), /add_to_container/);
});
check('JS role, hero, global owners and Lua retain C order', () => {
    ordered(js.get('restore.restgamestate'), ['role_init(', 'game.u = saved.u',
        'restore_timers(', 'restore_light_sources(', 'restobjchn(saved.invent',
        'restobjchn(saved.migrating_objs', 'restmonchn(saved.migrating_mons',
        'await setuwep(', 'restore_luadata()', 'relink_timers(', 'relink_light_sources(']);
    assert.match(js.get('nhlua.restore_luadata'), /if \(!game\.luacore\)/);
});
check('ordinary travel awaits the same getlev, and conditional inventory continuation remains', () => {
    ordered(js.get('do.goto_level'), ['savelev(', 'await getlev(']);
    assert.match(js.get('nhlua.nhl_gamestate_save'), /const freed = freeinv\(otmp\)/);
    assert.match(js.get('nhlua.nhl_gamestate_save'), /freed \? freed\.then\(remember\) : remember\(\)/);
    assert.match(js.get('nhlua.nhl_gamestate_save'), /stored\.then\(store_inventory\)/);
});
check('JS newsym suppresses restore output at the shared guard', () => {
    assert.match(js.get('display.newsym'), /if \(suppress_map_output\(\)\)\s*return;/);
});
console.log(JSON.stringify({ evidence: 'Static whole-function source audit, not compiled C',
    checks, sources, javascript }, null, 4));
