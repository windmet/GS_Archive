"""Replay native judgement getters and middle-note time/touch predicates.

Evidence extraction only: the archive preview does not judge player input.
Native default-range construction, getter forwarding and predicate bodies run
ARM64. Allocation, Object base construction, List copying and PlayerPrefs are
controlled services; debug settings default to zero in the recorded baseline.
"""
import importlib.util
from pathlib import Path
import sys, struct, json, hashlib, argparse
ROOT=Path(__file__).resolve().parents[1]
sha=lambda data:hashlib.sha256(data).hexdigest()
module_spec=importlib.util.spec_from_file_location('quad_probe',ROOT/'scripts/audit-song-track-native-note-geometry.py')
m=importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(m)


class Probe(m.NativeProbe):
 def __init__(self,binary,target):
  from unicorn import UC_HOOK_CODE
  super().__init__(binary,target)
  self.next_object=0x10080000;self.debug=0
  self.w64(0x434cce8,0x10090000);self.w64(0x10090000,0x10090100);self.w64(0x100901b8,0x10090400)
  for a in [0x4671cdb,0x466d11f,0x4669d7f,0x4669d7b,0x4669d7c,0x4669d7d,0x4669d7e,0x4666bd1,0x4666bd5,0x466d130,0x466d131]:self.cpu.mem_write(a,b'\1')
  self.w64(0x10070010,0x10071000);self.w64(0x10071018,0x10072000);self.w64(0x10072010,0x10073000)
  self.w64(0x10075018,0x10076000)
  # SetTargetPosList computes margins from the bound native target points.
  self.services=[0xdf63f0,0x175d8ac,0x1dfb1f4,0x30b3768]
  self.w64(0x10075018,0x10076000)
  for a in self.services+[0xdf6324,0xdf63d4]:self.cpu.hook_add(UC_HOOK_CODE,self.service,begin=a,end=a)
  self.call(0x1faf0dc)
  self.call(0x242454c,0x10070000,0x10001000)
  self.positionMargins=struct.unpack('<ff',self.cpu.mem_read(0x10070050,8))
 def service(self,cpu,a,size,data):
  r=self.r
  if a==0xdf63f0:
   cpu.mem_write(self.next_object,bytes(0x100));cpu.reg_write(r.UC_ARM64_REG_X0,self.next_object);self.next_object+=0x100
  elif a==0x30b3768:
   dest=cpu.reg_read(r.UC_ARM64_REG_X0);source=cpu.reg_read(r.UC_ARM64_REG_X1)
   cpu.mem_write(dest+0x10,bytes(cpu.mem_read(source+0x10,16)))
  elif a==0x1dfb1f4:self.setf(r.UC_ARM64_REG_S0,self.debug)
  elif a in [0xdf6324,0xdf63d4]:raise ValueError(f'init {a:x} caller {cpu.reg_read(r.UC_ARM64_REG_X30):x}')
  cpu.reg_write(r.UC_ARM64_REG_PC,cpu.reg_read(r.UC_ARM64_REG_X30))
 def call(self,a,x0=0,x1=0,ds=None,fs=None):
  r=self.r;self.setup_call();self.cpu.reg_write(r.UC_ARM64_REG_X0,x0);self.cpu.reg_write(r.UC_ARM64_REG_X1,x1)
  for reg,v in zip([r.UC_ARM64_REG_D0,r.UC_ARM64_REG_D1],ds or []):self.setd(reg,v)
  for reg,v in zip([r.UC_ARM64_REG_S0,r.UC_ARM64_REG_S1,r.UC_ARM64_REG_S2,r.UC_ARM64_REG_S3],fs or []):self.setf(reg,v)
  self.cpu.emu_start(a,0x1003f000,count=10000)
  return self.cpu.reg_read(r.UC_ARM64_REG_X0)
 def mode(self,mode):
  self.w32(0x10073030,3 if mode=='story' else 0);self.cpu.mem_write(0x10073028,bytes([mode=='adjust']))
 def margins(self,mode,debug=0):
  self.mode(mode);self.debug=debug;out={}
  for name,a in [('bad',0x2424450),('good',0x2424470),('great',0x2424490),('perfect',0x24244b0)]:
   self.call(a,0x10070000);out[name]=self.getd(self.r.UC_ARM64_REG_D0)
  return out
 def on_target(self,current):
  self.mode('normal');self.debug=0
  self.cpu.mem_write(0x10076010,struct.pack('<d',0))
  self.setup_call();self.cpu.reg_write(self.r.UC_ARM64_REG_X0,0x10070000);self.cpu.reg_write(self.r.UC_ARM64_REG_X1,0x10075000);self.setd(self.r.UC_ARM64_REG_D0,current)
  self.cpu.emu_start(0x242a1b4,0x1003f000,count=10000)
  return bool(self.cpu.reg_read(self.r.UC_ARM64_REG_X0)&1)
 def touch(self,x,y,adjust=False):
  self.mode('adjust' if adjust else 'normal')
  result=self.call(0x242ad04,0x10070000,0,fs=[x,y,0,0])
  return bool(result&1)

