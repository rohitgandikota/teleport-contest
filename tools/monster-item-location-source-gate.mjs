// Source contracts only. Reading these C bodies does not measure native coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const sources = [];
const bodies = new Map();
for (const [module, names] of Object.entries({
    muse: ['mquaffmsg', 'precheck', 'use_defensive'],
    mon: ['mpickstuff', 'can_touch_safely', 'can_carry', 'check_gear_next_turn'],
    monmove: ['mon_would_take_item'],
    dogmove: ['could_reach_item'],
    pline: ['set_msg_xy', 'pline_mon', 'You_hear'],
    o_init: ['observe_object'],
    objnam: ['singular', 'distant_name'],
    steal: ['mpickobj'],
    mthrowu: ['m_useup', 'm_useupall'],
})) {
    const file = `nethack-c/recorder/src/${module}.c`;
    const text = read(file);
    for (const name of names) {
        const match = text.match(new RegExp(`^${name}\\([^]*?^}`, 'm'));
        assert.ok(match, `${file}:${name}`);
        bodies.set(`${module}.${name}`, match[0]);
        sources.push({ file, function: name,
            line: text.slice(0, match.index).split('\n').length,
            functionSha256: sha(match[0]), fileSha256: sha(text) });
    }
}
const c = name => bodies.get(name);
const js = (module, name) => read(`js/${module}.js`)
    .match(new RegExp(`^(?:export )?(?:async )?function ${name}\\([^]*?^}`, 'm'))?.[0] || '';
function ordered(text, ...parts) {
    let at = -1;
    for (const part of parts) {
        const next = text.indexOf(part, at + 1);
        assert.ok(next > at, `missing or misordered: ${part}`);
        at = next;
    }
}
const checks = [];
const failures = [];
function check(name, operation) {
    try {
        operation();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message.split('\n')[0] });
    }
}
const quaff = js('muse', 'mquaffmsg');
const pickup = js('mon', 'mpickstuff');

