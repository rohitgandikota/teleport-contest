# Contest score dashboard

Last refreshed: 2026-08-30T17:07:17.502Z. Local commit: `a12bdd3`.
Leaderboard snapshot: 2026-08-30T14:28:34.299Z. Fork last scored: 2026-08-30T14:03:27.572Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.
Leaderboard page checked: 2026-08-30T16:38:28.000Z. The page reported Last scored: 8/30/2026, 10:28:34 AM and displayed 11405 + 6032 points, 71.9% PRNG, 76.9% screen, 9 animations, 251+0.9 speed, playable yes, and 44 + 9 sessions. Its tooltip reported a 251.3 + 0.876 per-move fit and 1.14 ms per move under the 25 ms threshold.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 35768/36153 | 98.94% | 192/194 | 2412052/2412052 (100.00%) | 88/1070 |

## Contest position and generalization

- Agentic category rank: **1/12**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `a12bdd3` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 36146/36153 |
| Cursor positions | 11405/11405 | 35768/36153 |
| Startup and per-turn estimate | 54+0.61/turn | 103+0.20/turn |

## Latest local expansion

- `cursed-bag-loss` matches 12073/12073 C RNG calls, 548/548 screens, 548/548 cells, and 548/548 cursor positions across four seeds.
- The oracle covers 20 independent cursed-bag loss rolls, retained contents, one vanished cream pie, the four surviving contents, and C container insertion order.
- Coverage is 105/105 game elements and 81/81 named C branches. Eighty fresh games across 13 role configurations reached no unported path.
- This checkpoint has not been judged on the hidden corpus. The held-out row remains the last verified published result.

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
| 2026-08-30T17:07:17.502Z | `a12bdd3` | 11405/11405 | 35768/36153 | 6032/11265 | 3 |
| 2026-08-30T16:56:09.173Z | `5b8eeda` | 11405/11405 | 35220/35605 | 6032/11265 | 3 |
| 2026-08-30T16:34:52.583Z | `537285e` | 11405/11405 | 34901/35286 | 6032/11265 | 3 |
| 2026-08-29T10:31:01.764Z | `e0bfa28` | 11405/11405 | 34116/34501 | 6032/11265 | 3 |
| 2026-08-29T10:12:28.807Z | `1e71a3e` | 11405/11405 | 34056/34441 | 6032/11265 | 3 |
| 2026-08-29T09:54:00.218Z | `d2c3625` | 11405/11405 | 33990/34375 | 6032/11265 | 3 |
| 2026-08-29T09:27:51.249Z | `efb413e` | 11405/11405 | 33894/34279 | 6032/11265 | 3 |
| 2026-08-29T08:24:33.560Z | `746d2ec` | 11405/11405 | 33721/34106 | 6032/11265 | 3 |
| 2026-08-29T07:55:51.547Z | `1e5fbea` | 11405/11405 | 33635/34020 | 6032/11265 | 3 |
| 2026-08-29T07:37:41.044Z | `1f879b9` | 11405/11405 | 33544/33929 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