def run(args):
 if args.unicorn_runtime:sys.path.insert(0,str(args.unicorn_runtime))
 binary=args.native_elf.read_bytes()
 if sha(binary)!=m.ELF_SHA:raise ValueError('Different ELF; establish version/RVAs first')
 plane_bytes=(ROOT/'config/song-track-native-geometry.v1.json').read_bytes()
 plane=json.loads(plane_bytes);p=Probe(binary,plane['target'])
 methods=[('EvaluationRangeData..cctor',0x1faf0dc,244),('EvaluationRangeData.get_timeMarginBad',0x1faee80,136),
  ('EvaluationRangeData.get_timeMarginGood',0x1faef3c,136),('EvaluationRangeData.get_timeMarginGreat',0x1faefc4,136),
  ('EvaluationRangeData.get_timeMarginPerfect',0x1faf04c,136),('RhythmDebugButtonConfig.get_perfectRangeDiff',0x1afae20,76),
  ('RhythmGameData.get_evaluationRange',0x1afb60c,204),('RhythmGameNoteManager.get_evaluationRange',0x2424428,40),
  ('RhythmGameManager.GetCalibrationAdjust',0x1afeb88,8),('RhythmGameNoteManager.IsOnTarget',0x242a1b4,188),
  ('RhythmGameNoteManager.CheckTouchPoint',0x242ad04,264),('RhythmGameNoteManager.get_posMarginX',0x24244e8,76),
  ('RhythmGameNoteManager.CheckHoldMiddle',0x2429350,1436),('RhythmGameNoteManager.SetTargetPosList',0x242454c,272)]
 source=dict(elfSha256=sha(binary),coordinateContractSha256=sha(plane_bytes),
  methods=[dict(name=name,rva=hex(a),bytes=n,sha256=sha(p.read(a,n)))for name,a,n in methods],
  services=[hex(a)for a in p.services],
  boundaries='Native range/getter and time/touch predicates only. Full input, skill, score and deleted-middle state transitions are not emulated; no judgement UI is added.')
 margins=[dict(mode=mode,debugRangeDiff=debug,seconds=p.margins(mode,debug))for mode in ['normal','adjust','story']for debug in [0,10,-10]]
 times=[dict(absTime=0,currentTime=t,accepted=p.on_target(t))for t in [-.051,-.05,-.049999,0,.049999,.05,.051]]
 touches=[dict(x=x,y=y,timingAdjust=adjust,accepted=p.touch(x,y,adjust))
   for adjust in [False,True]for x,y in [(0,0),(264,200),(-264,200),(264.001,0),(-264.001,0),(0,200.001),(0,-10000)]]
 result=dict(schemaVersion=1,source=source,positionMargins=list(p.positionMargins),margins=margins,onTarget=times,touches=touches)
 target=ROOT/'scripts/fixtures/song-track-native-judgement.json'
 if args.write:target.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8',newline='\n')
 elif json.loads(target.read_bytes())!=result:raise ValueError('Native judgement evidence drift')
 print(f'Native judgement: {len(margins)} range settings, {len(times)} time predicates, {len(touches)} touch predicates; margins {p.positionMargins}')

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--native-elf',type=Path,required=True)
 parser.add_argument('--unicorn-runtime',type=Path)
 parser.add_argument('--write',action='store_true')
 run(parser.parse_args())
