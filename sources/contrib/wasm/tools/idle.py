import json,sys,collections,bisect
files=sys.argv[1].split(','); depth=int(sys.argv[2]) if len(sys.argv)>2 else 40
profs=[]
for fn in files:
    p=json.load(open(fn)); nodes={n['id']:n for n in p['nodes']}; parent={}
    for n in p['nodes']:
        for c in n.get('children',[]): parent[c]=n['id']
    t=p['startTime']; ts=[]; ss=[]
    for s,dt in zip(p['samples'],p['timeDeltas']): t+=dt; ts.append(t); ss.append(s)
    profs.append((fn,nodes,parent,ts,ss))
# main thread = the one with js-to-wasm / most samples of 'prove'
def stack(nodes,parent,nid):
    out=[]; x=nid
    while x is not None and x in nodes:
        out.append(nodes[x]['callFrame']['functionName']); x=parent.get(x)
    return out[::-1]
main=max(range(len(profs)),key=lambda i: sum(1 for s in profs[i][4] if 'js-to-wasm' in str(stack(profs[i][1],profs[i][2],s)[:6])))
print('main =',profs[main][0])
fn,nodes,parent,ts,ss=profs[main]
idle_names=('__wasilibc_futex_wait','(idle)','(program)','(garbage collector)')
def is_idle(i,t):
    _,n2,p2,ts2,ss2=profs[i]; k=bisect.bisect_left(ts2,t)
    if k>=len(ts2): k=len(ts2)-1
    return n2[ss2[k]]['callFrame']['functionName'] in idle_names or n2[ss2[k]]['callFrame']['functionName'].startswith('std::__2::condition') 
agg=collections.Counter(); tot=0
dts=[ts[i+1]-ts[i] for i in range(len(ts)-1)]+[0]
for k,(t,s) in enumerate(zip(ts,ss)):
    nm=nodes[s]['callFrame']['functionName']
    if nm in idle_names: continue
    nidle=sum(is_idle(i,t) for i in range(len(profs)) if i!=main)
    if nidle==0: continue
    w=nidle*dts[k]; tot+=w
    seen=set()
    for f in stack(nodes,parent,s)[:depth]:
        if f not in seen: agg[f]+=w; seen.add(f)
print('total idle-worker ms while main busy:',tot/1000)
for k,v in agg.most_common(70):
    if v/1000>80: print(f"{v/1000:8.0f}  {k[:170]}")
