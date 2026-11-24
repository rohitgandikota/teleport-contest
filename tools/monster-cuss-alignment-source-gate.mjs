// Pinned source contracts. State and immutable native gates are separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { questtext } from '../js/quest_data.js';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
const sources = [];
function body(file, name, javascript = false) {
    const text = read(file);
    const prefix = javascript ? '(?:export )?(?:async )?function ' : '';
    const match = text.match(new RegExp(`^${prefix}${name}\\([^]*?^}`, 'm'));
    assert.ok(match, `${file}:${name}`);
    sources.push({ file, function: name, line: text.slice(0, match.index).split('\n').length,
        functionSha256: hash(match[0]), fileSha256: hash(text) });
    return match[0];
}
const c = (module, name) => body(`nethack-c/recorder/src/${module}.c`, name);
const js = (module, name) => body(`js/${module}.js`, name, true);
const owner = c('wizard', 'cuss');
const use = js('wizard', 'cuss');
const helper = js('wizard', 'is_lawful_minion_for_cuss');
const align = c('priest', 'mon_aligntyp');
const jsAlign = js('priest', 'mon_aligntyp');
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
    let position = -1;
    for (const part of parts) {
        const next = text.indexOf(part, position + 1);
        assert.ok(next > position, `missing or misordered: ${part}`);
        position = next;
    }
}

check('C minion macro uses canonical alignment; JS reuses that helper', () => {
    assert.match(read('nethack-c/recorder/include/monst.h'),
        /is_minion\(\(mon\)->data\) && mon_aligntyp\(mon\) == A_LAWFUL/);
    assert.match(read('js/wizard.js'), /import \{ mon_aligntyp \} from '\.\/priest\.js'/);
    ordered(helper, 'MFLAGS.M2_MINION', 'return false', 'mon_aligntyp(mtmp) === A_LAWFUL');
});
check('classification has no species special case or copied alignment implementation', () => {
    assert.doesNotMatch(helper, /PM_|maligntyp|min_align|shralign|\b(?:rn2|rnd|await)\b/);
    assert.ok(!helper.startsWith('export'));
});
check('canonical helper preserves shrine, minion, species precedence and A_NONE', () => {
    ordered(align, 'mon->ispriest', 'EPRI(mon)->shralign', 'mon->isminion',
        'EMIN(mon)->min_align', 'mon->data->maligntyp', 'algn == A_NONE', 'algn > 0');
    ordered(jsAlign, 'mon.ispriest', '.shralign', 'mon.isminion', '.min_align',
        'mon.data.maligntyp', 'alignment === A_NONE', 'alignment > 0');
    assert.doesNotMatch(jsAlign, /\b(?:rn2|rnd|await|pline)\b/);
});
check('Deaf and Wizard precede lawful classification; renegades remain excluded', () => {
    ordered(owner, 'if (Deaf)', 'return;', 'mtmp->iswiz', 'is_lminion(mtmp)',
        'mtmp->isminion && EMIN(mtmp)->renegade', 'com_pager("angel_cuss")');
    ordered(use, 'if (Deaf())', 'return;', 'mtmp.iswiz', 'is_lawful_minion_for_cuss(mtmp)',
        'mtmp.isminion', 'mtmp.emin?.renegade', "await com_pager('angel_cuss')");
});
check('fallback retains the minion-specific aspersion modulus and demon table', () => {
    ordered(owner, 'rn2(is_minion(mtmp->data) ? 100 : 5)', 'casts aspersions',
        'com_pager("demon_cuss")');
    ordered(use, 'rn2((ptr.mflags2 & MFLAGS.M2_MINION) ? 100 : 5)', 'casts aspersions',
        "await com_pager('demon_cuss')");
});
check('message completion precedes the unchanged wakeup tail', () => {
    ordered(owner, 'com_pager("demon_cuss")', 'wake_nearto(mtmp->mx, mtmp->my, 5 * 5)');
    ordered(use, "await com_pager('demon_cuss')", 'await wake_nearto(mtmp.mx, mtmp.my, 5 * 5)');
    assert.match(c('mon', 'wake_nearto_core'), /dist2\(mtmp->mx, mtmp->my, x, y\) < distance/);
    assert.match(js('mon', 'wake_nearto_core'), /dist2\(mtmp.mx, mtmp.my, x, y\) < distance/);
});
check('both actual caller owners wait for cuss completion', () => {
    assert.match(c('monmove', 'dochug'), /inrange[^]*MS_CUSS[^]*!mtmp->mpeaceful[^]*!rn2\(5\)\)\s*cuss\(mtmp\)/);
    assert.match(js('monmove', 'dochug'), /MSOUND.MS_CUSS[^]*!mtmp.mpeaceful[^]*await cuss\(mtmp\)/);
    assert.match(c('sounds', 'domonnoise'), /case MS_CUSS:\s*if \(!mtmp->mpeaceful\)\s*cuss\(mtmp\)/);
    assert.match(js('sounds', 'domonnoise'), /case MSOUND.MS_CUSS:\s*if \(!mtmp.mpeaceful\)[^]*?await cuss\(mtmp\)/);
});
check('the real pager uses the C-sized tables and awaits message delivery', () => {
    assert.equal(questtext.common.angel_cuss.length, 14);
    assert.equal(questtext.common.demon_cuss.length, 27);
    ordered(c('questpgr', 'com_pager_core'), 'nhl_init(', 'nhl_loadlua(',
        'nelems = rn2(nelems) + 1', 'deliver_by_pline(text)');
    ordered(js('questpgr', 'com_pager_core'), 'nhl_init()', 'rn2(list.length)',
        'await deliver_by_pline(text)');
    assert.match(js('questpgr', 'deliver_by_pline'), /await pline\(convert_line\(line\)\)/);
});
check('roamer producer owns the override and renegade flags', () => {
    ordered(c('priest', 'mk_roamer'), 'EMIN(roamer)->min_align = alignment',
        'EMIN(roamer)->renegade = (coaligned && !peaceful)', 'roamer->ispriest = 0',
        'roamer->isminion = 1');
    ordered(js('priest', 'mk_roamer'), 'min_align: alignment',
        'renegade: !!(coaligned && !peaceful)', 'roamer.ispriest = 0', 'roamer.isminion = 1');
});
check('temple producer owns shrine alignment and marks priest rather than minion', () => {
    ordered(c('priest', 'priestini'), 'shralign = Amask2align',
        'priest->ispriest = 1', 'priest->isminion = 0');
    ordered(js('priest', 'priestini'), 'shralign: Amask2align',
        'priest.ispriest = 1', 'priest.isminion = 0');
});

console.log(JSON.stringify({ evidence: 'source-only contracts, not native coverage',
    passed: checks.length, total: checks.length + failures.length, checks, failures, sources,
    limits: ['Peaceful sounds.js classification remains a separately reported duplicate gap.',
        'No new native credit for priest, renegade, Deaf or Wizard cuss branches.',
        'No production export or alignment-helper implementation changed.'] }, null, 4));
process.exitCode = failures.length ? 1 : 0;
