# Contest score dashboard

Last refreshed: 2026-08-29T10:31:01.764Z. Local commit: `e0bfa28`.
Leaderboard snapshot: 2026-08-27T10:30:40.033Z. Fork last scored: 2026-08-29T07:55:07.000Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.
Leaderboard page checked: 2026-08-29T10:15:33.000Z. The page reported Last scored: 8/29/2026, 3:55:07 AM and displayed 11405 + 6032 points, 71.9% PRNG, 76.9% screen, 9 animations, 440+1.6 speed, playable no, and 44 + 9 sessions. Its tooltip reported 2 ms per move against the 5 ms threshold, despite the visible playable value.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 34116/34501 | 98.88% | 183/185 | 2342228/2342228 (100.00%) | 88/840 |

## Contest position and generalization

- Agentic category rank: **1/12**.
- Overall held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `e0bfa28` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 34494/34501 |
| Cursor positions | 11405/11405 | 34116/34501 |
| Startup and per-turn estimate | 71+0.51/turn | 88+0.16/turn |

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 2.452 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-29T10:31:01.764Z | `e0bfa28` | 11405/11405 | 34116/34501 | 6032/11265 | 3 |
| 2026-08-29T10:12:28.807Z | `1e71a3e` | 11405/11405 | 34056/34441 | 6032/11265 | 3 |
| 2026-08-29T09:54:00.218Z | `d2c3625` | 11405/11405 | 33990/34375 | 6032/11265 | 3 |
| 2026-08-29T09:27:51.249Z | `efb413e` | 11405/11405 | 33894/34279 | 6032/11265 | 3 |
| 2026-08-29T08:24:33.560Z | `746d2ec` | 11405/11405 | 33721/34106 | 6032/11265 | 3 |
| 2026-08-29T07:55:51.547Z | `1e5fbea` | 11405/11405 | 33635/34020 | 6032/11265 | 3 |
| 2026-08-29T07:37:41.044Z | `1f879b9` | 11405/11405 | 33544/33929 | 6032/11265 | 3 |
| 2026-08-29T07:29:58.039Z | `97011eb` | 11405/11405 | 33484/33869 | 6032/11265 | 3 |
| 2026-08-29T07:16:26.868Z | `0c95e15` | 11405/11405 | 33220/33605 | 6032/11265 | 3 |
| 2026-08-29T07:07:22.523Z | `a10af9f` | 11405/11405 | 33113/33498 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
