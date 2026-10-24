"""Replay native HoldMesh parts and mesh math at controlled drawing-plane points.

Native Init/SetMetrics, parts, length normalization, projection and mesh bodies
execute as ARM64. Lists, settings/resources, screen dimensions and submission
are explicit stubs. Input/hold judging and create-points scheduling are outside
this fixture; callers must name their clipping policy separately.
"""
import sys, struct, importlib.util, json, argparse, hashlib, base64, zipfile
from collections import deque
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sha = lambda b: hashlib.sha256(b).hexdigest()
spec=importlib.util.spec_from_file_location('quad', ROOT / 'scripts/audit-song-track-native-note-geometry.py')
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


class Probe(m.NativeProbe):
    def __init__(self,binary,target):
        from unicorn import UC_HOOK_CODE
        super().__init__(binary,target)
        self.w64(0x42d4140,0x10090000); self.w64(0x10090000,0x10090100); self.w64(0x100901b8,0x10090400)
        for guard in [0x4666c20,0x466b6d6,0x4671cdb,0x466b6eb,0x466b74e,0x466b74f,0x466b6db,0x466b6ec,0x466b750,0x466b751,0x466b752,0x466b753,0x466b754,0x466b6da]: self.cpu.mem_write(guard,b'\1')
        # Runtime Init computes SetMetrics using the native y at -0.1 and 0.
        self.setup_call();self.cpu.reg_write(self.r.UC_ARM64_REG_X19,0x10000000)
        self.setf(self.r.UC_ARM64_REG_S10,target['leftX']+(target['rightX']-target['leftX'])/4);self.setf(self.r.UC_ARM64_REG_S11,target['leftX'])
        self.cpu.emu_start(0x1afe7c4,0x1afe89c,count=10000)
        self.metrics=dict(timeFactor=struct.unpack('<d',self.cpu.mem_read(0x10090408,8))[0],laneWidth=struct.unpack('<f',self.cpu.mem_read(0x10090418,4))[0],radius=44)

        self.w64(0x10090410,0x10000000)
        self.lists={}
        for field, obj, array, stride in [(0x28,0x10091000,0x10092000,8),(0x20,0x10093000,0x10094000,60),
            (0x30,0x100a0000,0x100a1000,12),(0x38,0x100b0000,0x100b1000,12),
            (0x40,0x100c0000,0x100c1000,8),(0x48,0x100d0000,0x100d1000,16),(0x50,0x100e0000,0x100e1000,4)]:
            self.w64(0x10090400+field,obj);self.w64(obj+0x10,array);self.w32(obj+0x18,0)
            self.lists[obj]=(array,stride)
        self.cpu.mem_write(0x10098030,struct.pack('<f',44))
        self.w64(0x10098060,0x10099000)
        self.trace=deque(maxlen=0)
        self.extra=[0xdf6324,0xdf63d4,0x2ae4c1c,0x3068c8c,0x3069400,0x21cf020,0x3036650,0x30362f8,0x3035f04,0x11f2e80,0x11f2eb4,
            0x11debc4,0x11dd650,0x11ddb30,0x11de820,0x2ad39ec,0x30b751c,0x30b458c,0x310f390,0x312f818,0x30b7204,0x30b428c,0x310f078,0x312f528]
        for address in self.extra: self.cpu.hook_add(UC_HOOK_CODE,self.hook,begin=address,end=address)
    def u32(self,p):return struct.unpack('<I',self.cpu.mem_read(p,4))[0]
    def u64(self,p):return struct.unpack('<Q',self.cpu.mem_read(p,8))[0]
    def append(self,obj,raw):
        array,stride=self.lists[obj];n=self.u32(obj+0x18)
        assert len(raw)==stride
        self.cpu.mem_write(array+0x20+n*stride,raw);self.w32(obj+0x18,n+1)
    def hook(self,cpu,address,size,data):
        r=self.r;x0=cpu.reg_read(r.UC_ARM64_REG_X0)
        if address in [0xdf6324,0xdf63d4]:raise ValueError(f'Runtime init {address:x} caller {cpu.reg_read(r.UC_ARM64_REG_X30):x}')
        elif address==0x2ae4c1c:
            import math
            cpu.reg_write(r.UC_ARM64_REG_X0,math.ceil(self.getf(r.UC_ARM64_REG_S0)))
        elif address in [0x3068c8c,0x3069400]:
            self.setf(r.UC_ARM64_REG_S0,0);self.setf(r.UC_ARM64_REG_S1,1 if address==0x3069400 else 0)
        elif address in [0x11debc4,0x11dd650,0x11ddb30,0x11de820]:pass
        elif address==0x2ad39ec:
            for reg in [r.UC_ARM64_REG_S0,r.UC_ARM64_REG_S1,r.UC_ARM64_REG_S2,r.UC_ARM64_REG_S3]:self.setf(reg,1)
        elif address==0x21cf020:cpu.reg_write(r.UC_ARM64_REG_X0,0x10003000)
        elif address in [0x3036650,0x30b751c,0x30b458c,0x310f390,0x312f818]:self.w32(x0+0x18,0)
        elif address==0x30362f8:self.append(x0,bytes(cpu.mem_read(cpu.reg_read(r.UC_ARM64_REG_X1),60)))
        elif address==0x3035f04:
            array,stride=self.lists[x0];index=cpu.reg_read(r.UC_ARM64_REG_X1)
            cpu.mem_write(array+0x20+index*stride,bytes(cpu.mem_read(cpu.reg_read(r.UC_ARM64_REG_X2),stride)))
        elif address in [0x11f2e80,0x11f2eb4]:cpu.reg_write(r.UC_ARM64_REG_X0,1280 if address==0x11f2e80 else 720)
        elif address in [0x30b7204,0x30b428c,0x310f078]:
            count={0x30b7204:3,0x30b428c:2,0x310f078:4}[address]
            regs=[r.UC_ARM64_REG_S0,r.UC_ARM64_REG_S1,r.UC_ARM64_REG_S2,r.UC_ARM64_REG_S3]
            self.append(x0,struct.pack('<'+'f'*count,*[self.getf(reg) for reg in regs[:count]]))
        elif address==0x312f528:self.append(x0,struct.pack('<I',cpu.reg_read(r.UC_ARM64_REG_X1)&0xffffffff))
        else:raise ValueError(hex(address))
        cpu.reg_write(r.UC_ARM64_REG_PC,cpu.reg_read(r.UC_ARM64_REG_X30))
    def mesh(self,points,draw_scale=1):
        self.draw_scale=draw_scale
        self.w32(0x10091018,0)
        for x,y in points:self.append(0x10091000,struct.pack('<ff',x,y))
        self.setup_call();self.cpu.reg_write(self.r.UC_ARM64_REG_X0,0x10098000);self.setd(self.r.UC_ARM64_REG_D0,0)
        try:self.cpu.emu_start(0x21d1610,0x1003f000,count=1000000)
        except Exception:
            print('PC',hex(self.cpu.reg_read(self.r.UC_ARM64_REG_PC)),list(self.trace));raise
        parts=[list(struct.unpack('<15f',self.cpu.mem_read(0x10094020+i*60,60))) for i in range(self.u32(0x10093018))]
        self.setup_call();self.cpu.reg_write(self.r.UC_ARM64_REG_X0,0x10098000);self.setd(self.r.UC_ARM64_REG_D0,0)
        try:self.cpu.emu_start(0x21d255c,0x1003f000,count=1000000)
        except Exception:
            print('mesh PC',hex(self.cpu.reg_read(self.r.UC_ARM64_REG_PC)),list(self.trace));raise
        def values(obj,kind):
            array,stride=self.lists[obj]
            return [list(struct.unpack(kind,self.cpu.mem_read(array+0x20+i*stride,stride))) for i in range(self.u32(obj+0x18))]
        return dict(parts=parts,vertices=values(0x100a0000,'<fff'),uv=values(0x100c0000,'<ff'),triangles=values(0x100e0000,'<I'))


