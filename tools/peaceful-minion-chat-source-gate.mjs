// Source contracts for peaceful chat. Native coverage is reported separately.
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
const owner = c('sounds', 'domonnoise');
const use = js('sounds', 'domonnoise');
const helper = js('sounds', 'is_lawful_minion');
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

check('the private predicate uses the canonical C alignment contract', () => {
    assert.match(read('nethack-c/recorder/include/monst.h'),
        /is_minion\(\(mon\)->data\) && mon_aligntyp\(mon\) == A_LAWFUL/);
    assert.match(read('js/sounds.js'), /import \{ mon_aligntyp \} from '\.\/priest\.js'/);
    ordered(helper, 'MFLAGS.M2_MINION', 'return false', 'mon_aligntyp(mtmp) === A_LAWFUL');
});
check('classification adds no species exception or duplicated alignment owner', () => {
    assert.doesNotMatch(helper, /PM_|maligntyp|min_align|shralign|renegade|\b(?:rn2|await)\b/);
    assert.ok(!helper.startsWith('export'));
});
check('canonical alignment preserves priest/minion precedence and A_NONE', () => {
    ordered(c('priest', 'mon_aligntyp'), 'mon->ispriest', 'EPRI(mon)->shralign',
        'mon->isminion', 'EMIN(mon)->min_align', 'mon->data->maligntyp',
        'algn == A_NONE', 'algn > 0');
    const alignment = js('priest', 'mon_aligntyp');
    ordered(alignment, 'mon.ispriest', '.shralign', 'mon.isminion', '.min_align',
        'mon.data.maligntyp', 'alignment === A_NONE', 'alignment > 0');
    assert.doesNotMatch(alignment, /\b(?:rn2|rnd|await|pline)\b/);
});
check('Deaf and silent guards precede dispatch and invisible mapping', () => {
    ordered(owner, 'if (Deaf)', 'is_silent(ptr)', 'map_invisible(', 'switch (msound)');
    ordered(use, 'if (Deaf())', 'MSOUND.MS_SILENT', 'map_invisible(', 'switch (msound)');
});
check('peaceful cuss response does not borrow the hostile renegade guard', () => {
    const cBranch = owner.slice(owner.indexOf('case MS_CUSS:'), owner.indexOf('case MS_SPELL:'));
    const jsBranch = use.slice(use.indexOf('case MSOUND.MS_CUSS:'), use.indexOf('case MSOUND.MS_SPELL:'));
    ordered(cBranch, '!mtmp->mpeaceful', 'cuss(mtmp)', 'is_lminion(mtmp)',
        "It's not too late.", "We're all doomed.");
    ordered(jsBranch, '!mtmp.mpeaceful', 'await cuss(mtmp)', 'is_lawful_minion(mtmp)',
        "It's not too late.", "We're all doomed.");
    assert.doesNotMatch(cBranch + jsBranch, /renegade/);
});
check('bribable peaceful nontame monsters keep their earlier owner', () => {
    ordered(owner, 'case MS_BRIBE:', 'mtmp->mpeaceful && !mtmp->mtame',
        'demon_talk(mtmp)', 'case MS_CUSS:');
    ordered(use, 'case MSOUND.MS_BRIBE:', 'mtmp.mpeaceful && !mtmp.mtame',
        'await demon_talk(mtmp)', 'case MSOUND.MS_CUSS:');
});
check('selected text is delivered before the time-taking return', () => {
    ordered(owner, 'if (pline_msg)', 'mtmp->mcan && verbl_msg_mcan',
        'else if (verbl_msg)', 'verbalize1(verbl_msg)', 'return ECMD_TIME');
    ordered(use, 'if (pline_msg)', 'await pline(', 'mtmp.mcan && verbl_msg_mcan',
        'else if (verbl_msg)', 'await pline(', 'return ECMD_TIME');
});
check('ordinary chat resolves a real neighbor and awaits its response', () => {
    ordered(c('sounds', 'dochat'), 'getdir(', 'mtmp = m_at(tx, ty)',
        'helpless(mtmp)', 'mtmp->mstrategy &= ~STRAT_WAITMASK', 'return domonnoise(mtmp)');
    ordered(js('sounds', 'dochat'), 'await getdir(', 'mtmp = m_at(tx, ty)',
        'helpless(mtmp)', 'mtmp.mstrategy &= ~STRAT_WAITMASK', 'return await domonnoise(mtmp)');
});
check('beg restricts its domonnoise caller to animal sounds', () => {
    ordered(c('sounds', 'beg'), '!is_silent(mtmp->data)', 'msound <= MS_ANIMAL', 'domonnoise(mtmp)');
    ordered(js('sounds', 'beg'), '!is_silent(ptr)', 'msound <= MSOUND.MS_ANIMAL', 'await domonnoise(mtmp)');
});
check('forced pet ranged fallback awaits noise and preserves its result', () => {
    ordered(c('dogmove', 'pet_ranged_attk'), 'else if (forced)', 'domonnoise(mtmp)', 'return MMOVE_NOTHING');
    ordered(js('dog', 'pet_ranged_attk'), 'else if (forced)', 'await domonnoise(mtmp)', 'return MMOVE_NOTHING');
});
check('ordinary creator sets disposition after makemon without replacing alignment', () => {
    ordered(c('read', 'create_particular_creation'), 'makemon(whichpm, u.ux, u.uy, mmflags)',
        'd->makepeaceful || d->makehostile', 'mtmp->mpeaceful =', 'set_malign(mtmp)');
    ordered(js('read', 'create_particular_creation'), 'await makemon(whichpm, game.u.ux, game.u.uy, mmflags)',
        'd.makepeaceful || d.makehostile', 'mtmp.mpeaceful =', 'set_malign(mtmp)');
});
console.log(JSON.stringify({ evidence: 'source-only contracts, no native coverage',
    passed: checks.length, total: checks.length + failures.length, checks, failures, sources,
    limits: ['C tiphat callers have no captured JS implementation and are separately documented.',
        'Selected peaceful CUSS owner only; other domonnoise and dochat gaps are unchanged.',
        'Artifact alignment is not a dependency or part of this patch.'] }, null, 4));
process.exitCode = failures.length ? 1 : 0;
