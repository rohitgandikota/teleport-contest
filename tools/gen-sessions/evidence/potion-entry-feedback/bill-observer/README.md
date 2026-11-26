# Active bill entries in the potion-impact observer

The original observer inspected every slot in the fixed bill array. C include/mextra.h defines billct as the number of active entries. C onbill scans that prefix, and sub_one_frombill reduces billct without clearing unused slots.

The original test fails two of four cases identically on the published pit baseline and potion candidate. The observer now reads only the billct prefix. Both runtimes pass all four unchanged assertions, with identical complete reports and all twenty original output hashes unchanged. No input, expected value or gameplay code changes for this correction. The original gate and both failure logs are retained here.
