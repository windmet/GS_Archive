"""Execute Camera matrix getter and Transform world-to-local from source-bound TRS access."""
import argparse,copy,hashlib,json,math,runpy,struct,sys
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--native-engine',required=True);parser.add_argument('--unicorn-path');parser.add_argument('--write',action='store_true')
args=parser.parse_args();root=Path(__file__).resolve().parents[1]
context_path=root/'scripts/fixtures/chibi-spatial-context-native.json';context=json.loads(context_path.read_text(encoding='utf8'))
sys.argv=[str(root/'scripts/prepare-chibi-noise-kernel-fixture.py'),'--native-engine',args.native_engine]
if args.unicorn_path:sys.argv+=['--unicorn-path',args.unicorn_path]
n=runpy.run_path(sys.argv[0]);uc=n['uc'];floats=n['floats'];ptr=n['ptr'];execute=n['execute']
from unicorn import UC_HOOK_CODE
from unicorn.arm64_const import UC_ARM64_REG_X0,UC_ARM64_REG_X1,UC_ARM64_REG_X30,UC_ARM64_REG_PC
camera,transform,data,trs,parents=0x20f0000,0x20f1000,0x20f2000,0x20f3000,0x20f4000
def resolve(uc,addr,size,user):
    uc.reg_write(UC_ARM64_REG_X0,transform);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_X30))
def access(uc,addr,size,user):
    uc.reg_write(UC_ARM64_REG_X0,data);uc.reg_write(UC_ARM64_REG_X1,0);uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_X30))
hooks=[uc.hook_add(UC_HOOK_CODE,resolve,begin=0x3170d8,end=0x3170d8),uc.hook_add(UC_HOOK_CODE,access,begin=0x3fcbcc,end=0x3fcbcc)]
f=lambda x:struct.unpack('<f',struct.pack('<f',x))[0]
factor=f(context['constants']['wideStageScale']['value']/context['constants']['scriptDivisor']['value'])
cases=[]
for index,event in enumerate([None]+context['arrangement']['cameraEvents']):
    for address in [camera,transform,data,trs,parents]:uc.mem_write(address,bytes(0x1000))
    chain=copy.deepcopy(context['camera']['chain'])
    if event is not None:
        assert not event.get('focusSlot')
        reset=event.get('reset');x=0 if reset else event['x'];y=360 if reset else event['y'];angle=0 if reset else event['rotation']
        chain[0]['position']=dict(x=f((x-context['basePos'][0])*factor),y=f((y-context['basePos'][1])*factor),z=0)
        chain[0]['rotation']=dict(x=0,y=0,z=f(math.sin(angle*math.pi/360)),w=f(math.cos(angle*math.pi/360)))
    ptr(camera+0x30,transform);uc.mem_write(camera+0x4ea,b'\x01');ptr(data+0x18,trs);ptr(data+0x20,parents)
    for j,t in enumerate(chain):
        floats(trs+j*48,[*[t['position'][k] for k in 'xyz'],0,*[t['rotation'][k] for k in ['x','y','z','w']],*[t['scale'][k] for k in 'xyz'],0])
        uc.mem_write(parents+j*4,struct.pack('<i',j+1 if j+1<len(chain) else -1))
    execute(0x5e5440,[camera]);matrix=list(struct.unpack('<16f',uc.mem_read(camera+0x5c,64)))
    assert uc.reg_read(UC_ARM64_REG_X0)==camera+0x5c
    uc.mem_write(camera+0x4ea,b'\0');execute(0x5e5440,[camera])
    assert list(struct.unpack('<16f',uc.mem_read(camera+0x5c,64)))==matrix,'Cached getter changed its stored matrix'
    cases.append(dict(eventIndex=index-1,time=event['time'] if event else None,chain=chain,expected=matrix))
for hook in hooks:uc.hook_del(hook)
windows=[]
for address,length in [(0x5e5440,112),(0x3ff014,128),(0x65b2b8,64),(0x65aee4,64)]:
    b=bytes(uc.mem_read(address,length));windows.append(dict(address=hex(address),bytes=b.hex(),sha256=hashlib.sha256(b).hexdigest()))
proof=dict(schemaVersion=1,binarySha256=n['identity'],sourceContextSha256=hashlib.sha256(context_path.read_bytes()).hexdigest(),
    pixelToCamera=factor,cases=cases,instructionWindows=windows,
    adapters=['0x3170d8 resolves the controlled RAW Transform','0x3fcbcc returns native TRS array/index access; does not replace matrix math'],
    boundary='Native Transform world-to-local, Camera Z flip/multiply and cached-return branch execute. Wide-stage source target poses only; script conversion and Z-roll quaternions are explicit inputs, not DOTween/Unity Quaternion execution. No tween history, tracked-idol branch, final rendered scene, projection getter or particle solver admission.')
target=root/'scripts/fixtures/chibi-camera-matrix-native.json'
if args.write:target.write_text(json.dumps(proof,ensure_ascii=False,separators=(',',':')),encoding='utf8')
else:assert json.loads(target.read_text(encoding='utf8'))==proof,'Native camera matrix/source evidence changed'
print(json.dumps(dict(cases=len(cases),initial=cases[0]['expected'])))
