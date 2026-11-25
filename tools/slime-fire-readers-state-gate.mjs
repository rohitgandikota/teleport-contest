// Constructed source checks using normal imports and actual property producers.
// Ordinary startup, wish and lava-entry keys establish legal owner inputs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {artifact_hit} from '../js/artifact.js';
import {dosit} from '../js/sit.js';
import {toss_up} from '../js/dothrow.js';
import {freeinv} from '../js/invent.js';
import {make_slimed} from '../js/potion.js';
import {mhitm_ad_slim} from '../js/uhitm.js';
import {makemon} from '../js/makemon.js';
import {find_delayed_killer} from '../js/end.js';
import {pline,tty_clear_nhwindow_message} from '../js/display.js';
import {Fire_resistance,Wwalking} from '../js/youprop.js';
import {PMNAMES,ATTKS} from '../js/monst_data.js';
import {SLIMED,TT_LAVA,ECMD_TIME,NO_MINVENT,MM_NOGRP,MM_ADJACENTOK} from '../js/const.js';
import {initRng,enableRngLog,getRngLog} from '../js/rng.js';

const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/slime-fire-readers.json',import.meta.url)));
const reports=[];
const slime=()=>game.u.uprops?.SLIMED||0;
const text=()=>[...(game._msg_history||[]),game._toplines,game._prevmsg].join('\n');
function state(){return {slime:slime(),alias:game.u.intrinsic?.HSlimed||0,
    killer:find_delayed_killer(SLIMED)?.name||null,hp:game.u.uhp,
    trap:game.u.utrap||0,traptype:game.u.utraptype||0,
    appearance:game.youmonst.mappearance||0,apType:game.youmonst.m_ap_type||0};}
async function setup(name,{stopBurn=false}={}){
    const part=recipe.segments.find(s=>s.name===name);
    assert.ok(part,name);
    const action=name.includes('lava')||name.includes('floor')?'#sit\r':'ta<';
    let moves=part.moves.slice(0,part.moves.indexOf(action));
    // Timer fixtures below use make_slimed or the actual monster attack instead.
    moves=moves.replace('#wizintrinsic\r100c\r\x1b\x1b','');
    const nethackrc=part.nethackrc+(stopBurn?'MSGTYPE=stop "The slime that covers you is burned away!"\n':'');
    const run=await runSegment({...part,moves,nethackrc,storage:new InMemoryStorage()});
    let reads=0;
    run._display.onEmptyQueue=()=>{assert.ok(++reads<=20,'bounded More completion');return 32;};
    tty_clear_nhwindow_message(game._topl_cury||0);
    assert.equal(slime(),0);
    assert.equal(game.u.intrinsic?.HSlimed||0,0);
    assert.ok(!game.program_state.gameover);
    return run;
}
async function produce(natural=false){
    if(natural){
        const mon=await makemon(game.mons[PMNAMES.PM_GREEN_SLIME],game.u.ux,game.u.uy,
            NO_MINVENT|MM_NOGRP|MM_ADJACENTOK);
        assert.ok(mon,'real green slime');
        const attack=mon.data.mattk.find(a=>a[1]===ATTKS.AD_SLIM);
        assert.ok(attack,'actual monster attack');
        await mhitm_ad_slim(mon,attack,game.youmonst,{damage:1,hitflags:0,done:false});
        assert.equal(slime(),10);
        assert.equal(find_delayed_killer(SLIMED)?.name,'green slime');
    }else{
        await make_slimed(100,null);
        assert.equal(slime(),100);
    }
    assert.equal(game.u.intrinsic?.HSlimed||0,0);
    tty_clear_nhwindow_message(game._topl_cury||0);
}
function seed(){initRng(7);enableRngLog();}
async function artifact(){
    const obj=game.invent[0],damage={v:5};
    assert.ok(obj.oartifact,'normally wished artifact');
    const result=await artifact_hit(null,game.youmonst,obj,damage,10);
    return {result,damage:damage.v,bonus:game.spec_dbon_applies};
}
async function check(name,body){
    await test(name,async()=>{
        const report={name};
        try{await body(report);report.pass=true;}
        catch(error){report.pass=false;report.error=error.message;throw error;}
        finally{report.after=state();report.rng=[...getRngLog()];reports.push(report);}
    });
}

