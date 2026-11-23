// Source-derived nested look_here controls, no C execution or runtime mocks.
// C invent.c:4104-4314 keeps verb fixed but re-evaluates Blind after contact.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {look_here,addinv,obj_extract_self} from '../js/invent.js';
import {mksobj,set_corpsenm,place_object} from '../js/mkobj.js';
import {Amulet_on} from '../js/do_wear.js';
import {setworn} from '../js/worn.js';
import {makemon,mpickobj} from '../js/makemon.js';
import {maketrap} from '../js/mklev.js';
import {polymon} from '../js/polyself.js';
import {gulpmu} from '../js/mhitu.js';
import {make_blinded} from '../js/potion.js';
import {Blind} from '../js/youprop.js';
import {initRng,enableRngLog,getRngLog} from '../js/rng.js';
import {PMNAMES,ATTKS} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {TOPLINE_EMPTY} from '../js/display.js';
import {ROOM,FROMOUTSIDE,POLY_TRAP,ECMD_OK,ECMD_TIME,W_ARMG} from '../js/const.js';

async function prepare({inside=true,form=PMNAMES.PM_ROCK_PIERCER,timed=0,stone=false,
                        life=true,trap=true,corpses=1,gloves=false,extra=false}={}) {
    const run=await runSegment({seed:6202,datetime:'20000110090000',moves:' ',storage:new InMemoryStorage(),
        nethackrc:'OPTIONS=role:Barbarian,race:human,gender:male,align:neutral,playmode:debug\n'
            +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!safe_wait\n'});
    let requests=0,recording=false,deathAnswers=0;
    const target=[...'goblin\r'],frames=[];
    run._display.onEmptyQueue=()=>{
        if(++requests>200)throw Error('unexpected input loop');
        const screen=game.nhDisplay.grid.map(row=>row.map(c=>c.ch).join('').trimEnd()).join('\n');
        if(recording)frames.push(screen);
        if(screen.includes('Become what kind of monster?')&&!screen.includes('--More--'))
            return (target.shift()||'\r').charCodeAt(0);
        if(screen.includes('Die?')){
            assert.equal(life,false,'amulet route must not rely on wizard refusal');
            deathAnswers++;return 'n'.charCodeAt(0);
        }
        return 32;
    };
    game._preNhgetchHook=null;
    game.level.monsters=[];game.level.monAt.clear();game.level.traps=[];
    for(const obj of [...game.level.objects])await obj_extract_self(obj);
    Object.assign(game.u,{ux:35,uy:10,ux0:35,uy0:10,ustuck:null,uswallow:false,utrap:0,uinwater:0});
    for(let y=6;y<=14;y++)for(let x=31;x<=39;x++)
        Object.assign(game.level.at(x,y),{typ:ROOM,lit:1});
    let amulet;
    if(life){amulet=await addinv(mksobj(ONAMES.AMULET_OF_LIFE_SAVING,false,false));await Amulet_on(amulet);}
    game.u.intrinsic.HPolymorph_control=FROMOUTSIDE;
    if(form!==null)assert.equal(await polymon(form),1);
    if(timed)await make_blinded(timed,false);
    if(stone)game.u.intrinsic.HStone_resistance=FROMOUTSIDE;
    if(gloves){const obj=await addinv(mksobj(ONAMES.LEATHER_GLOVES,false,false));await setworn(obj,W_ARMG);}
    let cloud;
    if(inside){
        cloud=makemon(game.mons[PMNAMES.PM_FOG_CLOUD],36,10,0);
        assert.ok(cloud);
        await gulpmu(cloud,cloud.data.mattk.find(a=>a[0]===ATTKS.AT_ENGL));
        assert.equal(game.u.uswallow,1);
    }
    const bodies=[];
    for(let index=0;index<corpses;index++){
        const corpse=mksobj(ONAMES.CORPSE,false,false);
        set_corpsenm(corpse,index?PMNAMES.PM_CHICKATRICE:PMNAMES.PM_COCKATRICE);
        if(inside)await mpickobj(cloud,corpse);else await place_object(corpse,35,10);
        bodies.push(corpse);
    }
    if(extra)await place_object(mksobj(ONAMES.DAGGER,false,false),35,10);
    if(inside&&trap)maketrap(game.u.ux,game.u.uy,POLY_TRAP);
    assert.equal(game.u.umortality??0,0);
    Object.assign(game,{_toplin:TOPLINE_EMPTY,_msg_history:[],_toplines:'',_prevmsg:'',_pending_message:'',_win_stop:false});
    game.vision_full_recalc=0;recording=true;
    initRng(617);enableRngLog();
    return {frames,amulet,bodies,cloud,deathAnswers:()=>deathAnswers};
}
async function inspect(name,setup,count=0){
    const beforeBlind=Blind(),result=await look_here(count,0);
    const row={name,result,beforeBlind,blind:Blind(),swallowed:!!game.u.uswallow,
        form:game.u.umonnum,mortality:game.u.umortality??0,
        intrinsicBlind:game.u.intrinsic.HBlinded??0,
        deathAnswers:setup.deathAnswers(),
        rng:getRngLog().map(call=>call.replace(/\s*@\s.*$/,''))};
    // Retain identical before/after streams independently of failing assertions.
    console.log('STATE_RECEIPT '+JSON.stringify(row));
    return {...row,text:[...game._msg_history,game._toplines,game._prevmsg].join('\n'),frames:setup.frames.join('\n')};
}
for(const assertion of ['return','header'])test(`swallowed lifesaving clears form blindness: ${assertion}`,async()=>{
    const s=await prepare(),r=await inspect(assertion,s);
    assert.equal(r.beforeBlind,true);assert.equal(r.blind,false);
    assert.equal(r.mortality,1);assert.equal(r.deathAnswers,0);
    assert.equal(r.swallowed,false);assert.equal(r.form,PMNAMES.PM_GOBLIN);
    assert.equal(game.u.uamul,null);assert.ok(!game.invent.includes(s.amulet));
    assert.match(r.text,/You try to feel what is lying in the fog cloud's interior/,'C snapshots verb before contact');
    assert.match(r.text,/You can see again/);
    if(assertion==='return')assert.equal(r.result,ECMD_OK,'C reads current Blind after nested completion');
    else{
        assert.match(r.frames,/Contents of the fog cloud's interior:/);
        assert.doesNotMatch(r.frames,/You feel:/);
    }
});
test('second engulfer corpse is not touched after the first restores sight',async()=>{
    const s=await prepare({corpses:2}),r=await inspect('two-corpses',s);
    assert.equal(r.blind,false);assert.equal(r.mortality,1);assert.equal(r.deathAnswers,0);
    assert.equal(s.cloud.minvent.length,2);
    assert.equal((r.text.match(/fatal mistake/g)||[]).length,1);
    assert.equal(r.result,ECMD_OK);assert.match(r.frames,/Contents of the fog cloud's interior:/);
});
test('wizard refusal follows the same completed expulsion without an amulet',async()=>{
    const s=await prepare({life:false}),r=await inspect('wizard-refusal',s);
    assert.equal(r.blind,false);assert.equal(r.mortality,1);assert.equal(r.deathAnswers,1);
    assert.match(r.text,/OK, so you don't die/);assert.equal(r.result,ECMD_OK);
});
test('independent timed blindness survives the form change',async()=>{
    const s=await prepare({timed:100}),r=await inspect('timed-control',s);
    assert.equal(r.form,PMNAMES.PM_GOBLIN);assert.equal(r.blind,true);
    assert.equal(r.intrinsicBlind,100);assert.equal(r.mortality,1);
    assert.equal(r.result,ECMD_TIME);assert.match(r.frames,/You feel:/);
});
test('lifesaving without a landing trap preserves form blindness',async()=>{
    const s=await prepare({trap:false}),r=await inspect('no-trap',s);
    assert.equal(r.form,PMNAMES.PM_ROCK_PIERCER);assert.equal(r.blind,true);
    assert.equal(r.mortality,1);assert.equal(r.swallowed,false);
    assert.equal(r.result,ECMD_TIME);assert.match(r.frames,/You feel:/);
});
for(const protection of ['sight','stone resistance','gloves'])test(`corpse contact guard: ${protection}`,async()=>{
    const s=await prepare({form:protection==='stone resistance'?PMNAMES.PM_ROCK_PIERCER:null,
        stone:protection==='stone resistance',gloves:protection==='gloves',timed:protection==='gloves'?100:0});
    const r=await inspect(protection,s);
    assert.equal(r.mortality,0);assert.equal(r.swallowed,true);
    assert.equal(game.u.uamul,s.amulet);assert.equal(r.rng.length,0);
    assert.equal(r.result,protection==='sight'?ECMD_OK:ECMD_TIME);
    assert.doesNotMatch(r.text,/fatal mistake|turn to stone/);
});
for(const branch of ['single','multi','pile-limit'])test(`floor ${branch}: ordinary lifesaving stays blind`,async()=>{
    const s=await prepare({inside:false,form:null,timed:100,extra:branch==='multi'});
    if(branch==='pile-limit')game.flags.pile_limit=1;
    const r=await inspect('floor-'+branch,s,branch==='pile-limit'?1:0);
    assert.equal(r.blind,true);assert.equal(r.intrinsicBlind,100);
    assert.equal(r.mortality,1);assert.equal(r.deathAnswers,0);
    assert.equal(r.result,ECMD_TIME);assert.equal(game.u.uamul,null);
    assert.ok(game.level.objects.includes(s.bodies[0]));
});
test('golem conversion keeps timed blindness and does not consume lifesaving',async()=>{
    const s=await prepare({inside:false,form:PMNAMES.PM_STRAW_GOLEM,timed:100});
    const r=await inspect('golem',s);
    assert.equal(r.form,PMNAMES.PM_STONE_GOLEM);assert.equal(r.blind,true);
    assert.equal(r.intrinsicBlind,100);assert.equal(r.mortality,0);
    assert.equal(r.result,ECMD_TIME);assert.equal(game.u.uamul,s.amulet);
    assert.match(r.text,/You touched/);assert.doesNotMatch(r.text,/fatal mistake/);
});
