#!/usr/bin/env python3
"""Verify this isolated candidate and retained evidence without gameplay."""
from pathlib import Path
import difflib
import hashlib
import json

P = Path(__file__).resolve().parent
sha = lambda b: hashlib.sha256(b).hexdigest()
read = lambda n: json.loads((P / n).read_bytes())
jhash = lambda v: sha(json.dumps(v, separators=(',', ':'), ensure_ascii=False).encode())


def members(base):
    seal = json.loads((base / 'SEAL.json').read_bytes())
    manifest = (base / 'MANIFEST.json').read_bytes()
    assert sha(manifest) == seal['manifestSHA256']
    rows = json.loads(manifest)['members']
    assert len(rows) == seal['members']
    for row in rows:
        path = base / row['path']
        if row['type'] == 'symlink':
            assert str(path.readlink()) == row['target'], path
        else:
            assert not path.is_symlink(), path
            data = path.read_bytes()
            assert len(data) == row['bytes'] and sha(data) == row['sha256'], path
    return rows


listed = members(P)
actual = {str(f.relative_to(P)) for f in P.rglob('*')
          if (f.is_file() or f.is_symlink()) and f.name not in ('MANIFEST.json', 'SEAL.json')}
assert actual == {r['path'] for r in listed}
assert (P / 'WRITTEN-PATHS.txt').read_text().splitlines() == sorted([*actual, 'MANIFEST.json', 'SEAL.json'])
assert len(members(P / 'evidence/source')) == 35
assert len(members(P / 'evidence/original')) == 36
pins, preedit = read('pins.json'), read('PRE-EDIT-LOCK.json')
for name, expected in preedit['files'].items():
    assert sha((P / name).read_bytes()) == expected, name
assert preedit['beforeRuntimeEdit']
for section in ['files', 'priorSeals']:
    for name, expected in pins[section].items():
        assert sha((P / name).read_bytes()) == expected, name
baseline, candidate = read('baseline-runtime.json'), read('runtime.json')
assert len(baseline) == len(candidate) == 280
assert [name for name in baseline if baseline[name] != candidate[name]] == ['js/trap.js']
for name in baseline:
    assert sha((P / 'baseline' / name).read_bytes()) == baseline[name], name
    assert sha((P / name).read_bytes()) == candidate[name], name
    assert (P / name).is_symlink() == (name != 'js/trap.js'), name
a, b = (P / 'baseline/js/trap.js').read_text(), (P / 'js/trap.js').read_text()
start = b.index('    } else if (Upolyd(game.u)) {', b.index('async function dofiretrap(box)'))
end = b.index('    } else {', start)
assert len(b[start:end].splitlines()) == 30 and b[:start] + b[end:] == a
diff = ''.join(difflib.unified_diff(a.splitlines(True), b.splitlines(True), fromfile='a/js/trap.js', tofile='b/js/trap.js'))
assert diff == (P / 'scoped.patch').read_text() and diff.count('@@ ') == 1
for name, count in [('review-ranges.json', 12), ('source-ranges.json', 53),
                    ('evidence/original/source-ranges.json', 108), ('evidence/original/attribution-sources.json', 11)]:
    ranges = read(name)
    assert len(ranges) == count
    for row in ranges:
        path = 'baseline/' + row['file'] if row['file'].startswith('js/') else row['file']
        data = (P / path).read_bytes()
        assert sha(data) == row['fileSHA256'], path
        assert sha('\n'.join(data.decode().split('\n')[row['start'] - 1:row['end']]).encode()) == row['rangeSHA256']

recipe, proposal, lock = read('primary-recipe.json'), read('proposals/proposal01.json'), read('input-lock.json')
raw = read('evidence/native.session.json')
assert sha((P / 'evidence/native.session.json').read_bytes()) == 'f1d26027a6456e8043fa4e5acce9b4aaabbb41712d1361c98e2f8f403e4c2fb3'
assert recipe['source'] == raw['source'] == 'c' and recipe['version'] == raw['version'] == 5
assert recipe['segments'] == proposal['segments'] and len(recipe['segments']) == len(raw['segments']) == 8
assert lock['totalKeys'] == 1154 and lock['totalBoundaries'] == 1162
for name in recipe:
    if name != 'segments':
        assert recipe[name] == raw[name], name
for index, part in enumerate(recipe['segments']):
    recorded = raw['segments'][index]
    values = [{'field': f, 'present': f in part, 'value': part.get(f)} for f in lock['fields']]
    assert values == lock['segments'][index]['fields']
    assert jhash(values) == lock['segments'][index]['fieldsSHA256']
    assert list(part['moves'].encode()) == lock['segments'][index]['keys']
    assert sha(part['moves'].encode()) == lock['segments'][index]['movesSHA256']
    for field in lock['fields']:
        assert (field in part) == (field in recorded) and part.get(field) == recorded.get(field)
    assert [step['key'] for step in recorded['steps']] == [None, *part['moves']]
    primary = recipe['branchAssertions'][index]
    text = '\n'.join(step['screen'] for step in recorded['steps'])
    assert all(s in text for s in primary['screenIncludes']) and all(s not in text for s in primary['screenExcludes'])
    for step in recorded['steps']:
        assert len(step['cursor']) == 2 and 0 <= step['cursor'][0] < 80 and 0 <= step['cursor'][1] < 24
        assert '\x1b]7777;' not in step['screen']

