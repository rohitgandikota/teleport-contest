// Source-derived controls for uhitm.c:4075 and attrib.c:490.
// Native recordings independently check complete gameplay output.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {mhitm_ad_phys} from '../js/uhitm.js';
import {mksobj} from '../js/mkobj.js';
import {makemon, NO_MINVENT, MM_NOMSG} from '../js/makemon.js';
import {dmgval} from '../js/weapon.js';
import {Hate_silver} from '../js/youprop.js';
import {PMNAMES, ATTKS} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {A_CON, M_ATTK_HIT} from '../js/const.js';
import {initRng, enableRngLog, getRngLog, rn2} from '../js/rng.js';

const base=JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/silver-weapon-hero-reactions.json', import.meta.url))).segments[0];
const seed=()=>{initRng(3); enableRngLog();};
const samples=[
    {name:'ordinary human', hates:false},
    {name:'human lycanthrope', lycan:true, hates:true, abuse:true},
    {name:'human lycanthrope at positive exercise limit', lycan:true, hates:true, exercise:50},
    {name:'human lycanthrope at negative exercise limit', lycan:true, hates:true, exercise:-50},
    {name:'human lycanthrope with quiet combat options', lycan:true, hates:true, abuse:true, verbose:false},
    {name:'vampire form', form:'PM_VAMPIRE', hates:true},
    {name:'demon form', form:'PM_HORNED_DEVIL', hates:true},
    {name:'shade form', form:'PM_SHADE', hates:true},
    {name:'imp form', form:'PM_IMP', hates:true},
    {name:'tengu form', form:'PM_TENGU', hates:false},
    {name:'ordinary orc form', form:'PM_ORC', hates:false},
    {name:'lycanthropic orc form', form:'PM_ORC', lycan:true, hates:true},
    {name:'vampire struck with iron', form:'PM_VAMPIRE', weapon:'LONG_SWORD', hates:true},
    {name:'human lycanthrope struck with iron', lycan:true, weapon:'LONG_SWORD', hates:true},
    {name:'vampire struck by a silver dagger', form:'PM_VAMPIRE', weapon:'SILVER_DAGGER', hates:true},
    {name:'claw attack while holding silver', form:'PM_VAMPIRE', claw:true, hates:true},
    {name:'unarmed weapon attack', form:'PM_VAMPIRE', unarmed:true, hates:true},
];

for (const sample of samples) test(sample.name, async()=>{
    const run=await runSegment({...base,moves:' ',storage:new InMemoryStorage()});
    let prompts=0;
    run._display.onEmptyQueue=()=>{
        if (++prompts>20) throw Error('unexpected repeated prompt');
        return 27;
    };
    game._preNhgetchHook=null;
    game.u.intrinsic={}; game.u.uprops={}; game.u.blocked={};
    game.u.ulycn=sample.lycan ? PMNAMES.PM_WEREWOLF : -1;
    const form=sample.form ? PMNAMES[sample.form] : game.u.umonster;
    assert.ok(Number.isInteger(form));
    game.u.umonnum=form; game.youmonst.mnum=form; game.youmonst.data=game.mons[form];
    game.u.uac=10; game.u.mh=1000; game.u.uhp=1000;
    game.u.aexe.a.fill(0); game.u.aexe.a[A_CON]=sample.exercise ?? 0;
    game.flags.verbose=sample.verbose ?? true;
    const mon=await makemon(game.mons[PMNAMES.PM_WATCH_CAPTAIN],0,0,NO_MINVENT|MM_NOMSG);
    const weapon=sample.unarmed ? null : mksobj(ONAMES[sample.weapon ?? 'SILVER_SABER'],false,false);
    mon.mw=weapon; mon.minvent=weapon ? [weapon] : [];
    game._toplines=''; game._msg_history=[];
    game.hitmsg_mid=0; game.hitmsg_prev=null;
    assert.equal(!!Hate_silver(),sample.hates);
    const weaponHit=!sample.claw && !!weapon;
    seed();
    const damage=1+(weaponHit ? dmgval(weapon,game.youmonst) : 0);
    const loss=sample.abuse ? rn2(2) : 0;
    const expected=[...getRngLog()];
    const next=rn2(101);
    seed();
    const mhm={damage:1,hitflags:0,done:0,indx:0};
    await mhitm_ad_phys(mon,[sample.claw ? ATTKS.AT_CLAW : ATTKS.AT_WEAP,ATTKS.AD_PHYS,1,1],game.youmonst,mhm);
    const text=[...game._msg_history,game._toplines].join('\n');
    const silver=weapon && ['SILVER_SABER','SILVER_DAGGER'].includes(sample.weapon ?? 'SILVER_SABER');
    assert.equal(text.includes('The silver sears your flesh!'),!!(weaponHit && silver && sample.hates));
    assert.equal(game.u.aexe.a[A_CON],(sample.exercise ?? 0)-loss);
    assert.deepEqual(getRngLog(),expected,'damage and Constitution draws retain their C order');
    assert.equal(rn2(101),next,'subsequent RNG stays aligned');
    assert.equal(mhm.damage,damage);
    assert.equal(mhm.hitflags & M_ATTK_HIT,M_ATTK_HIT);
    assert.equal(mhm.done,0);
});
