"""Re-read the native random-motion controller inputs; no runtime fidelity claim."""
import argparse, csv, hashlib, importlib.util, io, json, struct, subprocess, sys
from collections import Counter
from pathlib import Path
import UnityPy
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--native-elf',type=Path,required=True)
parser.add_argument('--write',action='store_true')
args=parser.parse_args()
sys.path.insert(0,str(root/'scripts'))
spec=importlib.util.spec_from_file_location('effects',root/'scripts/prepare-live-chibi-stage-effects.py')
effects=importlib.util.module_from_spec(spec);spec.loader.exec_module(effects)
sources=effects.load_archive_sources(None)
apk=effects.read_unity_data(effects.find_xapk(None,sources.xapk_file))
objects={o.path_id:o for o in UnityPy.load(apk).objects if o.assets_file.name=='resources.assets'}
stage=objects[114160].get_raw_data()
slots=[]
for i in range(6):
    _,pid=struct.unpack_from('<iq',stage,48+i*12)
    obj=objects[pid];raw=obj.get_raw_data();go=obj.read(check_read=False).m_GameObject.read()
    assert len(raw)==108,(pid,len(raw))
    slots.append(dict(index=i,script=pid,name=go.m_Name,slotIndex=struct.unpack_from('<i',raw,104)[0],sha256=hashlib.sha256(raw).hexdigest()))
index=json.loads((root/'public/assets/live-chibi/choreography/index.json').read_text(encoding='utf-8'))
codes=sorted({s['songCode'] for s in index['songs']})
counts={};hidden=[];erases=[];seen=set();bundles={};pauses=Counter();modes=Counter();groups=0;changes=0
clock=json.loads((root/'public/data/stage-motion-clock.json').read_text(encoding='utf-8'))
assert hashlib.sha256((root/'public/assets/live-chibi/choreography/index.json').read_bytes()).hexdigest()==clock['choreographyIndexSha256']
for code in codes:
    bundle=sources.raw_root/'asset'/f'song_{code}.unity3d'
    digest=hashlib.sha256(bundle.read_bytes()).hexdigest()
    assert digest==clock['tracks'][code]['raw']['bundleSha256']
    bundles[bundle.name]=digest
    for o in UnityPy.load(str(bundle)).objects:
        if o.type.name!='TextAsset':continue
        asset=o.read()
        if asset.m_Name not in {s['id'] for s in index['songs']}:continue
        assert asset.m_Name not in seen
        seen.add(asset.m_Name)
        payload=asset.m_Script
        if isinstance(payload,bytes):payload=payload.decode('utf-8-sig')
        for n,row in enumerate(csv.reader(io.StringIO(payload)),1):
            if not row:continue
            if row[0]=='Livechara_motion':
                target=row[4];counts[target]=counts.get(target,0)+1
                pause=float(row[9]);pauses['zero' if pause==0 else 'negative' if pause<0 else 'sentinel' if pause>=999999 else 'positive']+=1
                modes[row[10]]+=1
                if target not in ['1','2','3','4','5']:hidden.append(dict(asset=asset.m_Name,row=n,values=row))
            if row[0]=='Livechara_motion_group':groups+=1
            if row[0]=='Livechara_motion_group_change':changes+=1
            if row[0]=='Livechara_motion_group_change' and len(row)>17 and row[17]=='1':
                erases.append(dict(asset=asset.m_Name,row=n,values=row))
    assert hashlib.sha256(bundle.read_bytes()).hexdigest()==digest
assert len(seen)==118 and sum(counts.values())==21860
assert not hidden and not erases
elf=args.native_elf.read_bytes()
assert hashlib.sha256(elf).hexdigest()=='9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e'
phoff=struct.unpack_from('<Q',elf,32)[0];size,count=struct.unpack_from('<HH',elf,54)
segments=[struct.unpack_from('<IIQQQQQQ',elf,phoff+i*size) for i in range(count)]
def read(rva,n):
    for kind,flags,offset,address,physical,filesize,memsize,align in segments:
        if kind==1 and address<=rva and rva+n<=address+filesize:return elf[offset+rva-address:offset+rva-address+n]
