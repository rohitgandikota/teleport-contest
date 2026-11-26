#!/usr/bin/env python3
"""Run the one locked observational family, with no retry or input tuning."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess
import time

p = Path(__file__).resolve().parent
command = ['node', '--max-old-space-size=512', '--preserve-symlinks',
           '--preserve-symlinks-main', str(p / 'probe.mjs')]
receipt = {'command': command, 'startedUTC': datetime.now(timezone.utc).isoformat(),
           'timeoutSeconds': 55, 'memoryMB': 512,
           'inputLockSHA256': hashlib.sha256((p / 'input-lock.json').read_bytes()).hexdigest(),
           'expectedSourceFailureIsDiagnostic': True, 'runtimeCandidate': False, 'newCRecordings': 0}
with (p / 'worker-start.json').open('x') as f:
    f.write(json.dumps(receipt, indent=2) + '\n')
start = time.monotonic()
with (p / 'worker.log').open('x') as log:
    try:
        result = subprocess.run(command, cwd=p, stdout=log, stderr=subprocess.STDOUT,
                                timeout=55, check=False)
        receipt.update(exitCode=result.returncode, timedOut=False)
    except subprocess.TimeoutExpired:
        receipt.update(exitCode=124, timedOut=True)
receipt['seconds'] = round(time.monotonic() - start, 3)
with (p / 'worker.json').open('x') as f:
    f.write(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
raise SystemExit(receipt['exitCode'])
