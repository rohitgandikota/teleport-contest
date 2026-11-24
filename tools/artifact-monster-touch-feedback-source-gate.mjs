// Pinned C source contracts, separate from native execution coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const sources = [];
function body(path, name, javascript = false) {
    const text = read(path);
    const prefix = javascript ? '(?:export )?(?:async )?function ' : '';
    const match = text.match(new RegExp(`^${prefix}${name}\\([^]*?^}`, 'm'));
    assert.ok(match, `${path}:${name}`);
    sources.push({ path, function: name, line: text.slice(0, match.index).split('\n').length,
        functionSha256: sha(match[0]), fileSha256: sha(text) });
    return match[0];
}
const c = (file, name) => body(`nethack-c/recorder/src/${file}.c`, name);
const js = (file, name) => body(`js/${file}.js`, name, true);
const owner = c('artifact', 'touch_artifact');
const decision = js('artifact', 'artifact_touch_decision');
const use = js('artifact', 'touch_artifact');
const checks = [], failures = [];
function check(name, operation) {
    try {
        operation();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message.split('\n')[0] });
    }
}
function ordered(text, ...parts) {
    let offset = -1;
    for (const part of parts) {
        const index = text.indexOf(part, offset + 1);
        assert.ok(index > offset, `missing or misordered: ${part}`);
        offset = index;
    }
}
check('C rejects a monster before blast feedback or damage draws', () => {
    ordered(owner, 'if (!yours)', 'return 0;', 'You("are blasted by',
        'touch_blasted = TRUE', 'd((Antimagic ? 2 : 4)');
    ordered(decision, 'if (blast && !yours)', 'allowed: false, blast: false');
});
check('async refusal text is guarded by canonical hero identity', () => {
    assert.match(owner, /if \(badclass && badalign && self_willed\) \{\s*if \(yours\)/);
    assert.match(use, /if \(!decision.allowed\) \{\s*if \(mon === game.youmonst\)/);
    ordered(use, 'if (!decision.allowed)', 'if (mon === game.youmonst)',
        'await pline(', 'return 0;');
});
check('hero blast still awaits output before damage and control feedback', () => {
    ordered(use, 'await You(', 'touch_blasted = true', 'd(Antimagic()',
        'maybe_half_phys(rnd(10))', 'await losehp(', 'exercise(A_WIS', 'if (!decision.allowed)');
    ordered(use, "includes(obj)", "Tobjnam(obj, 'evade')", "Tobjnam(obj, 'are')");
});
check('the quiet monster predicate stays synchronous and silent', () => {
    const predicate = js('artifact', 'touch_artifact_mon');
    assert.match(predicate, /return artifact_touch_decision\(obj, mon\).allowed \? 1 : 0/);
    assert.doesNotMatch(predicate, /\b(?:async|await|pline|You|rn2|losehp)\b/);
});
check('rejection changes neither object chains nor monster HP', () => {
    const rejection = use.slice(use.indexOf('if (!decision.allowed)'));
    assert.doesNotMatch(rejection, /\b(?:rn2|rnd|d|freeinv|mpickobj|obj_extract_self|losehp)\(/);
    assert.doesNotMatch(rejection, /\.where\s*=|\.mhp\s*=/);
});
check('canonical alignment, covetous exceptions and bane ordering remain', () => {
    ordered(decision, '!is_covetous(mon.data) && !is_mplayer(mon.data)',
        'alignment !== mon_aligntyp(mon)', 'badclass = badalign = false',
        'bane_applies(oart, mon)', '(badalign && (!yours || !rn2(4)))');
    assert.doesNotMatch(decision, /PM_SMALL_MIMIC|PM_ANGEL/);
});
check('absorption checks protection and resistance before awaited touch', () => {
    ordered(c('steal', 'maybe_absorb_item'), 'obj == uball', 'ROCK_CLASS',
        'obj_resists(obj, 100 - ochance, 100 - achance)', '!touch_artifact(obj, mon)', 'return;');
    ordered(js('steal', 'maybe_absorb_item'), 'obj === game.u.uball', 'ROCK_CLASS',
        'obj_resists(obj, 100 - ochance, 100 - achance)', '!await touch_artifact(obj, mon)', 'return;');
});
check('accepted absorption retains removal, billing and transfer order', () => {
    ordered(c('steal', 'maybe_absorb_item'), 'remove_worn_item(', 'subfrombill(',
        'if (cansee(', 'freeinv(obj)', 'encumber_msg()', 'mpickobj(mon, obj)');
    ordered(js('steal', 'maybe_absorb_item'), 'await remove_worn_item(', 'subfrombill(',
        'if (cansee(', 'await freeinv(obj)', 'await encumber_msg()', 'await mpickobj(mon, obj)');
});
check('door-mimic discovery precedes the actual 50/10 absorption caller', () => {
    ordered(c('lock', 'pick_lock'), 'is_door_mappear(mtmp)', 'stumble_onto_mimic(mtmp)',
        'maybe_absorb_item(mtmp, pick, 50, 10)', 'return PICKLOCK_LEARNED_SOMETHING');
    ordered(js('lock', 'pick_lock'), 'is_door_mappear(mtmp)', 'await stumble_onto_mimic(mtmp)',
        'await maybe_absorb_item(mtmp, pick, 50, 10)', 'return PICKLOCK_LEARNED_SOMETHING');
});
check('apply keeps hero retouch and artifact speech on the same awaited path', () => {
    ordered(c('apply', 'doapply'), 'retouch_object(', 'pick_lock(', 'arti_speak(obj)');
    ordered(js('apply', 'doapply'), 'await retouch_object(', 'await pick_lock(', 'await arti_speak(obj)');
    ordered(js('artifact', 'arti_speak'), 'getrumor(', 'await pline(', 'await pline(', 'return ECMD_TIME');
});
check('real object resistance consumes one draw after invocation guards', () => {
    ordered(c('zap', 'obj_resists'), 'AMULET_OF_YENDOR', 'BELL_OF_OPENING',
        'rn2(100)', 'obj->oartifact ? achance : ochance');
    ordered(js('zap', 'obj_resists'), 'AMULET_OF_YENDOR', 'BELL_OF_OPENING',
        'rn2(100)', 'obj.oartifact ? achance : ochance');
});
check('ordinary creation applies the sleeping flag after the real maker', () => {
    ordered(c('read', 'create_particular_creation'), 'makemon(whichpm, u.ux, u.uy, mmflags)',
        'd->makepeaceful || d->makehostile', 'd->sleeping', 'mtmp->msleeping = 1');
    ordered(js('read', 'create_particular_creation'), 'await makemon(whichpm, game.u.ux, game.u.uy, mmflags)',
        'd.makepeaceful || d.makehostile', 'd.sleeping', 'mtmp.msleeping = 1');
});
check('actual door terrain produces a furniture mimic appearance', () => {
    ordered(c('makemon', 'set_mimic_sym'), 'IS_DOOR(typ) || IS_WALL(typ)',
        'ap_type = M_AP_FURNITURE', 'S_hcdoor', 'S_vcdoor');
    ordered(js('makemon', 'set_mimic_sym'), 'IS_DOOR(typ) || IS_WALL(typ)',
        'ap_type = M_AP_FURNITURE', 'S_hcdoor', 'S_vcdoor');
});
check('Master Key is a speaking intelligent chaotic Rogue artifact', () => {
    const table = read('nethack-c/recorder/include/artilist.h');
    assert.match(table, /A\("The Master Key of Thievery", SKELETON_KEY,[^]*?SPFX_INTEL[^]*?SPFX_SPEAK[^]*?A_CHAOTIC, PM_ROGUE/);
});
console.log(JSON.stringify({ evidence: 'source-only contracts, no new native coverage',
    passed: checks.length, total: checks.length + failures.length, checks, failures, sources,
    limits: ['doeat contact and spec_* alignment remain separate.',
        'No native execution of the new mimic proposal is claimed by this gate.'] }, null, 4));
process.exitCode = failures.length ? 1 : 0;
