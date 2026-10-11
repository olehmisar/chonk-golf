import json,sys,collections,re
self_t=collections.Counter(); incl=collections.Counter(); per_file={}
pat=sys.argv[2] if len(sys.argv)>2 else None
for fn in sys.argv[1].split(','):
    p=json.load(open(fn))
    nodes={n['id']:n for n in p['nodes']}
    parent={}
    for n in p['nodes']:
        for c in n.get('children',[]): parent[c]=n['id']
    cnt=collections.Counter()
    for s,dt in zip(p['samples'],p['timeDeltas']): cnt[s]+=dt
    tot=0
    for nid,t in cnt.items():
        name=nodes[nid]['callFrame']['functionName'] or '(anon)'
        self_t[name]+=t; tot+=t
        seen=set(); x=nid
        while x in nodes:
            nm=nodes[x]['callFrame']['functionName']
            if nm not in seen: incl[nm]+=t; seen.add(nm)
            x=parent.get(x)
            if x is None: break
    per_file[fn.split('.')[-3]]=tot
print('per-thread total ms', {k:round(v/1000) for k,v in per_file.items()})
print('--- self')
for k,v in self_t.most_common(45): print(f"{v/1000:9.0f} ms  {k[:150]}")
if pat:
    print('--- inclusive matching',pat)
    for k,v in incl.most_common():
        if re.search(pat,k): print(f"{v/1000:9.0f} ms  {k[:150]}")