def run(args):
    if args.unicorn_runtime: sys.path.insert(0,str(args.unicorn_runtime))
    binary=args.native_elf.read_bytes()
    if sha(binary)!=m.ELF_SHA:raise ValueError('Different ELF; bind the native source first')
    plane_bytes=(ROOT/'config/song-track-native-geometry.v1.json').read_bytes()
    plane=json.loads(plane_bytes)
    probe=Probe(binary,plane['target'])
    methods=[('RhythmGameManager.Init',0x1afe6c4,876),('HoldMesh.SetMetrics',0x21cf244,128),
      ('HoldMesh.Create',0x21cf2c4,1600),('HoldMesh.GetLaneModifytimePosFromLane',0x21cfbb8,128),
      ('HoldMesh.GetV3PosFromLaneModifytimePos',0x21cfc38,280),('HoldMesh.GetNormalizedPoint',0x21cfd50,304),
      ('HoldMesh.UpdateFromGameHoldCreatePartsList',0x21d1610,3916),('HoldMesh.UpdateFromGameHoldCreateMesh',0x21d255c,4520),
      ('NoteDrawManager..cctor',0x20b85e8,244),('UnityEngine.Vector2.Normalize',0x3068b7c,124),
      ('UnityEngine.Vector2.get_magnitude',0x3068bf8,148)]
    import UnityPy
    with zipfile.ZipFile(args.ipa) as package:data=package.read('Payload/BNEI0395.app/Data/data.unity3d')
    if sha(data)!=m.DATA_SHA:raise ValueError('Different serialized IPA')
    environment=UnityPy.load(data)
    objects={o.path_id:o for o in environment.objects if o.assets_file.name=='resources.assets'}
    rendering=json.loads((ROOT/'config/song-note-rendering.v1.json').read_bytes())
    skins={}
    for skin,roles in rendering['skins'].items():
        old=roles['hold_line'];sprite=objects[int(old['spritePathId'])].read()
        rd=next(value for key,value in sprite.m_SpriteAtlas.read().m_RenderDataMap if key==sprite.m_RenderDataKey)
        rect=rd.textureRect;texture=rd.texture.read()
        if [rect.width,rect.height]!=[200,200] or ((rd.settingsRaw>>2)&15):raise ValueError('Different hold texture packing')
        png=(ROOT/'public'/old['url'].lstrip('/')).read_bytes()
        if sha(png)!=rendering['assets'][old['url']]['sha256']:raise ValueError('Hold PNG drift')
        skins[skin]=dict(url=old['url'],spritePathId=old['spritePathId'],textureRect=[rect.x,rect.y,rect.width,rect.height],
          atlasWidth=texture.m_Width,atlasHeight=texture.m_Height,pngWidth=200,pngHeight=200,pngSha256=sha(png))
    methods.extend([('NoteDrawManager.CreateMaterial',0x20b6e88,236),('UtilOhashi.SetSourceRect',0x237d1b8,300)])
    source=dict(dataSha256=sha(data),elfSha256=sha(binary),coordinateContractSha256=sha(plane_bytes),
      methods=[dict(name=name,rva=hex(a),bytes=n,sha256=sha(probe.read(a,n))) for name,a,n in methods],
      stubs=[hex(a) for a in sorted(set(probe.stubs+probe.extra)-{0xdf6324,0xdf63d4})],
      execution='Unicorn ARM64 native Init metrics, parts, length normalization, Vector2 normalization/magnitude, position and mesh bodies; resource/settings, lists, scalar helpers and Mesh submission stubs')
    point_sets=[[[2,-10],[2,0]],[[2,-10],[0,0]],[[1,-10],[2,-5],[0,0]],
      [[4,-12],[0,-6],[4,0]],[[0,-1],[4,-.5],[0,0]],[[2.35,-.01],[2.35,0]],
      [[0,-.1],[0,0]],[[4,-.1],[4,0]],[[2,-10],[2,-10],[2,0]],
      [[2,-.1],[3,0],[4,.1]],[[0,-12],[1.5,-9],[4,-6],[2,-3],[0,0]],[[2,-2],[2,-1]]]
    cases=[]
    def packed(values,kind):
        flat=[x for v in values for x in v]
        return base64.b64encode(struct.pack('<'+kind*len(flat),*flat)).decode()
    for points in point_sets:
      for scale in [.8,1,1.2]:
        result=probe.mesh(points,scale)
        cases.append(dict(points=points,drawScale=scale,vertexCount=len(result['vertices']),
          verticesFloat32LE=packed(result['vertices'],'f'),uvFloat32LE=packed(result['uv'],'f'),
          trianglesUint32LE=packed(result['triangles'],'I')))
    runtime=dict(schemaVersion=1,source=source,metrics=probe.metrics,skins=skins,
      boundaries=dict(mesh='native mesh at supplied lane/modified-time points',
        clipping='Web preview shows future points up to the current cursor; native input/deleted-middle state scheduling is separate',
        rendering='WebGL draws native x/y, UV and indices with cropped PNGs; SVG fallback is available; original GPU depth, shader and holding particles are not reproduced'))
    fixture=dict(schemaVersion=1,source=source,target=plane['target'],metrics=probe.metrics,cases=cases)
    runtime_target=ROOT/'config/song-track-native-hold-geometry.v1.json'
    if args.write:runtime_target.write_text(json.dumps(runtime,indent=2)+'\n',encoding='utf8',newline='\n')
    elif json.loads(runtime_target.read_text(encoding='utf8'))!=runtime:raise ValueError('Native hold config drift')
    target=ROOT/'scripts/fixtures/song-track-native-hold-geometry.json'
    if args.write:target.write_text(json.dumps(fixture,indent=2)+'\n',encoding='utf8',newline='\n')
    elif json.loads(target.read_text(encoding='utf8'))!=fixture:raise ValueError('Native hold fixture drift')
    print(f"Native hold mesh: {len(cases)} cases, {sum(c['vertexCount'] for c in cases)} vertices, metrics {probe.metrics}")

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--native-elf',type=Path,required=True)
    parser.add_argument('--unicorn-runtime',type=Path)
    parser.add_argument('--ipa',type=Path,required=True)
    parser.add_argument('--write',action='store_true')
    run(parser.parse_args())
