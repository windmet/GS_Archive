import argparse,hashlib,importlib.util,json,struct,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sha=lambda b:hashlib.sha256(b).hexdigest()
spec=importlib.util.spec_from_file_location('quad',ROOT/'scripts/audit-song-track-native-note-geometry.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
def extract(args):
 import UnityPy
 from unicorn import UC_HOOK_CODE
 binary=args.elf.read_bytes()
 if sha(binary)!=base.ELF_SHA:raise ValueError('Different ELF')
 with zipfile.ZipFile(args.ipa)as z:data=z.read('Payload/BNEI0395.app/Data/data.unity3d')
 if sha(data)!=base.DATA_SHA:raise ValueError('Different IPA')
 env=UnityPy.load(data);objects={o.path_id:o for o in env.objects if o.assets_file.name=='resources.assets'}
 def camera(id):
  obj=objects[id];t=obj.read_typetree();go=obj.read().m_GameObject.read()
  tr=next(e.component.deref()for e in go.m_Component if e.component.deref().type.name=='Transform')
  return dict(pathId=id,name=go.m_Name,sourceSha256=sha(obj.get_raw_data()),transformSha256=sha(tr.get_raw_data()),
   position=tr.read_typetree()['m_LocalPosition'],orthographic=t['orthographic'],orthographicSize=t['orthographic size'],fieldOfView=t['field of view'],cullingMask=t['m_CullingMask']['m_Bits'])
 probe=base.NativeProbe(binary,dict(leftX=-352,rightX=352,y=-212,laneWidthRate=1));r=probe.r;calls=[]
 def stub(cpu,address,size,data):
  if address==0x306a4d8:
   for reg in [r.UC_ARM64_REG_S0,r.UC_ARM64_REG_S1,r.UC_ARM64_REG_S2]:probe.setf(reg,1)
  elif address==0x2ad76d8:cpu.reg_write(r.UC_ARM64_REG_X0,0x100f0000)
  elif address==0x30659ac:calls.append([probe.getf(reg)for reg in [r.UC_ARM64_REG_S0,r.UC_ARM64_REG_S1,r.UC_ARM64_REG_S2]])
  cpu.reg_write(r.UC_ARM64_REG_PC,cpu.reg_read(r.UC_ARM64_REG_X30))
 for a in [0x306a4d8,0x30659ac,0x30653ac,0x2ad76d8,0x26c169c,0x2ade8c0,0x26933b4,0x2adbab8]:probe.cpu.hook_add(UC_HOOK_CODE,stub,begin=a,end=a)
 probe.cpu.mem_write(0x466a486,b'\1');probe.w64(0x10080020,0x10081000);probe.w64(0x10082000,0x10083000)
 cases=[]
 for perspective in [False,True]:
  probe.cpu.mem_write(0x100830d8,bytes([perspective]));calls.clear();probe.setup_call();probe.cpu.reg_write(r.UC_ARM64_REG_X0,0x10080000);probe.cpu.reg_write(r.UC_ARM64_REG_X1,0x10082000)
  probe.cpu.emu_start(0x2046f04,0x1003f000,count=2000)
  initialized=calls[-1]
  for noteScale in [.8,1,1.2]:
   calls.clear();probe.setup_call();probe.cpu.reg_write(r.UC_ARM64_REG_X0,0x10080000);probe.cpu.reg_write(r.UC_ARM64_REG_X1,0x10084000);probe.setf(r.UC_ARM64_REG_S0,noteScale)
   probe.cpu.emu_start(0x2047038,0x1003f000,count=2000)
   cases.append(dict(useParseCamera=perspective,noteScale=noteScale,initializedScale=initialized,playedScale=calls[-1]))
 # Execute the static-radius stores in NoteDrawManager..cctor.
 probe.w64(0x42e60b8,0x10088000);probe.w64(0x10088000,0x10089000);probe.w64(0x100890b8,0x1008a000)
 probe.setup_call();probe.cpu.emu_start(0x20b8630,0x20b8658,count=100)
 radius=struct.unpack('<f',probe.cpu.mem_read(0x1008a000,4))[0]
 canvas=next(e.component.deref()for e in objects[3313].read().m_Component if e.component.deref().type.name=='Canvas')
 methods=[('EffectController.Initialize',0x2046f04,308),('EffectController.Play',0x2047038,216),('FloatingTarget.Init',0x205a558,360),('NoteDrawManager..cctor',0x20b85e8,244)]
 result=dict(schemaVersion=1,source=dict(elfSha256=base.ELF_SHA,dataSha256=base.DATA_SHA,
  methods=[dict(name=n,rva=hex(a),bytes=len(probe.read(a,nbytes)),sha256=sha(probe.read(a,nbytes)))for n,a,nbytes in methods],
  execution='Unicorn executes Initialize/Play with cached Transform. Unity layer/transform/gameobject calls are capture stubs, Vector3.one returns (1,1,1). Not a GPU replay.'),
  cameras=dict(pre=camera(45558),perspective=camera(45568),hold=camera(45564)),
  targetCanvas=dict(pathId=3313,sourceSha256=sha(canvas.get_raw_data()),planeDistance=canvas.read_typetree()['m_PlaneDistance']),
  transientRootScale=cases[4]['initializedScale'][0],holdRootScale=struct.unpack('<f',probe.read(0x3168e80,4))[0],
  noteRadius=radius,connectorRadius=radius-20,cases=cases)
 args.output.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(dict(transientRootScale=result['transientRootScale'],holdRootScale=result['holdRootScale'],connectorRadius=44,cases=cases)))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--elf',type=Path,required=True);p.add_argument('--ipa',type=Path,required=True);p.add_argument('--output',type=Path,default=ROOT/'config/song-hit-projection.v1.json');extract(p.parse_args())
