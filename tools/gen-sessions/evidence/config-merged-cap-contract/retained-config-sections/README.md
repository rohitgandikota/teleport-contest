# Retained section parser expectation

The old 61-case test expected the unknown keyword CHOOſE to remain a JavaScript Unicode string in result.unhandled. The parser now reads UTF-8 file bytes before merging, matching cfgfiles.c1844-1860 and parse_config_line1389-1440. The recorder writes the string as UTF-8 at record-session.mjs422-424. The expected bytes for ſ are C5 BF. C match_optname at options.c6760-6770 does not Unicode-fold them into an ASCII keyword.

The published runtime passes the original test 61/61. The candidate passes 60/61; its only failure is the bookkeeping string's byte representation. The corrected expected value uses Node's independent UTF-8/Latin-1 conversion. The unchanged input is still rejected, consumes no random calls, and leaves the following option active. All other 60 case results and assertions remain fixed. The corrected candidate passes 61/61.

Original test, original failure, corrected result and exact replacement/source hashes are retained here. No runtime change or assertion deletion was made for this correction. This evidence does not claim native diagnostic rendering or full unknown-directive support.