delay=struct.unpack('<f',read(0x317a310,4))[0]
random_ids=sorted({e['motion'] for s in index['songs'] for e in s['motionGroupEvents']})
assert len(random_ids)==17
common=sources.raw_root/'asset/live_costume_animation_2.unity3d'
common_hash=hashlib.sha256(common.read_bytes()).hexdigest()
payloads={o.read().m_Name:o.read().m_Script for o in UnityPy.load(str(common)).objects if o.type.name=='TextAsset'}
motions=[];setups={}
for body in range(1,6):
    setup_bundle=sources.raw_root/f'asset/live_costume_setup_{body}.unity3d'
    setups[str(body)]=hashlib.sha256(setup_bundle.read_bytes()).hexdigest()
    native_setup=next(o.read().m_Script for o in UnityPy.load(str(setup_bundle)).objects
        if o.type.name=='TextAsset' and o.read().m_Name==f'live_costume_setup_{body}.skel')
    if isinstance(native_setup,str):native_setup=native_setup.encode('utf-8',errors='surrogateescape')
    assert (root/f'public/assets/live-chibi/setup/body-{body}.skel').read_bytes()==native_setup
    assert hashlib.sha256(setup_bundle.read_bytes()).hexdigest()==setups[str(body)]
    report=json.loads(subprocess.check_output(['node',str(root/'scripts/inspect-live-chibi-motion.mjs'),str(body),*map(str,random_ids)],cwd=root,text=True,encoding='utf-8'))
    for entry in report:
        mid=entry['motionId'];name=f'live_costume_animation_{body}_{mid}'
        payload=payloads[name]
        if isinstance(payload,str):payload=payload.encode('utf-8',errors='surrogateescape')
        exported=root/f'public/assets/live-chibi/motions/choreography/{body}/{mid}.motion'
        assert exported.read_bytes()==payload
        motions.append(dict(bodyType=body,motion=mid,sha256=hashlib.sha256(payload).hexdigest(),
            fragments=[dict(name=a['name'],seconds=a['rawDurationSeconds']) for a in entry['animations']]))
assert all(slots[i]['slotIndex']==i for i in range(5))
assert slots[5]['name']=='LiveObjectIdol999' and slots[5]['slotIndex']==0
assert hashlib.sha256(common.read_bytes()).hexdigest()==common_hash
result=dict(schemaVersion=1,elfSha256=hashlib.sha256(elf).hexdigest(),
    unityDataSha256=hashlib.sha256(apk).hexdigest(),slots=slots,arrangements=len(seen),
    choreographyIndexSha256=clock['choreographyIndexSha256'],songBundles=bundles,
    motionTargetCounts=counts,hiddenTargets=hidden,groupEraseRows=erases,randomDelayMaxSeconds=delay,
    pauseClasses=dict(pauses),motionModes=dict(modes),groupRows=groups,groupChangeRows=changes,
    commonBundleSha256=common_hash,setupBundles=setups,motions=motions,
    methodWindows={name:dict(rva=hex(rva),bytes=size,sha256=hashlib.sha256(read(rva,size)).hexdigest()) for name,rva,size in [
        ('update',0x221af68,0x308),('callback',0x221cd44,0x348),('complete',0x221d08c,12),
        ('idolCtor',0x221cb50,200),('managerUpdate',0x1bbeb24,84),('randomNext',0x2211f14,204),
        ('weightedAdd',0x2a212a0,184),('weightedDraw',0x2a21380,528),('weightedCtor',0x2a21590,184)]})
fixture=root/'scripts/fixtures/chibi-native-random-motion.json'
if args.write:fixture.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
else:assert json.loads(fixture.read_text(encoding='utf-8'))==result
print(f'PASS ELF controller, six bound APK slots, {len(seen)} RAW arrangements/21860 targets, 85 RAW motion payloads and exact fragment durations')
