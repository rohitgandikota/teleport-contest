# Contest score dashboard

Last refreshed: 2026-08-30T20:33:19.416Z. Local commit: `6963e63`.
Leaderboard snapshot: 2026-08-30T17:31:26.469Z. Fork last scored: 2026-08-30T16:55:52.282Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 39172/39557 | 99.03% | 208/210 | 2679325/2679325 (100.00%) | 88/1760 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `6963e63` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 39550/39557 |
| Cursor positions | 11405/11405 | 39172/39557 |
| Startup and per-turn estimate | 68+0.58/turn | 106+0.25/turn |

## Latest local expansion

- Revealing a mimic now clears its saved corpse, egg, tin, statue, fruit, or altar payload to `NON_PM` before clearing the disguise, matching `src/mon.c`.
- Three natural-shop C oracles remain exact at 18170/18170 RNG calls and 278/278 screens, cells, and cursors. A state gate covers the otherwise invisible payload reset.
- `m_detach()` now calls `shkgone()` for removed shopkeepers. The new state gate caught the missing call even though the later terminal frames already matched.
- Detached shopkeepers now clear room residency, former stock ownership, and active-shop membership while remaining in the monster list until the deferred purge.
- The valid late-game world-tour oracle remains exact at 123614/123614 RNG calls and 833/833 screens, cells, and cursors. The broad corpus no longer reports either `seemimic:mcorpsenm` or `mon:m_detach`.
- Deterministic coverage remains 105/105 game elements and 126/126 named C branches. Public remains 44/44, the hang gate remains 44/44, and 80 fresh games across 13 roles reached no unported path.
- This checkpoint has not been scored by the hidden judge. The displayed held-out result is from the last published build.

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 1.988 ms per move, limit 25 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-30T20:33:19.416Z | `6963e63` | 11405/11405 | 39172/39557 | 6032/11265 | 3 |
| 2026-08-30T20:20:52.701Z | `c14098a` | 11405/11405 | 39172/39557 | 6032/11265 | 3 |
| 2026-08-30T20:10:00.784Z | `245ff75` | 11405/11405 | 39172/39557 | 6032/11265 | 3 |
| 2026-08-30T19:49:59.418Z | `e080258` | 11405/11405 | 38746/39131 | 6032/11265 | 3 |
| 2026-08-30T19:27:48.323Z | `ac945f8` | 11405/11405 | 38680/39065 | 6032/11265 | 3 |
| 2026-08-30T19:17:32.901Z | `5a19514` | 11405/11405 | 38593/38978 | 6032/11265 | 3 |
| 2026-08-30T19:00:34.610Z | `5c12f8b` | 11405/11405 | 38398/38783 | 6032/11265 | 3 |
| 2026-08-30T18:40:25.838Z | `1e344aa` | 11405/11405 | 37936/38321 | 6032/11265 | 3 |
| 2026-08-30T18:10:36.798Z | `715ed63` | 11405/11405 | 37244/37629 | 6032/11265 | 3 |
| 2026-08-30T18:00:43.993Z | `1b21bb8` | 11405/11405 | 37051/37436 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
