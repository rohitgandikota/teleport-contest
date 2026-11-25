// C insight.c:468-724. Constructed boundaries use real form/XP producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {enlightenment,BASICENLIGHTENMENT,MAGICENLIGHTENMENT,
    ENL_GAMEINPROGRESS,ENL_GAMEOVERALIVE,ENL_GAMEOVERDEAD} from '../js/insight.js';
import {polymon,change_sex,body_part} from '../js/polyself.js';
import {more_experienced} from '../js/exper.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {HANDED,NON_PM,RIGHT_HANDED,LEFT_HANDED} from '../js/const.js';

function report(final=ENL_GAMEINPROGRESS,mode=BASICENLIGHTENMENT){
    const before=getRngLog().slice();
    const lines=enlightenment(mode,final);
    assert.deepEqual(getRngLog(),before,'inspection must not consume core RNG');
    return lines.join('\n');
}
async function form(species){
    assert.equal(await polymon(species),1);
    assert.equal(game.youmonst.data,game.mons[species]);
    assert.equal(game.youmonst.mnum,species);
}

for(const [species,part]of [
    [P.PM_OGRE,'handed'],[P.PM_MONKEY,'handed'],
    [P.PM_STONE_GOLEM,'handed'],[P.PM_AMOROUS_DEMON,'handed'],
    [P.PM_WATER_NYMPH,'handed'],[P.PM_OWLBEAR,'pawed'],
    [P.PM_GARGOYLE,'clawed'],[P.PM_FOG_CLOUD,'swirled'],
])test(`handedness uses real anatomy for species ${species}`,async()=>{
    await setup();await form(species);
    assert.equal(body_part(HANDED),part,'independent C anatomy expectation');
    const side=game.u.uhandedness===RIGHT_HANDED?'right':'left';
    assert.ok(report().includes(`You are ${part==='handed'?'':'normally '}${side}-handed.`));
});

for(const [hand,side]of [[RIGHT_HANDED,'right'],[LEFT_HANDED,'left']])
test(`unchanged natural body reports ${side} handedness`,async()=>{
    await setup();game.u.uhandedness=hand; // Explicit source boundary, not keyboard reach.
    assert.equal(body_part(HANDED),'handed');
    assert.ok(report().includes(`You are ${side}-handed.`));
    assert.doesNotMatch(report(),/normally .*handed/);
});

for(const final of [ENL_GAMEINPROGRESS,ENL_GAMEOVERALIVE,ENL_GAMEOVERDEAD])
for(const [species,description]of [[P.PM_OGRE,'male ogre'],[P.PM_FOG_CLOUD,'fog cloud']])
test(`form wording retains C tense ${species}/${final}`,async()=>{
    await setup();await form(species);
    assert.ok(report(final).includes(`You ${final?'were':'are'} ${final?'':'currently '}in ${description} form.`));
    if(final)assert.doesNotMatch(report(final),/currently in .* form/);
    assert.match(report(),/You are currently in /,'a final call must not leak its tense');
});

for(const final of [ENL_GAMEINPROGRESS,ENL_GAMEOVERALIVE])
for(const [base,shape,female,description]of [
    [P.PM_VAMPIRE,P.PM_VAMPIRE_BAT,false,'a male vampire in vampire bat form'],
    [P.PM_VAMPIRE,P.PM_FOG_CLOUD,false,'a vampire in fog cloud form'],
    [P.PM_VAMPIRE_LEADER,P.PM_WOLF,true,'a female vampire lady in wolf form'],
])test(`real vampire alternate form ${base}/${shape}/${final}`,async()=>{
    await setup();await form(base);
    if(!!game.flags.female!==female)change_sex();
    await form(shape);
    assert.equal(game.youmonst.cham,base);
    assert.equal(!!game.flags.female,female);
    assert.ok(report(final).includes(`You ${final?'were':'are'} ${final?'':'currently '}${description}.`));
});

test('a plain vampire bat is not a shifted vampire',async()=>{
    await setup();await form(P.PM_VAMPIRE_BAT);
    assert.equal(game.youmonst.cham,NON_PM);
    assert.match(report(),/You are currently in male vampire bat form\./);
    assert.doesNotMatch(report(),/a male vampire in vampire bat/);
});
test('a vampire in its own species retains ordinary form phrasing',async()=>{
    await setup();await form(P.PM_VAMPIRE);
    assert.equal(game.youmonst.cham,P.PM_VAMPIRE);
    assert.match(report(),/You are currently in male vampire form\./);
    assert.doesNotMatch(report(),/vampire in vampire form/);
});
test('magic-only inspection omits the entire background owner',async()=>{
    await setup();await form(P.PM_VAMPIRE);await form(P.PM_VAMPIRE_BAT);
    assert.doesNotMatch(report(0,MAGICENLIGHTENMENT),/Background:|currently a male vampire|handed\./);
});

for(const [amount,expected]of [[0,'0 experience points'],[1,'1 experience point']])
test(`ordinary XP display retains ${amount}`,async()=>{
    await setup();more_experienced(amount,0);
    assert.ok(report().includes(expected));
});
test('real XP producer preserves a C long beyond signed 32 bits',async()=>{
    await setup();
    // Each input fits the C int parameter and 4*exper fits int. The sum is long.
    for(let i=0;i<22;i++)more_experienced(100000000,0);
    assert.equal(game.u.uexp,2200000000);
    assert.match(report(),/2200000000 experience points, -2199999980 more needed to attain level 2/);
    assert.match(report(ENL_GAMEOVERALIVE),/2200000000 experience points, -2199999980 more were needed to attain level 2/);
});
test('polymorphed background omits XP even with a large stored value',async()=>{
    await setup();for(let i=0;i<22;i++)more_experienced(100000000,0);
    await form(P.PM_FOG_CLOUD);assert.doesNotMatch(report(),/experience points/);
});

test('final environmental time uses the captured flags',async()=>{
    await setup();game.iflags.at_midnight=true;game.iflags.at_night=true;
    assert.match(report(ENL_GAMEOVERDEAD),/It was the midnight hour\./);
    game.iflags.at_midnight=false;
    assert.match(report(ENL_GAMEOVERALIVE),/It was nighttime\./);
    assert.doesNotMatch(report(),/midnight hour|nighttime/,'fixed 09:00 startup remains daytime');
});
test('turn-one and later turn wording remains unchanged',async()=>{
    await setup();game.moves=1;assert.match(report(),/just started your adventure\./);
    game.moves=2;assert.match(report(),/entered the dungeon 2 turns ago\./);
});
