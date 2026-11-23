// Shared inputs for the JS state gate and extracted pinned-C renderer.
const f=(field,fmt,text)=>({field,fmt,text});
const u=(field,text,color=8,percent=100)=>({op:'update',field,text,color,percent});
const fields=[f('BL_TITLE','%s','Hero the Tester'),f('BL_STR',' St:%s','18'),
    f('BL_LEVELDESC','%s','Dlvl:1'),f('BL_GOLD',' $:%s','0'),
    f('BL_HP',' HP:%s','12'),f('BL_HPMAX','(%s)','12'),
    f('BL_ENE',' Pw:%s','4'),f('BL_ENEMAX','(%s)','8'),f('BL_AC',' AC:%s','5'),
    f('BL_XP',' Xp:%s','1'),f('BL_EXP','/%s','0'),f('BL_TIME',' T:%s','9'),
    f('BL_HUNGER',' %s',''),f('BL_CAP',' %s',''),f('BL_CONDITION','%s',0)];
const flush={op:'flush'}, reset={op:'reset'};
export const cases=[];
function add(name,actions,config={}) {cases.push({name,rows:2,cols:80,fields,actions,...config});}
add('initial-reset',[reset]);
add('field-update-is-buffered',[u('BL_HP','11')]);
add('no-change-flush',[flush]);
add('same-value-dirty',[u('BL_HP','12'),flush]);
add('first-row-only',[u('BL_STR','17'),flush]);
add('hp-same-width',[u('BL_HP','11'),flush]);
add('hpmax-same-width',[u('BL_HPMAX','13'),flush]);
add('power-same-width',[u('BL_ENE','3'),flush]);
add('last-numeric-field',[u('BL_TIME','8'),flush]);
add('grow-shifts-right',[u('BL_GOLD','100'),flush]);
add('shrink-clears-tail',[u('BL_HP','9'),flush]);
add('grow-then-shrink',[u('BL_GOLD','100'),flush,u('BL_GOLD','0'),flush]);
add('complementary-length-changes',[u('BL_HP','9'),u('BL_ENE','40'),flush]);
add('hunger-add',[u('BL_HUNGER','Hungry   '),flush]);
add('hunger-remove',[u('BL_HUNGER','Hungry'),flush,u('BL_HUNGER',''),flush]);
add('empty-field-force-reset',[reset],{fields:[...fields,f('BL_WEAPON','%s','')]});
add('condition-add',[u('BL_CONDITION',2),flush]);
add('condition-same-bits',[u('BL_CONDITION',2),flush,u('BL_CONDITION',2),flush]);
add('condition-remove',[u('BL_CONDITION',2),flush,u('BL_CONDITION',0),flush]);
add('multiple-conditions',[u('BL_CONDITION',2|8|0x400000|0x200000),flush]);
add('color-only',[u('BL_HP','12',1),flush],{hilite:1});
add('color-only-highlights-off',[u('BL_HP','12',1),flush]);
add('attr-only',[u('BL_HP','12',8|(2<<8)),flush],{hilite:1});
add('attr-and-color-reset',[u('BL_HP','12',1|(16<<8)),flush,u('BL_HP','12'),flush],{hilite:1});
add('experience-slash-attr',[u('BL_EXP','1',2|(64<<8)),flush],{hilite:1});
add('condition-color-attr',[u('BL_CONDITION',2|8),flush],{hilite:1,masks:{1:2,18:2,21:8}});
add('condition-style-only',[u('BL_CONDITION',2),flush,{op:'masks',value:{2:2,23:2}},u('BL_CONDITION',2),flush],{hilite:1,masks:{1:2}});
add('clear-window',[{op:'clear'}]);
add('clear-while-erasing',[{op:'erasing',value:true},{op:'clear'}]);
add('reset-after-clear',[{op:'clear'},reset]);
add('three-row-first-row-only',[u('BL_STR','17'),flush],{rows:3});
add('three-row-condition-indent',[u('BL_CONDITION',2|8),flush],{rows:3});
add('three-row-condition-remove',[u('BL_CONDITION',2|8),flush,u('BL_CONDITION',0),flush],{rows:3});
add('three-row-version',[u('BL_CONDITION',2),flush],{rows:3,fields:[...fields,f('BL_VERS',' %s','NetHack 5.0')]});
add('right-justified-version',[u('BL_HP','9'),flush],{fields:[...fields,f('BL_VERS',' %s','NetHack 5.0')]});
add('condition-shrink-one',[u('BL_CONDITION',2|0x80|0x100000),flush],{cols:64});
add('condition-shrink-two',[u('BL_CONDITION',2|0x80|0x100000),flush],{cols:60});
add('encumbrance-shrink',[u('BL_CAP','Overloaded'),u('BL_CONDITION',2|0x80|0x100000),flush],{cols:65,enc:5});
add('level-description-shrink',[u('BL_CAP','Overloaded'),u('BL_CONDITION',2|0x80|0x100000),flush],{cols:60,enc:5});
add('long-condition-truncation',[u('BL_CONDITION',0x3fffffff),flush]);
add('last-column-clipping',[u('BL_WEAPON','x'.repeat(80)),flush],{fields:[...fields,f('BL_WEAPON','%s','')]});
add('hitpointbar-full',[u('BL_HP','12'),flush],{hpbar:true,hilite:1});
add('hitpointbar-partial',[u('BL_HP','7',1,58),flush],{hpbar:true,hilite:1});
add('hitpointbar-zero',[u('BL_HP','0',1,0),flush],{hpbar:true,hilite:1});
add('hitpointbar-critical',[u('BL_HP','1',1,8),flush],{hpbar:true,hilite:1,critical:true});
add('no-valid-last-row',[flush],{fields:[f('BL_TITLE','%s','Hero')]});
add('inactive-field-update',[u('BL_WEAPON','ignored'),flush]);
add('invalid-field-update',[u('BL_CHARACTERISTICS','ignored')]);

// These calls use private helpers exposed only by the state-test loader.
add('helper-cursor-offset',[{op:'cursor',x:7,y:1}]);
add('helper-empty-field',[{op:'field',text:'',x:5,y:1}]);
add('helper-clipped-field',[{op:'field',text:'abcdef',x:77,y:1}]);
add('helper-column-guard',[{op:'field',text:'ignored',x:80,y:1}]);
add('helper-row-guard',[{op:'field',text:'ignored',x:5,y:2}]);
add('helper-clear-preserves-cursor',[{op:'cursor',x:7,y:1},{op:'clear-eol',y:1}]);
