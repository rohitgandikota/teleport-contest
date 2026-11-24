// Source contracts for artifact touch alignment. Native coverage is reported separately.
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
function ordered(text, ...parts) {
    let offset = -1;
    for (const part of parts) {
        const index = text.indexOf(part, offset + 1);
        assert.ok(index > offset, `missing or misordered: ${part}`);
        offset = index;
    }
}

check('ordinary monster touch uses the canonical C alignment consumer', () => {
    assert.match(owner, /oart->alignment != mon_aligntyp\(mon\)/);
    assert.match(read('js/artifact.js'), /import \{ mon_aligntyp \} from '\.\/priest\.js'/);
    assert.match(decision, /alignment !== mon_aligntyp\(mon\)/);
});
check('the touch decision adds no species exception or copied metadata logic', () => {
    assert.doesNotMatch(decision, /Math\.sign|\.maligntyp|\.min_align|\.shralign|PM_ANGEL/);
    assert.ok(!decision.startsWith('export'));
});
check('canonical precedence preserves A_NONE before sign normalization', () => {
    ordered(c('priest', 'mon_aligntyp'), 'mon->ispriest', 'EPRI(mon)->shralign',
        'mon->isminion', 'EMIN(mon)->min_align', 'mon->data->maligntyp', 'algn == A_NONE', 'algn > 0');
    const helper = js('priest', 'mon_aligntyp');
    ordered(helper, 'mon.ispriest', '.shralign', 'mon.isminion', '.min_align',
        'mon.data.maligntyp', 'alignment === A_NONE', 'alignment > 0');
    assert.doesNotMatch(helper, /\b(?:rn2|rnd|await|pline)\b/);
});
check('hero role, race, alignment record and nonartifact guards remain', () => {
    ordered(owner, 'touch_blasted = FALSE', 'ART_NONARTIFACT', 'mon == &gy.youmonst',
        'SPFX_INTEL', 'if (yours)', 'oart->role', 'oart->race', 'u.ualign.type', 'u.ualign.record < 0');
    ordered(decision, 'touch_blasted = false', 'artifact_records[0]', 'mon === game.youmonst',
        'SPFX_INTEL', 'if (yours)', 'role_match', 'race_match', 'game.u.ualign?.type', 'game.u.ualign?.record');
});
check('covetous and player-like exceptions precede the shared bane test', () => {
    ordered(owner, '!is_covetous(mon->data) && !is_mplayer(mon->data)',
        'badclass = badalign = FALSE', 'if (!badalign)', 'bane_applies(oart, mon)');
    ordered(decision, '!is_covetous(mon.data) && !is_mplayer(mon.data)',
        'badclass = badalign = false', 'if (!badalign)', 'bane_applies(oart, mon)');
});
check('the artifact restriction guard excludes artifact A_NONE', () => {
    assert.match(owner, /badalign = \(oart->spfx & SPFX_RESTR\) && oart->alignment != A_NONE/);
    assert.match(decision, /badalign = \(oart.spfx & SPFX_RESTR\) !== 0\s*&& alignment !== -128/);
});
check('Excalibur keeps its monster role exception', () => {
    assert.match(owner, /self_willed && oart->role != NON_PM\s*&& oart != &artilist\[ART_EXCALIBUR\]/);
    assert.match(decision, /self_willed && role !== 'NON_PM'\s*&& oart !== artifact_records\[ART_EXCALIBUR\]/);
});
check('monster eligibility stays synchronous with no damage or printing', () => {
    ordered(owner, 'if (!yours)', 'return 0;', 'You("are blasted by');
    ordered(decision, '(badalign && (!yours || !rn2(4)))', 'if (blast && !yours)', 'allowed: false, blast: false');
    const sync = js('artifact', 'touch_artifact_mon');
    assert.match(sync, /return artifact_touch_decision\(obj, mon\).allowed \? 1 : 0/);
    assert.doesNotMatch(sync, /\b(?:async|await|pline|You|rn2|losehp)\b/);
});
check('hero blast is awaited before damage, exercise and evasion', () => {
    ordered(owner, 'You("are blasted by', 'touch_blasted = TRUE', 'd((Antimagic ? 2 : 4)',
        'rnd(10)', 'losehp(', 'exercise(A_WIS', 'badclass && badalign && self_willed', 'if (yours)');
    ordered(use, 'await You(', 'touch_blasted = true', 'd(Antimagic() ? 2 : 4',
        'maybe_half_phys(rnd(10))', 'await losehp(', 'exercise(A_WIS', 'if (!decision.allowed)');
});
check('floor eligibility precedes feedback, extraction and acquisition', () => {
    ordered(c('mon', 'mpickstuff'), 'can_touch_safely(mtmp, otmp)', 'can_carry(mtmp, otmp)',
        'pline_mon(mtmp,', 'obj_extract_self(otmp3)', 'mpickobj(mtmp, otmp3)', 'check_gear_next_turn');
    ordered(js('mon', 'mpickstuff'), 'can_touch_safely(mtmp, otmp)', 'can_carry(mtmp, otmp)',
        'await pline_mon(mtmp,', 'obj_extract_self(otmp3)', 'await mpickobj(mtmp, otmp3)', 'check_gear_next_turn');
});
check('weapon selection uses monster eligibility before artifact preference', () => {
    ordered(c('weapon', 'select_hwep'), 'otmp->oartifact', 'touch_artifact(otmp, mtmp)', 'return otmp');
    ordered(js('weapon', 'select_hwep'), 'otmp.oartifact', 'touch_artifact_mon(otmp, mtmp)', 'return otmp');
});
check('forced mpickobj is not changed into an eligibility check', () => {
    assert.doesNotMatch(c('steal', 'mpickobj'), /touch_artifact\(/);
    assert.doesNotMatch(js('steal', 'mpickobj'), /touch_artifact(?:_mon)?\(/);
});
check('ordinary cleric creation owns EMIN before equipping inventory', () => {
    ordered(c('makemon', 'makemon'), 'mndx == PM_ALIGNED_CLERIC', 'newemin(mtmp)',
        'mtmp->isminion = 1', 'eminp->min_align = rn2(3) - 1', 'm_initweap(mtmp)');
    ordered(js('makemon', 'makemon'), 'mndx === PMNAMES.PM_ALIGNED_CLERIC', 'newemin(mtmp)',
        'mtmp.isminion = 1', 'mtmp.emin.min_align = rn2(3) - 1', 'm_initweap(mtmp)');
    ordered(c('read', 'create_particular_creation'), 'makemon(whichpm, u.ux, u.uy, mmflags)',
        'd->makepeaceful || d->makehostile', 'mtmp->mpeaceful =', 'set_malign(mtmp)');
    ordered(js('read', 'create_particular_creation'), 'await makemon(whichpm, game.u.ux, game.u.uy, mmflags)',
        'd.makepeaceful || d.makehostile', 'mtmp.mpeaceful =', 'set_malign(mtmp)');
});
check('hero hold caller awaits touch before dropping or inventory insertion', () => {
    ordered(c('invent', 'hold_another_object'), 'place_object(obj, u.ux, u.uy)',
        'touch_artifact(obj, &gy.youmonst)', 'obj_extract_self(obj)', 'dropy(obj)', 'return obj');
    ordered(js('invent', 'hold_another_object'), 'await place_object(obj, game.u.ux, game.u.uy)',
        'await touch_artifact(obj, game.youmonst)', 'obj_extract_self(obj)', 'await dropy(obj)', 'return obj');
});
check('spec_applies deliberately keeps its separate species-alignment contract', () => {
    const spec = c('artifact', 'spec_applies');
    ordered(spec, 'SPFX_DALIGN', 'ptr->maligntyp == A_NONE', 'sgn(ptr->maligntyp) != weap->alignment');
    const port = js('artifact', 'spec_applies');
    ordered(port, 'SPFX_DALIGN', 'ptr.maligntyp === -128', 'Math.sign(ptr.maligntyp) !== alignment');
    assert.doesNotMatch(spec + port, /mon_aligntyp/);
});
console.log(JSON.stringify({ evidence: 'source-only contracts, no native coverage',
    passed: checks.length, total: checks.length + failures.length, checks, failures, sources,
    limits: ['Async monster rejection feedback is a separate unchanged split-wrapper gap.',
        'C doeat artifact contact is absent from the captured JS caller and remains separate.',
        'Native recording for the new ordinary proposal is pending.'] }, null, 4));
process.exitCode = failures.length ? 1 : 0;
