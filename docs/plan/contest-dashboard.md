# Contest score dashboard

Last refreshed: 2026-08-29T01:40:20.357Z. Local commit: `5c7069c`.
Leaderboard snapshot: 2026-08-27T10:30:40.033Z. Fork last scored: 2026-08-27T09:55:38.417Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.
Leaderboard page checked: 2026-08-29T01:43:01.000Z. The page reported Updated 2h ago and displayed the same visible scores. The full page reported Last scored: 8/28/2026, 7:11:18 PM.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 28524/28909 | 98.67% | 159/161 | 2018552/2018552 (100.00%) | 19/752 |

## Contest position and generalization

- Agentic category rank: **1/12**.
- Overall held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `5c7069c` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 28902/28909 |
| Cursor positions | 11405/11405 | 28524/28909 |
| Startup and per-turn estimate | 63+0.43/turn | 79+0.13/turn |

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Last exact JSON snapshot: playable true, browser true, and 2.452 ms per move against a 5 ms limit.
- Visible live row: playable no. Its current tooltip reports 2 ms per move against the 5 ms limit. The visible status and its own diagnostic are inconsistent.
- Visible live fit: 439 + 1.6 ms per move across the 88 scored sessions.
- Last exact JSON snapshot: sessions skipped 0, sessions killed 0, and early abort false.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-29T01:40:20.357Z | `5c7069c` | 11405/11405 | 28524/28909 | 6032/11265 | 3 |
| 2026-08-29T01:23:35.412Z | `3037d85` | 11405/11405 | 28216/28601 | 6032/11265 | 3 |
| 2026-08-28T20:47:54.035Z | `c867ab0` | 11405/11405 | 27994/28379 | 6032/11265 | 3 |
| 2026-08-28T20:31:09.026Z | `3c94bd3` | 11405/11405 | 27572/27957 | 6032/11265 | 3 |
| 2026-08-28T20:13:58.956Z | `a803bdd` | 11405/11405 | 27443/27828 | 6032/11265 | 3 |
| 2026-08-28T19:52:55.485Z | `ea7047d` | 11405/11405 | 27166/27551 | 6032/11265 | 3 |
| 2026-08-28T19:21:55.346Z | `9530b30` | 11405/11405 | 26928/27313 | 6032/11265 | 3 |
| 2026-08-28T19:00:56.319Z | `3586e33` | 11405/11405 | 26691/27076 | 6032/11265 | 3 |
| 2026-08-28T16:00:14.731Z | `695168f` | 11405/11405 | 26526/26911 | 6032/11265 | 3 |
| 2026-08-28T15:33:52.009Z | `4eb2561` | 11405/11405 | 25722/26107 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
