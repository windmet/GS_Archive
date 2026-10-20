"""Execute native ARM64 Sprite tween code with controlled managed/Unity boundaries.

This is a nonnegative-duration, single-loop, alpha-only code oracle. It does not
run Unity Player, reproduce an original device's frames, or accept the renderer.
Use --write to update the small native trace fixture; otherwise replay it.
"""
import argparse
import gc
import hashlib
import json
from pathlib import Path
import struct
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--native-elf', type=Path, required=True)
parser.add_argument('--python-deps', type=Path, help='Optional local package directory containing unicorn 2.1.4')
parser.add_argument('--write', action='store_true')
args = parser.parse_args()
if args.python_deps:
    sys.path.insert(0, str(args.python_deps.resolve()))
import unicorn
from unicorn import Uc, UC_ARCH_ARM64, UC_MODE_ARM, UC_HOOK_CODE, UC_HOOK_MEM_INVALID
from unicorn.arm64_const import *

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / 'scripts/fixtures/chibi-object-sprite-tween-native.json'
METHODS = {
    0x18062e4: ('TweenManager.AddActiveTween', 0x18065a0),
    0x1807be8: ('TweenManager.Update', 0x1808048),
    0x18077d0: ('TweenManager.ReorganizeActiveTweens', 0x1807a70),
    0x1807a70: ('TweenManager.MarkForKilling', 0x1807b04),
    0x1807b04: ('TweenManager.DespawnTweens', 0x1807be8),
    0x1806ab4: ('TweenManager.RemoveActiveTween', 0x1806f68),
    0x1802b6c: ('Tween.DoGoto', 0x1802e70),
    0x2be6c58: ('ColorTweener.DoStartup', 0x2be6e68),
    0x2bdfc78: ('ColorTweener.DOStartupDurationBased', 0x2bdfcf8),
    0x2b937bc: ('ColorTweener.ApplyTween', 0x2b93988),
    0x13efa20: ('ColorPlugin.ConvertToStartValue', 0x13efa24),
    0x13efa80: ('ColorPlugin.SetChangeValue', 0x13efadc),
    0x13efae8: ('ColorPlugin.EvaluateAndApply', 0x13efd44),
    0x13eed70: ('EaseManager.Evaluate', 0x13ef8a0),
    0x1c9e114: ('ObjectLayer.EraseSpriteComplete', 0x1c9e144),
}

