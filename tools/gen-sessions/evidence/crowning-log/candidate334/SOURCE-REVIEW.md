# Crowning log sites

Read complete C src/pray.c:805-998 gcrownu and fixed0829 JS gcrownu, plus their complete pleased callers. The eligible pat-on-head cases7/8 call gcrownu only when alignment is PIOUS and no crown exists. All existing prayers, gifts, skill changes and random calls remain untouched.

Seven C log sites are absent from JS: the three alignment titles, the class spellbook, successful Excalibur transformation, new Vorpal Blade and new Stormbringer. Use existing livelog_printf with LL_DIVINEGIFT; gifts also use LL_ARTIFACT, and the class book also uses LL_SPOILER. The class book's actualoname is captured before blessing, observation and dropy. The wielded weapon's simpleonames is captured before the message and oname; the log follows the existing successful is_art check and gift increment. New artifact logs follow dropy and the gift increment. No log is added to held-artifact, existing-artifact or giftless branches.

Read complete C/JS actualoname, simpleonames, minimal_xname, distant_name, artiname, oname, bless, u_gname/align_gname, s_suffix and uhis declaration. actualoname temporarily overrides identification for the type name; minimal_xname suppresses user names and restores type metadata. simpleonames preserves the stack's grammatical number. uhis uses underlying flags.female, not monster form. The existing oname helper can return a pending artifact effect for other artifacts; the crowning artifacts' existing synchronous call contract is unchanged. No naming helper or return contract is rewritten.

# Quest prerequisite

Read complete C src/quest.c:282-368 chat_with_leader and JS194-250, C/JS is_pure and capability checks, leader_speaks, quest_chat and quest_talk. Worthiness is reached only after leader/quest/home-level guards and the quest assignment pager. C calls exercise, sets got_quest, then logs LL_ACHIEVE with noit_mon_nam. The new call goes at that exact position. Repeated talks take encourage and do not relog. Banishment also lacks a JS log, but that independent, unobserved branch is explicitly outside this patch.

Read complete C/JS noit_mon_nam and x_monnam, plus their selected species-name and proper-name rules. noit_mon_nam suppresses replacement with "it" while preserving tame articles, personal names, hallucination and normal monster naming. The actual recorded leaders produce "the Norn", "Neferet the Green" and "the Master of Thieves". No leader name is hardcoded in runtime.

# Log consumer and ordinary evidence

Read complete C/JS gamelog_add/livelog_printf and C do_gamelog/show_gamelog with JS do_gamelog. Logs append copied text, flags and the current turn synchronously. These wizard inputs expose class-book spoiler entries. The normal-mode spoiler filter and final-disclosure filtering remain outside this scope.

The original source12 and paged source35 are linked and immutable. Original42 checks stay verbatim. Parent paged C raw7caf6570 has six passing primary predicates,899 boundaries,32,391 calls and9 frames. Baseline native is3/6. Only positive chronicle pages differ; the chaotic second-page cursor also differs because its JS window closes early. Three complete negative native rows are exact.

Three supplementary checks are derived from original C first-page row17 at boundaries229,276,373: exact quest event text, turn2, LL_ACHIEVE=2. Their expectation file and check body are locked before runtime edits. They are first evaluated against the sealed paged baseline last.logs without gameplay. They remain separate from the42 original checks and are applied unchanged to candidate logs.

The native ordinary family reaches three titles, the Wizard book, lawful sword transformation, chaotic new sword and all three quest grants. The neutral new-artifact log is source-ported but not independently reached by this family. Monk book, alternate chaotic wording, held/preexisting artifacts, banishment, alternative pronouns, hallucinated leaders and normal-mode spoiler filtering are not claimed as ordinary closure.
