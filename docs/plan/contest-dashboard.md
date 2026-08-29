# Contest score dashboard

Last refreshed: 2026-08-29T04:06:56.388Z. Local commit: `3f0167c`.
Leaderboard snapshot: 2026-08-27T10:30:40.033Z. Fork last scored: 2026-08-27T09:55:38.417Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.
Leaderboard page checked: 2026-08-29T04:08:42.361Z. The page reported Last scored: 8/28/2026, 7:11:18 PM and displayed 11405 + 6032 points, 71.9% PRNG, 76.9% screen, 9 animations, 439+1.6 speed, playable no, and 44 + 9 sessions.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 9/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 31167/31552 | 98.78% | 167/169 | 2177310/2177310 (100.00%) | 19/752 |

## Contest position and generalization

- Agentic category rank: **1/12**.
- Overall held-out rank: **3/18**.
- Public rank: **6/18**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `3f0167c` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 31545/31552 |
| Cursor positions | 11405/11405 | 31167/31552 |
| Startup and per-turn estimate | 70+0.43/turn | 90+0.13/turn |

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Visible live status: playable no. Its tooltip reports 2 ms per move against the 5 ms limit, so the status and its own diagnostic are inconsistent.
- Visible live fit: 439 + 1.6 ms per move across the 88 scored sessions.
- Last exact JSON snapshot: playable true, browser true, and 2.452 ms per move against a 5 ms limit.
- Last exact JSON snapshot: sessions skipped 0, sessions killed 0, early abort false, and 18402 total scored moves.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-29T04:06:56.388Z | `3f0167c` | 11405/11405 | 31167/31552 | 6032/11265 | 3 |
| 2026-08-29T03:49:24.948Z | `4b628b5` | 11405/11405 | 30906/31291 | 6032/11265 | 3 |
| 2026-08-29T03:31:33.587Z | `95e94eb` | 11405/11405 | 30523/30908 | 6032/11265 | 3 |
| 2026-08-29T03:09:21.242Z | `29fbdf2` | 11405/11405 | 30229/30614 | 6032/11265 | 3 |
| 2026-08-29T02:51:37.554Z | `71284bf` | 11405/11405 | 29402/29787 | 6032/11265 | 3 |
| 2026-08-29T02:36:18.072Z | `45d2b62` | 11405/11405 | 28943/29328 | 6032/11265 | 3 |
| 2026-08-29T02:24:52.187Z | `40e0280` | 11405/11405 | 28842/29227 | 6032/11265 | 3 |
| 2026-08-29T02:11:56.827Z | `faeeab7` | 11405/11405 | 28686/29071 | 6032/11265 | 3 |
| 2026-08-29T01:40:20.357Z | `5c7069c` | 11405/11405 | 28524/28909 | 6032/11265 | 3 |
| 2026-08-29T01:23:35.412Z | `3037d85` | 11405/11405 | 28216/28601 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