# Adapters only: IL2CPP metadata/class init and array type-cast, managed
# List.Add/Clear, color delegates, pool Despawn, callback delegate dispatch,
# Component.gameObject and GameObject.SetActive. Native update/compaction,
# startup capture, interpolation, completion and active-slot removal execute
# from ELF bytes. The generic vtable points to its concrete Color methods.
class Replay:
    def __init__(self, elf, initial=.6):
        self.u=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
        self.u.mem_map(0,0x6000000)
        ph=struct.unpack_from('<Q',elf,32)[0];size,count=struct.unpack_from('<HH',elf,54)
        for i in range(count):
            p=struct.unpack_from('<IIQQQQQQ',elf,ph+i*size)
            if p[0]==1:self.u.mem_write(p[3],elf[p[2]:p[2]+p[5]])
        self.u.mem_map(0x10000000,0x1000000);self.heap=0x10000000
        self.u.mem_map(0x20000000,0x100000);self.u.mem_map(0x30000000,0x10000)
        self.stop=0x3000f000;self.u.mem_write(self.stop,b'\xc0\x03\x5f\xd6')
        self.u.reg_write(UC_ARM64_REG_CPACR_EL1,3<<20)
        self.colors=[.2,.3,.4,initial];self.active=False;self.trace=[];self.current='';self.tweens={};self.callbacks={};self.time=0
        self.hooks={};self.executed={}
        self.get=0x30000200
        for a in [self.get]:self.u.mem_write(a,b'\xc0\x03\x5f\xd6')
        self.hooks.update({0xdf6324:self.ret,0xdf63d4:self.ret,
            self.get:self.getter,0x295d288:self.getter,0x295f5b0:self.setter,
            0xdf63e0:self.ret,0x3095810:self.list_add,0x1802e70:self.callback,
            0x1803b64:self.ret,0x3095af4:self.list_clear,0x2ad76d8:self.ret,0x2adbab8:self.activate,
            0x30000400:self.callback_done})
        assert not set(METHODS).intersection(self.hooks), 'Native oracle functions must not be replaced by host hooks'
        self.u.hook_add(UC_HOOK_CODE,self.hook)
        self.u.hook_add(UC_HOOK_MEM_INVALID,self.invalid)
        self.dot=self.class_static(0x42d1c00);self.w8(self.dot+8,1)
        self.manager=self.class_static(0x4300478)
        self.arr=self.alloc(0x1000);self.wq(self.arr,self.alloc(0x100));self.wi(self.arr+0x18,256)
        self.wq(self.manager+0x40,self.arr)
        self.kill_list=self.alloc(0x40);self.wq(self.kill_list+0x10,self.alloc(0x1000));self.wq(self.manager+0x58,self.kill_list)
        self.wi(self.manager+0x60,-1);self.wi(self.manager+0x68,-1)
        self.cls=self.alloc(0x400);self.plugin=self.alloc(0x20);pcls=self.alloc(0x300);self.wq(self.plugin,pcls)
        for off,fn in [(0x198,0x13efa20),(0x1b8,0x13efa80),(0x1d8,0x13efae8)]:self.wq(pcls+off,fn)
        self.context=self.alloc(0x80);table=self.alloc(0x80);self.wq(self.context+0x30,table)
        for off,fn in [(8,self.get),(0x28,0x2bdfc78)]:
            m=self.alloc(0x40);self.wq(m,fn);self.wq(table+off,m)
        self.wq(self.cls+0x1a8,0x2be6c58);self.wq(self.cls+0x1b0,self.context)
        self.wq(self.cls+0x1b8,0x2b937bc)
    def alloc(self,n):
        p=self.heap;self.heap+=(n+15)&~15;return p
    def wq(self,a,v):self.u.mem_write(a,struct.pack('<Q',v))
    def wi(self,a,v):self.u.mem_write(a,struct.pack('<i',v))
    def w8(self,a,v):self.u.mem_write(a,bytes([v]))
    def wf(self,a,v):self.u.mem_write(a,struct.pack('<f',v))
    def q(self,a):return struct.unpack('<Q',self.u.mem_read(a,8))[0]
    def i(self,a):return struct.unpack('<i',self.u.mem_read(a,4))[0]
    def f(self,a):return struct.unpack('<f',self.u.mem_read(a,4))[0]
    def sf(self,i,v):self.u.reg_write(UC_ARM64_REG_S0+i,struct.unpack('<I',struct.pack('<f',v))[0])
    def fs(self,i):return struct.unpack('<f',struct.pack('<I',self.u.reg_read(UC_ARM64_REG_S0+i)))[0]
    def class_static(self,got):
        cls=self.alloc(0x200);static=self.alloc(0x100);self.wq(self.q(got),cls);self.wq(cls+0xb8,static);return static
    def ret(self):self.u.reg_write(UC_ARM64_REG_PC,self.u.reg_read(UC_ARM64_REG_LR))
    def getter(self):
        self.trace.append(['getter',self.time,self.current,self.colors[3]])
        for i,v in enumerate(self.colors):self.sf(i,v)
        self.ret()
    def setter(self):
        self.colors=[self.fs(i) for i in range(4)]
        self.trace.append(['setter',self.time,self.current,self.colors[3]])
        self.ret()
    def list_add(self):
        p=self.u.reg_read(UC_ARM64_REG_X0);value=self.u.reg_read(UC_ARM64_REG_X1)
        n=self.i(p+0x18);self.wq(self.q(p+0x10)+0x20+n*8,value);self.wi(p+0x18,n+1);self.ret()
    def list_clear(self):
        self.wi(self.u.reg_read(UC_ARM64_REG_X0)+0x18,0);self.ret()
    def callback(self):
        p=self.u.reg_read(UC_ARM64_REG_X0)
        assert p in self.callbacks,hex(p)
        self.callback_return=self.u.reg_read(UC_ARM64_REG_LR)
        self.u.reg_write(UC_ARM64_REG_LR,0x30000400);self.u.reg_write(UC_ARM64_REG_PC,0x1c9e114)
    def callback_done(self):
        self.u.reg_write(UC_ARM64_REG_X0,1);self.u.reg_write(UC_ARM64_REG_PC,self.callback_return)
    def activate(self):
        self.active=bool(self.u.reg_read(UC_ARM64_REG_X1));self.trace.append(['active',self.time,self.current,self.active]);self.ret()
    def hook(self,u,a,z,data):
        if a in METHODS:self.executed[METHODS[a][0]]=self.executed.get(METHODS[a][0],0)+1
        if a==0x2be6c58 or a==0x2b937bc:self.current=self.tweens.get(u.reg_read(UC_ARM64_REG_X0),'unknown')
        if a in self.hooks:self.hooks[a]()
        if a in [0xdf63f8,0xdf63c4,0xdf6328]:raise RuntimeError('Native failure '+hex(a))
    def invalid(self,u,access,address,size,value,data):raise RuntimeError(f'Invalid {address:x} PC {u.reg_read(UC_ARM64_REG_PC):x}')
    def call(self,a,x=(),floats=()):
        self.u.reg_write(UC_ARM64_REG_SP,0x200ff000);self.u.reg_write(UC_ARM64_REG_LR,self.stop)
        for i,v in enumerate(x):self.u.reg_write(UC_ARM64_REG_X0+i,v)
        for i,v in enumerate(floats):self.sf(i,v)
        self.u.emu_start(a,self.stop,count=1000000)
        assert self.u.reg_read(UC_ARM64_REG_PC)==self.stop,hex(self.u.reg_read(UC_ARM64_REG_PC))
    def add(self,name,target,duration):
        if target not in (0, 1) or duration < 0 or self.i(self.manager+0x10) >= 255:
            raise ValueError('Replay profile requires nonnegative-duration alpha-only tweens, capacity <256')
        p=self.alloc(0x200);self.tweens[p]=name;self.wq(p,self.cls)
        self.wf(p+0x28,1);self.wf(p+0x90,duration);self.wi(p+0x94,1);self.wi(p+0xa4,6)
        self.w8(p+0x8c,1);self.w8(p+0xf8,1);self.w8(p+0x100,1);self.w8(p+0x13c,1)
        self.wq(p+0x140,p);self.wq(p+0x148,p);self.wq(p+0x150,self.plugin);self.wf(p+0x128,target)
        if target==0:
            closure=self.alloc(0x20);self.callbacks[closure]=p;self.wq(closure+0x10,p);self.wq(p+0x70,closure)
        else:self.active=True
        self.call(0x18062e4,(p,0));return p
    def step(self,dt):
        self.time+=dt;self.call(0x1807be8,(0,0),(dt,dt))
        return [self.time,self.colors[3],self.active]

    def snapshot(self):
        slots = [self.q(self.arr+0x20+i*8) for i in range(self.i(self.manager+0x60)+1)]
        return dict(time=self.time, color=self.colors[:], active=self.active,
            activeSlots=[self.tweens[p] if p else None for p in slots],
            starts={name:dict(captured=bool(self.u.mem_read(p+0xe9,1)[0]), alpha=self.f(p+0x118))
                for p,name in self.tweens.items()})


