# Corrected producer contracts

Baseline remains chat-wear-parent-composed map88b58f9e,280 modules. The complete
dochat/caller review in original source23 is reused by hash. No runtime change
is proposed here. The shop clause remains Leibniz's separate owner.

Inventory letters: complete C invent.c694-733 assigninvlet and its JS owner
were reread. The complete addinv/freeinv/hold_another_object read set from the
original packet remains fixed. lastinvnr advances when assigning a new item;
freeinv does not reset it. After dropping statue a, the next potion or
blindfold is b. Cases6 and7 therefore change qa to qb and Pa to Pb, respectively,
with distinct names. Every other key, field, message expectation and negative
designation is retained. Neither is an inventory-runtime correction.

Hallucination: complete C/JS dodrink, dopotion, peffects,
peffect_hallucination and make_hallucinated were read. Successful quaff routes
through getobj and consumes the selected potion. A cursed hallucination
potion requests rn1(200,900) turns and skips optional enlightenment. The actual
hero must become hallucinated, and the existing statue remains the target
pile head. Milky/smoky bottle occupants are a real preceding branch, so object
selection alone does not prove hallucination. The passive assertions retain
the actual property check. No random monster name is drawn by the observer.

Blindness: complete C/JS doputon/accessory_or_armor_on, Blindf_on and setworn
were read, with the original visibility/Blind reader contracts retained.
Pb selects the actual blindfold. Blindf_on sets W_TOOL, emits the ordinary
wear message, and toggles vision when Blind changes. The corrected case must
show blindfold b worn and actual Blind true before its existing silent-statue
expectation. The original false-Blind negative remains fixed in source23.

Helpless steed: complete C/JS dothrow, ok_to_throw, throw_ok, throw_obj and
throwit were read. Downward potion throwing reaches the steed only when
rn2(6) is nonzero. Complete C/JS potionhit was read: a saddle can intercept the
hit, and an actual paralysis hit calls paralyze_monst with rnd(25). Complete
paralyze_monst clears mcanmove, sets mfrozen, stops eating and clears
STRAT_WAITFORU. The complete wakeup/setmangry contracts from source23 remain
fixed; wakeup does not undo this frozen interval. No damage value or random
return is guessed.

Complete C/JS potionbreathe shows a second paralysis effect on the hero.
Without Free_action the hero loses rnd(5) turns. Complete mcalcdistress and
m_calcdistress show that each game turn decrements mfrozen and restores
mcanmove at zero. Thus hero recovery can outlast a short steed paralysis.
This is a source-proven possible failure mode, not an attribution of the
original case: source23 retained only its final awake state.

The new steed proposal first wishes for and wears an uncursed ring of free
action. Complete C/JS accessory_or_armor_on, Ring_on and setworn establish
that Pal chooses the left finger and installs the ring's FREE_ACTION
extrinsic. C objects.h801 and youprop.h383, plus the JS object/property data
and Free_action reader, identify the property. Ring_on has no additional
free-action effect. Then the potion is the second new inventory item, b, so
the throw is tb>. Complete potionbreathe now takes the momentary-stiffness
branch without nomul or the hero rnd(5) draw. The observer must prove the
ring was absent before this setup, is actually worn before throwing, the
hero remains ready, and the steed becomes and remains helpless at chat.

This removes the hero-paralysis wait, not the throw/saddle probabilities or
a one-turn monster timeout. No seed, date or RC is changed. One attempt is
locked. If the steed is still mobile, that remains a setup failure with no
trial search. The new trace includes each input boundary around this throw
so the visible hit/vapor messages and primitive states are retained.

Complete C/JS zap_steed was also inspected as an alternative. WAN_SLEEP is
absent from its accepted wand cases, so no guaranteed direct sleep route is
assumed or used. The existing real mounted prefix remains unchanged, including
the mount owner's maybewakesteed call. No injected monster state, altered
timers, generic producer abstraction or candidate code is used.