check('visible drinking attaches the actual monster location', () => {
    assert.match(c('muse.mquaffmsg'), /pline_mon\(mtmp, "%s drinks %s!"/);
    assert.match(quaff, /await pline_mon\(mtmp, `\$\{Monnam\(mtmp\)\} drinks/);
});
check('observation and singular naming precede the visible message', () => {
    ordered(c('muse.mquaffmsg'), 'canseemon(mtmp)', 'observe_object(otmp)',
        'pline_mon(mtmp', 'singular(otmp, doname)');
    ordered(quaff, 'canseemon(mtmp)', 'observe_object(obj)',
        'await pline_mon(mtmp', 'singular(obj, doname)');
    ordered(c('o_init.observe_object'), '!Hallucination', 'obj->dknown = 1', 'discover_object');
});
check('unseen drinking is heard only when the hero is not deaf', () => {
    assert.match(c('muse.mquaffmsg'), /else if \(!Deaf\)[^]*You_hear\("a chugging sound\."\)/);
    assert.match(quaff, /else if \(!Deaf\(\)\)[^]*await You_hear\('a chugging sound\.'\)/);
});
check('singular naming restores stack quantity before the awaited message', () => {
    ordered(c('objnam.singular'), 'savequan = otmp->quan', 'otmp->quan = 1L',
        '(*func)(otmp)', 'otmp->quan = savequan');
    ordered(js('objnam', 'singular'), 'savequan = otmp.quan', 'otmp.quan = 1',
        'func(otmp)', 'otmp.quan = savequan');
});
check('shared location helper preserves the hero special case and awaits printing', () => {
    ordered(c('pline.pline_mon'), 'mtmp == &gy.youmonst', 'set_msg_xy(0, 0)',
        'set_msg_xy(mtmp->mx, mtmp->my)', 'vpline(line, the_args)');
    ordered(js('pline', 'pline_mon'), 'mtmp === game.youmonst', 'set_msg_xy(0, 0)',
        'set_msg_xy(mtmp.mx, mtmp.my)', 'await pline(line)');
});
check('pickup preserves shop, reach, prize, corpse, touch and carry guard order', () => {
    ordered(c('mon.mpickstuff'), 'inhishop(mtmp)', 'rn2(25)', 'could_reach_item',
        'otmp2 = otmp->nexthere', 'is_mines_prize', 'is_soko_prize',
        'mon_would_take_item', 'otmp->otyp == CORPSE', 'can_touch_safely', 'can_carry');
    ordered(pickup, 'inhishop(mtmp)', 'rn2(25)', 'could_reach_item',
        'next = otmp.nexthere', 'is_mines_prize', 'is_soko_prize',
        'mon_would_take_item', 'otmp.otyp === ONAMES.CORPSE', 'can_touch_safely', 'can_carry');
});
check('pickup tests square visibility and names the floor object even when quiet', () => {
    ordered(c('mon.mpickstuff'), 'cansee(mtmp->mx, mtmp->my)',
        'distant_name(otmp, doname)', 'if (flags.verbose)', 'pline_mon(mtmp',
        'obj_extract_self(otmp3)');
    ordered(pickup, 'cansee(mtmp.mx, mtmp.my)', 'distant_name(otmp, doname)',
        'if (game.flags?.verbose)', 'await pline_mon(mtmp', 'obj_extract_self(otmp3)');
    assert.doesNotMatch(pickup, /canseemon\(/);
});
check('pickup feedback completes before extraction, transfer, gear and redraw', () => {
    ordered(c('mon.mpickstuff'), 'pline_mon(mtmp', 'obj_extract_self(otmp3)',
        'mpickobj(mtmp, otmp3)', 'check_gear_next_turn(mtmp)', 'newsym(', 'return TRUE');
    ordered(pickup, 'await pline_mon(mtmp', 'obj_extract_self(otmp3)',
        'await mpickobj(mtmp, otmp3)', 'check_gear_next_turn(mtmp)', 'newsym(', 'return true');
});
check('movement awaits the pickup result before its invisible-monster redraw', () => {
    assert.match(js('monmove', 'm_move'), /return await postmov\(mtmp/);
    assert.match(js('monmove', 'postmov'), /if \(await mpickstuff\(mtmp\)\)\s*mmoved = MMOVE_DONE;\s*if \(mtmp.minvis\)/);
});
check('ordinary carried-item acquisition remains canonical and may merge', () => {
    ordered(c('steal.mpickobj'), 'subfrombill(', 'otmp->no_charge = 0',
        'unknow_object(otmp)', 'carry_obj_effects(otmp)', 'add_to_minv(mtmp, otmp)');
    ordered(js('steal', 'mpickobj'), 'subfrombill(', 'otmp.no_charge = 0',
        'unknow_object(otmp)', 'carry_obj_effects(otmp)', 'add_to_minv(mtmp, otmp)');
    assert.doesNotMatch(pickup, /minvent\.(?:push|unshift)|delete otmp|dealloc_obj/);
});
check('healing and invisibility callers finish feedback before effects or consumption', () => {
    ordered(js('muse', 'use_defensive'), 'case MUSE_POT_HEALING:',
        'await mquaffmsg(mtmp, otmp)', 'd(6 + 2 * bcsign(otmp), 4)', 'await m_useup(mtmp, otmp)');
    const invis = js('muse', 'use_misc').split('case MUSE_POT_INVISIBILITY:')[1];
    ordered(invis, 'await mquaffmsg(mtmp, obj)', 'mtmp.perminvis', 'await m_useup(mtmp, obj)');
});
check('mquaffmsg remains private and neither feedback owner disposes monsters', () => {
    assert.ok(quaff.startsWith('async function mquaffmsg('));
    assert.equal((read('js/muse.js').match(/await mquaffmsg\(/g) || []).length, 9);
    assert.doesNotMatch(quaff + pickup, /mondead|mondied|monkilled|mongone|xkilled|make_corpse/);
});

console.log(JSON.stringify({ evidence: 'source-only', passed: checks.length,
    total: checks.length + failures.length, checks, failures, sources,
    limits: ['All nine active C mquaffmsg callers route through the shared JS helper.',
        'Audio Soundeffect output is outside terminal parity.'] }, null, 4));
process.exitCode = failures.length ? 1 : 0;