def run_case(elf, name, initial, actions):
    replay = Replay(elf, initial)
    observations = []
    for action in actions:
        if action[0] == 'add':
            replay.add(*action[1:])
        elif action[0] == 'step':
            replay.step(action[1])
        elif action[0] == 'external-alpha':
            replay.colors[3] = action[1]
        else:
            raise ValueError('Unknown replay action')
        observations.append(replay.snapshot())
    result = dict(name=name, initialAlpha=initial, actions=actions,
        observations=observations, trace=replay.trace, executed=replay.executed)
    del replay
    gc.collect()
    return result


def main():
    if unicorn.__version__ != '2.1.4':
        raise ValueError('Replay requires the pinned unicorn 2.1.4 engine')
    elf = args.native_elf.read_bytes()
    digest = hashlib.sha256(elf).hexdigest()
    source = json.loads((ROOT / 'scripts/fixtures/chibi-object-sprite-sources.json').read_text(encoding='utf8'))
    if digest != source['elfSha256']:
        raise ValueError('Native ELF identity changed')
    plans = [
        ('first-unit-alpha',1,[['add','show',1,1],['step',.25],['step',.25],['step',.5]]),
        ('first-translucent-alpha',.5882353186607361,[['add','show',1,1],['step',.25],['step',.25],['step',.5]]),
        ('lazy-getter',.6,[['add','show',1,1],['external-alpha',.2],['step',.25]]),
        ('short-tween-then-old-write',.2,[['add','old-show',1,2],['step',.25],['add','short-hide',0,.1],
            ['step',.1],['step',.15],['add','new-show',1,.25],['step',.1],['step',.15],['step',.1]]),
        ('same-frame-startup-order',.2,[['add','old-show',1,2],['add','short-hide',0,.1],['step',.1],['step',.15]]),
        ('old-erase-after-show',1,[['add','hide',0,1],['step',.25],['add','show',1,2],['step',.75],['step',.1]]),
        ('active-array-compaction',.2,[['add','A',1,2],['add','B',1,.1],['add','C',1,3],['step',.1],
            ['step',.1],['add','D',1,4],['step',.1]]),
        ('zero-hide',1,[['add','show',1,1],['step',.25],['add','hide',0,0],['step',1/60],['step',.25]]),
        ('zero-show',.2,[['add','show',1,0],['step',0]]),
    ]
    cases = [run_case(elf, *plan) for plan in plans]
    tracks = []
    for song, asset, sprite in [('cfprde_live_effect','fx_in_cfprde_overlight_1',0),
            ('cfprde_live_effect','fx_in_cfprde_overlight_2',None),('grwsml_live_effect','fx_in_grwsml_overlight',0)]:
        events = [e for e in source['commandSamples'][song]['objectLayerEvents'] if e['asset']==asset]
        sprites = source['assets'][asset]['sprites']
        initial = (sprites[sprite] if sprite is not None else next(s for s in sprites if s['color']['a']<1))['color']['a']
        replay = Replay(elf, initial)
        probes = {0,420,444,445,462,480,498,510,522,523,540,552,570,582,588,600,660,720}
        samples = []
        index = 0
        for frame in range(721):
            while index<len(events) and events[index]['time']<=frame*1000/60+1e-7:
                if index==0:
                    replay.active=True
                event=events[index]
                replay.add(str(index),0 if event['hide'] else 1,event['duration']/1000)
                index+=1
            replay.time=(frame-1)/60
            replay.step(1/60)
            if frame in probes:
                samples.append(dict(milliseconds=frame*1000/60,alpha=replay.colors[3],active=replay.active))
        tracks.append(dict(song=song,asset=asset,initialAlpha=initial,events=events,
            clock='Web reference frames at n*1000/60, commands before update, dt=1/60; not device history',samples=samples))
        del replay
        gc.collect()
    executed = {name:sum(case['executed'].get(name,0) for case in cases) for name,_ in METHODS.values()}
    if not all(executed.values()):
        raise ValueError('A claimed native function was not executed: ' + str(executed))
    assert all(row['color'][3] == 1 for row in cases[0]['observations'])
    assert cases[2]['observations'][-1]['starts']['show']['alpha'] != .6
    assert cases[3]['observations'][4]['color'][3] > 0 and not cases[3]['observations'][4]['active']
    assert cases[3]['observations'][-2]['color'][3] == 1 and cases[3]['observations'][-1]['color'][3] < 1
    assert cases[6]['observations'][-1]['activeSlots'] == ['A','C','D']
    result = dict(schemaVersion=1, elfSha256=digest, emulator='unicorn-2.1.4-arm64',
        scope='controlled nonnegative-duration single-loop alpha-only tweens; not Unity Player/device parity',
        nativeMethods={name:dict(start=hex(start),end=hex(end),
            sha256=hashlib.sha256(elf[start:end]).hexdigest()) for start,(name,end) in METHODS.items()},
        boundaries=['IL2CPP metadata/class init and managed array cast', 'Managed List.Add/Clear and pool allocation/despawn',
            'Color getter/setter delegates, callback delegate dispatch, Component.gameObject and GameObject.SetActive',
            'Concrete Color generic method context/vtable supplied; nonnegative duration, one loop, alpha-only, default OutQuad',
            'Show activation and external test alpha supplied by host; native erase completion callback executes',
            'Explicit synthetic frame deltas and command dispatch; original Conductor/device frame history unmeasured'],
        executed=executed,cases=cases,referenceTracks=tracks)
    if args.write:
        FIXTURE.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    elif result != json.loads(FIXTURE.read_text(encoding='utf8')):
        raise ValueError('Native Sprite tween replay drifted')
    print(json.dumps(dict(cases=len(cases), nativeFunctions=len(executed), status='native-code-replay-passed; renderer-acceptance-separate')))


if __name__ == '__main__':
    main()
