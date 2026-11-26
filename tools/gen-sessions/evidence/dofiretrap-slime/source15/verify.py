from pathlib import Path
import json,hashlib
p=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda n:json.loads((p/n).read_text())
seal=read('SEAL.json');manifest=read('MANIFEST.json')
assert sha(p/'MANIFEST.json')==seal['manifestSHA256']
for n,h in manifest.items():assert sha(p/n)==h,n
lock=read('input-lock.json')
for n,h in lock['files'].items():assert sha(p/n)==h,n
assert sha(p/'probe.mjs')==lock['probeSHA256']
for n,h in read('runtime.json').items():assert sha(p/n)==h,n
for n,h in read('source-pins.json').items():assert sha(Path(n))==h,n
recipe=read('recipe.json');rows=read('baseline-observation.json')
assert [[{'field':k,'present':k in s,'value':s.get(k)} for k in lock['fields']] for s in recipe['segments']]==lock['tuples']
assert sum(len(s['moves']) for s in recipe['segments'])==940
assert len(rows)==6 and all(r['producer'] for r in rows)
assert [r['index'] for r in rows if not r['source']]==[0,2]
assert all(c['pass'] for r in rows for c in r['checks'] if c['kind'] in ['producer','neutrality'])
assert sum(c['pass'] for r in rows for c in r['checks'])==50
assert sum(len(r['checks']) for r in rows)==54
assert read('negative-hashes.json')==[{'index':r['index'],'outputHashes':r['outputHashes']} for r in rows if r['negative']]
for i,h in read('existing-healthy-hashes.json').items():assert rows[int(i)]['outputHashes']==h
print(json.dumps({'verified':True,'members':len(manifest),'runtimePins':280,**read('summary.json'),'gameplayRunsDuringVerification':0}))
