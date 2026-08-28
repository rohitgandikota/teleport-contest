# Contest score dashboard

Last refreshed: 2026-08-28T06:13:15.477Z. Local commit: `b8976f0`.
Leaderboard snapshot: 2026-08-27T10:30:40.033Z. Fork last scored: 2026-08-27T09:55:38.417Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.
Leaderboard page checked: 2026-08-28T05:45:18.000Z. The page reported Updated 5h ago and displayed the same visible scores.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 20425/20810 | 98.15% | 112/114 | 1639222/1639222 (100.00%) | 14/425 |

## Contest position and generalization

- Agentic category rank: **1/12**.
- Overall held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `b8976f0` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 20803/20810 |
| Cursor positions | 11405/11405 | 20425/20810 |
| Startup and per-turn estimate | 70+0.47/turn | 107+0.15/turn |

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
| 2026-08-28T06:13:15.477Z | `b8976f0` | 11405/11405 | 20425/20810 | 6032/11265 | 3 |
| 2026-08-28T06:06:43.281Z | `9aa804a` | 11405/11405 | 20308/20693 | 6032/11265 | 3 |
| 2026-08-28T05:55:39.710Z | `668ee65` | 11405/11405 | 18631/19016 | 6032/11265 | 3 |
| 2026-08-28T05:42:57.971Z | `b837ccb` | 11405/11405 | 18381/18766 | 6032/11265 | 3 |
| 2026-08-28T01:36:03.593Z | `739c124` | 11405/11405 | 15146/15531 | 6032/11265 | 3 |
| 2026-08-28T01:19:28.587Z | `7054cbc` | 11405/11405 | 15024/15409 | 6032/11265 | 3 |
| 2026-08-28T00:55:11.110Z | `76230bc` | 11405/11405 | 13700/14085 | 6032/11265 | 3 |
| 2026-08-28T00:39:26.573Z | `13b8345` | 11405/11405 | 13630/14015 | 6032/11265 | 3 |
| 2026-08-28T00:17:57.537Z | `fce5151` | 11405/11405 | 13569/13954 | 6032/11265 | 3 |
| 2026-08-27T20:35:47.000Z | `2542ee1` | 11405/11405 | 13537/13922 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