oldbody = (P / 'evidence/source/tools/probe.mjs').read_text()
newbody = (P / 'tools/probe.mjs').read_text()
def assertions(body):
    return body[body.index('async function deferredSegment(part) {'):body.index('const report = {runtimeSHA256:')]
assert assertions(oldbody) == assertions(newbody)
bodyproof = read('evidence/assertion-body.json')
assert sha(assertions(newbody).encode()) == bodyproof['exactSharedBodySHA256']
assert sha(newbody.encode()) == bodyproof['candidateDriverSHA256']
driverdiff = ''.join(difflib.unified_diff(oldbody.splitlines(True), newbody.splitlines(True),
                                         fromfile='source/tools/probe.mjs', tofile='candidate/tools/probe.mjs'))
assert driverdiff == (P / 'evidence/driver-relocation.patch').read_text()
assert newbody.index("writeFileSync(new URL('reports/native-preflight.json'") < newbody.index("await import('../js/jsmain.js')")
preflight, run, start = read('reports/native-preflight.json'), read('reports/launch.json'), read('reports/start.json')
assert preflight['beforeTestedImports'] and preflight['primaryBranches'] == 8
assert not preflight['integrityErrors'] and not preflight['primaryErrors']
assert preflight['fiveFieldsAndPresence'] and preflight['allKeys'] and preflight['rootMetadataExact']
assert run['exitCode'] == 0 and run['workers'] == 1 and run['maxHeapMB'] == 512 and run['elapsedSeconds'] < 55
assert run['CExecutions'] == 0 and start['pinsSHA256'] == sha((P / 'pins.json').read_bytes())
for channel in ['stdout', 'stderr']:
    assert sha((P / ('reports/run.' + channel)).read_bytes()) == run[channel + 'SHA256']
ordinary, native = read('reports/probe01.json'), read('reports/candidate-native.json')
oldordinary, oldnative = read('evidence/source/reports/probe01.json'), read('evidence/parent/baseline-native.json')
assert (ordinary['producerPassed'], ordinary['sourcePassed'], ordinary['sourceChecks'], ordinary['neutrality']) == (8, 8, 56, 8)
assert sum(c['pass'] for row in ordinary['rows'] for c in row['reach']) == 192
assert all(len(row['reach']) == 24 and len(row['contracts']) == 7 for row in ordinary['rows'])
assert ordinary['runtimeCandidate'] and ordinary['referenceCExecutions'] == 0
assert ordinary['driverSHA256'] == pins['files']['tools/probe.mjs']
assert len(native) == 8 and all(row['fullStyleExact'] and row['frozenScreenCursorExact']
    and row['fullRngExact'] and row['animationExact'] for row in native)
assert sum(row['boundaries']['expected'] for row in native) == 1162
assert sum(row['calls']['expected'] for row in native) == 22506
assert sum(row['frames']['expected'] for row in native) == 21
negative = read('evidence/source/negative-outputs.json')
assert negative['hashCount'] == 15
assert ordinary['rows'][5:] == oldordinary['rows'][5:]
assert native[5:] == oldnative[5:]
for index, row in enumerate(ordinary['rows']):
    assert not row.get('error') and row['producerPass'] and row['sourcePass']
    n = row['neutrality']
    assert n['pass'] and n['eofStable'] and n['observedEqualsPlain'] and n['plainEqualsDeferred']
    assert n['plainConsumed'] == n['deferredConsumed'] == row['keys']
    assert n['hashes']['observed'] == n['hashes']['plain'] == n['hashes']['deferred'] == row['outputHashes']
    if row['negative']:
        expected = negative['rows'][index - 5]
        assert expected['name'] == row['name'] and expected['rowSHA256'] == jhash(row)
        assert expected['outputHashes'] == row['outputHashes']
comparison = read('reports/comparison.json')
assert comparison['ordinaryReportSHA256'] == sha((P / 'reports/probe01.json').read_bytes())
assert comparison['nativeReportSHA256'] == sha((P / 'reports/candidate-native.json').read_bytes())
assert comparison['nativePassed'] == 8 and comparison['ordinaryNegativeHashesExact'] == 15
assert comparison['ordinaryNegativeRowsExact'] == comparison['nativeNegativeRowsExact'] == 3
command = read('evidence/parent/command.json')
assert command['exit'] == 1 and command['seconds'] == 1.832
assert sha((P / 'evidence/parent/baseline-native.log').read_bytes()) == command['logSHA256']
print(json.dumps({'verified': True, 'members': len(listed), 'priorSeals': [36, 35], 'runtimeFiles': 280,
                  'runtimeChanged': ['js/trap.js'], 'reverseExact': True, 'reviewedRanges': 184,
                  'producerChecks': '192/192', 'sourceChecks': '56/56', 'native': '8/8',
                  'boundaries': 1162, 'calls': 22506, 'frames': 21, 'negativeHashes': 15,
                  'ordinaryAndNativeNegativeRowsExact': 3, 'gameRunsDuringVerification': 0, 'CExecutions': 0}))
