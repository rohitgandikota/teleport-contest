// C pager.c:663-676,801: role/race identity after real character initialization.
// Return-value controls are source evidence, not a native screen oracle.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {do_screen_description, self_lookat} from '../js/pager.js';
import {Role_if} from '../js/attrib.js';
import {Race_if} from '../js/u_init.js';
import {str2role, str2race, str2gend, str2align,
    validrole, validrace, validgend, validalign} from '../js/role.js';
import {PMNAMES} from '../js/monst_data.js';
import {Upolyd} from '../js/const.js';
import {Blind, Hallucination} from '../js/youprop.js';
import {make_blinded, make_hallucinated} from '../js/potion.js';
import {getRngLog} from '../js/rng.js';
import {m_at} from '../js/mon.js';

async function start({role='Wizard', race='gnome', gender='male',
                      align='neutral', mode='normal', moves=' '} = {}) {
    await runSegment({seed:99812, datetime:'20000110090000', moves,
        nethackrc:`OPTIONS=name:Desired,role:${role},race:${race},gender:${gender},align:${align},playmode:${mode}\n`
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
            + 'OPTIONS=symset:DECgraphics\n', storage:new InMemoryStorage()});
    assert.equal(game.flags.initrole, str2role(role));
    assert.equal(game.flags.initrace, str2race(race));
    assert.equal(game.flags.initgend, str2gend(gender));
    assert.equal(game.flags.initalign, str2align(align));
    assert.equal(game.u.umonster, game.urole.mnum);
    assert.equal(!!game.wizard, mode === 'debug');
    assert.ok(game.u.uhp > 0 && !game.u.umortality);
}

function selfDescription() {
    const calls = getRngLog().slice();
    const description = do_screen_description({x:game.u.ux, y:game.u.uy}, true, 0);
    assert.equal(typeof description?.then, 'undefined');
    assert.deepEqual(getRngLog(), calls, 'self inspection consumes no RNG');
    assert.equal(description.found, 1);
    assert.equal(description.firstmatch, self_lookat());
    assert.ok(description.out_str.includes(`(${description.firstmatch})`));
    return description;
}

function wizardIdentity() {
    assert.equal(Role_if(PMNAMES.PM_WIZARD), true);
    assert.equal(Race_if(PMNAMES.PM_GNOME), true);
    assert.equal(Upolyd(game.u), false);
    assert.equal(selfDescription().pm, game.mons[PMNAMES.PM_WIZARD]);
}

test('C eligibility permits both gnome Wizard genders and only neutral alignment', () => {
    const role = str2role('Wizard'), race = str2race('gnome');
    assert.equal(validrole(role), true);
    assert.equal(validrace(role, race), true);
    for (const gender of ['male', 'female'])
        assert.equal(validgend(role, race, str2gend(gender)), true);
    assert.equal(validalign(role, race, str2align('neutral')), true);
    assert.equal(validalign(role, race, str2align('lawful')), false);
    assert.equal(validalign(role, race, str2align('chaotic')), false);
});

for (const gender of ['male', 'female']) test(`normal ${gender} gnome Wizard returns the role species`, async () => {
    await start({gender});
    assert.equal(!!game.flags.female, gender === 'female');
    assert.equal(self_lookat(), 'gnomish wizard called Desired');
    wizardIdentity();
});

test('debug mode does not supply the role/race exception', async () => {
    await start({mode:'debug'});
    assert.equal(self_lookat(), 'gnomish wizard called wizard');
    wizardIdentity();
});

for (const [race, align] of [['human','neutral'], ['elf','chaotic']])
test(`${race} Wizard keeps the ordinary null self pointer`, async () => {
    await start({race, align});
    assert.equal(Role_if(PMNAMES.PM_WIZARD), true);
    assert.equal(Race_if(PMNAMES.PM_GNOME), false);
    assert.equal(Upolyd(game.u), false);
    assert.equal(selfDescription().pm, null);
});

for (const role of ['Healer', 'Ranger']) test(`gnome ${role} keeps the ordinary null self pointer`, async () => {
    await start({role});
    assert.equal(Role_if(PMNAMES.PM_WIZARD), false);
    assert.equal(Race_if(PMNAMES.PM_GNOME), true);
    assert.equal(Upolyd(game.u), false);
    assert.equal(selfDescription().pm, null);
});

const polyNewt = ' #polyself\rnewt\r  \x1b\x1b';
test('actual controlled polymorph excludes the birth-role exception', async () => {
    await start({mode:'debug', moves:polyNewt});
    assert.equal(game.u.umonnum, PMNAMES.PM_NEWT);
    assert.equal(game.u.umonster, PMNAMES.PM_WIZARD);
    assert.equal(Race_if(PMNAMES.PM_GNOME), true);
    assert.equal(Upolyd(game.u), true);
    assert.equal(self_lookat(), 'newt called wizard');
    assert.equal(selfDescription().pm, null);
});

test('actual reversion restores the role pointer without changing birth race', async () => {
    await start({mode:'debug', moves:polyNewt + '#polyself\rWizard\r  \x1b\x1b'});
    wizardIdentity();
});

test('real hallucination producer suppresses the special pointer at final return', async () => {
    await start();
    await make_hallucinated(100, false);
    assert.equal(Hallucination(), true);
    assert.equal(selfDescription().pm, null);
});

test('clearing hallucination restores the role pointer', async () => {
    await start();
    await make_hallucinated(100, false);
    await make_hallucinated(0, false);
    assert.equal(Hallucination(), false);
    wizardIdentity();
});

test('real blindness producer keeps self recognition and the role pointer', async () => {
    await start();
    await make_blinded(100, false);
    assert.equal(Blind(), true);
    wizardIdentity();
});

test('typed symbol description does not inspect the hero or acquire its pointer', async () => {
    await start();
    const calls = getRngLog().slice();
    const description = do_screen_description({x:game.u.ux,y:game.u.uy}, false, '@');
    assert.equal(description.pm, null);
    assert.ok(!description.out_str.includes('called Desired'));
    assert.deepEqual(getRngLog(), calls);
});

test('an adjacent empty square does not acquire the hero role pointer', async () => {
    await start();
    const {ux,uy} = game.u;
    const target = [[ux-1,uy],[ux+1,uy],[ux,uy-1],[ux,uy+1]]
        .find(([x,y]) => game.level.at(x,y)?.disp_glyph?.kind === 'cmap'
            && !m_at(x,y) && game.level.objectsAt(x,y).length === 0);
    assert.ok(target, 'real generated adjacent terrain');
    const description = do_screen_description({x:target[0],y:target[1]}, true, 0);
    assert.equal(description.pm, null);
    assert.ok(!description.out_str.includes('called Desired'));
});