for(const [name,base,natural] of [
    ['fire clears setter timer','fire-healthy',false],
    ['fire clears real monster slime and delayed killer','fire-healthy',true],
    ['resisted fire still clears slime','fire-resistant-slimed',false],
]) await check(name,async r=>{
    await setup(base);await produce(natural);seed();r.before=state();
    r.owner=await artifact();
    assert.equal(r.owner.result,true);
    assert.equal(r.owner.damage,Fire_resistance()?5:10);
    assert.equal(slime(),0);assert.equal(find_delayed_killer(SLIMED),null);
    assert.match(text(),/The slime that covers you is burned away!/);
    assert.equal(game.u.uhp,r.before.hp,'artifact owner leaves base HP damage to its caller');
});
await check('fire without slime is unchanged',async r=>{
    await setup('fire-healthy');seed();r.before=state();r.owner=await artifact();
    assert.equal(slime(),0);assert.doesNotMatch(text(),/slime that covers you/);
    assert.deepEqual(state(),r.before);assert.equal(r.owner.damage,10);
});
await check('cold artifact preserves slime',async r=>{
    await setup('cold-slimed');await produce();seed();r.before=state();r.owner=await artifact();
    assert.equal(slime(),100);assert.match(text(),/ice-cold blade/);
    assert.doesNotMatch(text(),/slime that covers you/);
});
await check('ordinary thrown sword preserves slime',async r=>{
    await setup('ordinary-sword-slimed');await produce();seed();r.before=state();
    const obj=game.invent[0];assert.ok(!obj.oartifact);await freeinv(obj);
    assert.equal(await toss_up(obj,true),true);
    assert.equal(slime(),100);assert.ok(game.u.uhp<r.before.hp);
    assert.doesNotMatch(text(),/slime that covers you/);
});
await check('fire against a monster does not cure hero slime',async r=>{
    await setup('fire-healthy');await produce();
    const mon=await makemon(game.mons[PMNAMES.PM_GOBLIN],game.u.ux,game.u.uy,NO_MINVENT|MM_NOGRP|MM_ADJACENTOK);
    assert.ok(mon);seed();r.before=state();
    await artifact_hit(game.youmonst,mon,game.invent[0],{v:5},10);
    assert.equal(slime(),100);assert.doesNotMatch(text(),/slime that covers you/);
});
for(const [name,base,natural,active,burns] of [
    ['trapped lava clears setter timer','trapped-lava-healthy',false,true,true],
    ['trapped lava clears real monster slime and killer','trapped-lava-healthy',true,true,true],
    ['trapped lava without slime is unchanged','trapped-lava-healthy',false,false,false],
    ['surface lava already clears slime','surface-lava-healthy',false,true,true],
    ['surface lava without slime is unchanged','surface-lava-healthy',false,false,false],
    ['ordinary stairs preserve slime','ordinary-floor-slimed',false,true,false],
]) await check(name,async r=>{
    await setup(base);
    if(base.startsWith('trapped')){assert.equal(game.u.utraptype,TT_LAVA);assert.ok(game.u.utrap>0);assert.ok(Fire_resistance());}
    if(base.startsWith('surface')){assert.ok(!game.u.utrap);assert.ok(Wwalking());}
    if(active)await produce(natural);
    seed();r.before=state();assert.equal(await dosit(),ECMD_TIME);
    assert.equal(slime(),burns?0:active?100:0);
    if(burns){assert.match(text(),/slime that covers you is burned away/);assert.equal(find_delayed_killer(SLIMED),null);}
    else assert.doesNotMatch(text(),/slime that covers you/);
    if(base.includes('lava'))assert.ok(game.u.uhp<r.before.hp);
    if(base.startsWith('trapped'))assert.ok(game.u.utrap>r.before.trap,'owner extends trap before caller turn processing');
});

for(const owner of ['artifact','sit'])for(const phase of ['owner-message','burn-message']){
    await check(`${owner} awaits ${phase} More and finishes`,async r=>{
        const run=await setup(owner==='artifact'?'fire-healthy':'trapped-lava-healthy',{stopBurn:phase==='burn-message'});
        await produce(true);
        if(phase==='owner-message')await pline('An earlier message fills the line before the next source-owned action begins.');
        seed();r.before=state();
        let release,paused,complete=false;
        const atPause=new Promise(resolve=>{paused=resolve;});
        run._display.onEmptyQueue=()=>{paused('paused');return new Promise(resolve=>{release=resolve;});};
        const action=(owner==='artifact'?artifact():dosit()).then(value=>{complete=true;return value;});
        try{
            const outcome=await Promise.race([atPause,action.then(()=> 'completed')]);
            assert.equal(outcome,'paused','source action must await the requested More');
            await setImmediate();assert.equal(complete,false);
            r.pending=state();r.pendingRng=[...getRngLog()];
            assert.equal(game.u.uhp,r.before.hp);assert.equal(game.u.utrap||0,r.before.trap);
            assert.equal(slime(),phase==='owner-message'?10:0);
            assert.equal(find_delayed_killer(SLIMED)?.name,'green slime','cleanup follows the awaited burn message');
            if(owner==='sit')assert.ok(!getRngLog().some(x=>/^(rnd\(4\)|d\(2,10\))/.test(x)));
        }finally{
            let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<=10);return 32;};
            release?.(32);await action;
        }
        assert.equal(slime(),0);assert.equal(find_delayed_killer(SLIMED),null);
        assert.equal(complete,true);assert.match(text(),/slime that covers you is burned away/);
    });
}
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({evidence:'Constructed JS source controls, not native parity',reports},null,2)+'\n');
