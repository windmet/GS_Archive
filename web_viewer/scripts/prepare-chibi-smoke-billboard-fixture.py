"""Native controlled Smoke alignment=1 quads; no scene or renderer promotion."""
import argparse,hashlib,json,math,runpy,struct,sys
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--native-engine',required=True);p.add_argument('--unicorn-path');p.add_argument('--write',action='store_true');args=p.parse_args()
root=Path(__file__).resolve().parents[1];source_path=root/'scripts/fixtures/chibi-smoke-source.json'
source=json.loads(source_path.read_text(encoding='utf8'))
sys.argv=[str(root/'scripts/prepare-chibi-billboard-rotation-fixture.py'),'--native-engine',args.native_engine]
if args.unicorn_path:sys.argv+=['--unicorn-path',args.unicorn_path]
n=runpy.run_path(sys.argv[0]);uc=n['uc'];floats=n['floats'];vertices=n['vertices'];original_execute=n['execute']
from unicorn import UC_HOOK_CODE
hook=uc.hook_add(UC_HOOK_CODE,n['free_null'],begin=0x306258,end=0x306258)
roll=0;uniform_size=None
def controlled_execute(address,arguments):
    if address==0x6c505c:
        c,s=math.cos(roll),math.sin(roll)
        matrix=[c,s,0,0,-s,c,0,0,0,0,1,0,0,0,-10,1]
        for offset in [4,0x44]:floats(0x20e4000+offset,matrix)
    if address==0x81e2e0 and uniform_size is not None:
        for offset in [0x2a0,0x2c0,0x2e0]:floats(0x20c0000+offset*8,[uniform_size]*4)
    return original_execute(address,arguments)
vertices.__globals__['execute']=controlled_execute
cases=[]
for particle in source['particles']:
    initial=particle['modules']['InitialModule'];assert not initial['rotation3D'] and particle['renderer']['alignment']==1
    assert all(t['scale']==dict(x=1,y=1,z=1) and t['rotation']==dict(x=0,y=0,z=0,w=1) for t in particle['transformChain'])
    rotation=initial['startRotation'];angles=[rotation['scalar']]
    if rotation['minMaxState']==3:angles=sorted(set([rotation['minScalar'],0,rotation['scalar']]))
    size=initial['startSize'];sizes=[size['scalar']]
    if size['minMaxState']==3:sizes=sorted(set([size['minScalar'],size['scalar']]))
    bounds=[particle['rendererBounds'][key] for key in ['m_MinParticleSize','m_MaxParticleSize']]
    for size_x in sizes:
        size_vector=[size_x,initial['startSizeY']['scalar'],initial['startSizeZ']['scalar']] if initial['size3D'] else None
        uniform_size=None if initial['size3D'] else size_x
        for angle in angles:
            for degrees in [-10,0,10]:
                roll=degrees*math.pi/180
                frame=dict(source={key:particle[key] for key in ['serializedFile','pathId','parameterTreeSha256']},
                    cameraRoll=degrees,rotation=angle,size=size_x,sizeVector=size_vector,bounds=bounds,alignment=1,
                    writer='0x815a1c' if initial['size3D'] else '0x81e2e0')
                # Preserve the source size3D branch; feed scalar endpoints directly to its uniform input arrays.
                expected=vertices([0,0,angle],False,particle['transformChain'],1,frame,
                    position=[.6,-.4,.2],particleSize=size_vector,sizeBounds=bounds,viewHeight=7.2)
                frame['expected']=expected;cases.append(frame)
for i in range(0,len(cases),3):
    assert cases[i]['expected']==cases[i+1]['expected']==cases[i+2]['expected'],'Alignment1 world quads changed under camera Z roll'
view_controls=[]
uniform_size=None
first=source['particles'][0];initial=first['modules']['InitialModule']
size_vector=[initial[k]['scalar'] for k in ['startSize','startSizeY','startSizeZ']]
for degrees in [-10,0,10]:
    roll=degrees*math.pi/180;frame=dict(alignment=0,cameraRoll=degrees)
    frame['expected']=vertices([0,0,0],False,first['transformChain'],0,frame,
        position=[.6,-.4,.2],particleSize=size_vector,sizeBounds=[0,50],viewHeight=7.2)
    view_controls.append(frame)
assert view_controls[0]['expected']!=view_controls[1]['expected']!=view_controls[2]['expected'],'Controlled camera input did not reach the native context builder'
assert view_controls[1]['expected']==cases[1]['expected'],'Identity camera must agree in the two controlled alignments'
assert abs(math.dist(cases[0]['expected'][0]['position'],cases[0]['expected'][1]['position'])-20)<1e-5
assert abs(math.dist(cases[0]['expected'][0]['position'],cases[0]['expected'][3]['position'])-3.3)<1e-5
consumer_controls=[]
for particle in source['particles']:
    initial=particle['modules']['InitialModule'];size=initial['startSize']['scalar']
    size_vector=[initial[k]['scalar'] for k in ['startSize','startSizeY','startSizeZ']] if initial['size3D'] else None
    uniform_size=None if initial['size3D'] else size
    bounds=[particle['rendererBounds'][key] for key in ['m_MinParticleSize','m_MaxParticleSize']]
    roll=0
    for angle in [0,.7,-.7]:
        for height in [.2,7.2]:
            frame=dict(source={key:particle[key] for key in ['serializedFile','pathId','parameterTreeSha256']},angle=angle,viewHeight=height)
            frame['expected']=vertices([0,0,angle],False,particle['transformChain'],1,frame,
                position=[0,0,0],particleSize=size_vector,sizeBounds=bounds,viewHeight=height)
            consumer_controls.append(frame)
vertices.__globals__['execute']=original_execute;uc.hook_del(hook)
proof=dict(schemaVersion=1,binarySha256=n['native']['identity'],sourceSha256=hashlib.sha256(source_path.read_bytes()).hexdigest(),
    functions=['0x6cf028','0x6c505c','0x815a1c','0x81e2e0'],cases=cases,viewControls=view_controls,consumerControls=consumer_controls,
    boundary='Controlled camera matrices, source TRS/size/rotation endpoints and alignment1. Native hierarchy/context and the source uniform/nonuniform quad branches execute; only free(NULL) adapts ABI. No local-simulation position update, moving edge births, runtime container/stage/camera bridge, size/color life, RNG, UV sheet or render admission.')
target=root/'scripts/fixtures/chibi-smoke-billboard-native.json'
if args.write:target.write_text(json.dumps(proof,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
else:assert json.loads(target.read_text(encoding='utf8'))==proof,'Changed native Smoke quad evidence'
print(json.dumps(dict(systems=len(source['particles']),cases=len(cases),status='controlled_native_quads_only')))
