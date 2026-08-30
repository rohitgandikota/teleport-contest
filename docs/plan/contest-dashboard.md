# Contest score dashboard

Last refreshed: 2026-08-30T16:38:28Z. Local commit: `537285e`.
Leaderboard snapshot: 2026-08-30T14:28:34.299Z. Fork last scored: 2026-08-30T14:03:27.572Z.
The live leaderboard page was verified at 2026-08-30T16:38:28Z. The published row remains at 11405 + 6032 points, 71.9% combined PRNG, 76.9% combined screens, 9 animations, 251+0.9 speed, and 44 + 9 sessions. The local checkpoint below is newer than the judged code.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 34901/35286 | 98.91% | 190/192 | 2388978/2388978 (100.00%) | 88/1070 |

## Contest position and generalization

- Agentic category rank: **1/12**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `537285e` has not been judged yet; held-out numbers are from the 2026-08-30T14:03:27.572Z run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 35279/35286 |
| Cursor positions | 11405/11405 | 34901/35286 |
| Startup and per-turn estimate | 61+0.50/turn | 97+0.17/turn |

## Latest local expansion

- `scare-scroll-pickup` matches 7952/7952 C RNG calls, 121/121 screens, 121/121 cells, and 121/121 cursor positions across three segments.
- The oracle covers blessed scrolls losing their blessing, fresh uncursed scrolls advancing their pickup state, and cursed or previously picked-up scrolls turning to dust before the appearance-naming prompt.
- The engraving guard gate passes 3/3 invariants. It distinguishes automatic old-style Elbereth object guarding from Lua's default override and Lua's explicit `guardobjects:true` path.
- Coverage is 105/105 game elements and 74/74 named C branches. Eighty fresh games across 13 role configurations reached no unported path.

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 1.141 ms per move, limit 25 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-30T16:34:52.583Z | `537285e` | 11405/11405 | 34901/35286 | 6032/11265 | 3 |
| 2026-08-29T10:31:01.764Z | `e0bfa28` | 11405/11405 | 34116/34501 | 6032/11265 | 3 |
| 2026-08-29T10:12:28.807Z | `1e71a3e` | 11405/11405 | 34056/34441 | 6032/11265 | 3 |
| 2026-08-29T09:54:00.218Z | `d2c3625` | 11405/11405 | 33990/34375 | 6032/11265 | 3 |
| 2026-08-29T09:27:51.249Z | `efb413e` | 11405/11405 | 33894/34279 | 6032/11265 | 3 |
| 2026-08-29T08:24:33.560Z | `746d2ec` | 11405/11405 | 33721/34106 | 6032/11265 | 3 |
| 2026-08-29T07:55:51.547Z | `1e5fbea` | 11405/11405 | 33635/34020 | 6032/11265 | 3 |
| 2026-08-29T07:37:41.044Z | `1f879b9` | 11405/11405 | 33544/33929 | 6032/11265 | 3 |
| 2026-08-29T07:29:58.039Z | `97011eb` | 11405/11405 | 33484/33869 | 6032/11265 | 3 |
| 2026-08-29T07:16:26.868Z | `0c95e15` | 11405/11405 | 33220/33605 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
