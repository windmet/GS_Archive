"""Join source camera target matrices, object placement and native stretch vertices."""
import argparse,copy,hashlib,json,math,runpy,sys
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--native-engine',required=True);parser.add_argument('--unicorn-path');parser.add_argument('--write',action='store_true')
args=parser.parse_args();root=Path(__file__).resolve().parents[1]
def load(name):return json.loads((root/'scripts/fixtures'/name).read_text(encoding='utf8'))
source=load('chibi-spatial-context-native.json');camera=load('chibi-camera-matrix-native.json');cone=load('chibi-cone-stretch-native.json')
sys.argv=[str(root/'scripts/prepare-chibi-stretch-kernel-fixture.py'),'--native-engine',args.native_engine]
if args.unicorn_path:sys.argv+=['--unicorn-path',args.unicorn_path]
n=runpy.run_path(sys.argv[0]);hook=n['uc'].hook_add(n['UC_HOOK_CODE'],n['null_free'],begin=0x306258,end=0x306258)
S=source['constants']['wideStageScale']['value'];baseZ=sum(t['position']['z'] for t in source['container']['chain'])
frames=[];cases=[]
for eventIndex,event in enumerate(source['arrangement']['fireEvents']):
    if event['hide']:continue
    name=event['asset'];model=cone['models'][name]['system'];shape=model['shape']
    raw=next(c['input'] for c in cone['cases'] if c['asset']==name)
    rootTransform=model['chain'][-1]
    assert rootTransform['position']==dict(x=0,y=0,z=0) and rootTransform['rotation']==dict(x=0,y=0,z=0,w=1) and rootTransform['scale']==dict(x=1,y=1,z=1)
    cameraIndex=max(i for i,c in enumerate(camera['cases']) if c['time'] is None or c['time']<=event['time'])
    cameraEvent=source['arrangement']['cameraEvents'][cameraIndex-1] if cameraIndex else None
    outer=event['scale']/1000;assert outer>0
    a,b,c,d,tx,ty=raw['matrix'];sz,tz=raw['depthMatrix']
    base=dict(size=model['size']['scalar'],velocityScale=raw['velocityScale'],lengthScale=raw['lengthScale'],maxParticleSize=raw['maxParticleSize'],
        matrix=[a*S*outer,b*S*outer,c*S*outer,d*S*outer,S*(tx*outer+event['x']*.01),S*(ty*outer+(event['y']-360)*.01)],
        particleScale=[raw['particleScale'][0]*S*outer,raw['particleScale'][1]*S*outer,raw['particleScale'][2]*outer],
        worldRotation=raw['worldRotation'],depthMatrix=[sz*outer,baseZ+tz*outer],packedContext=True,sameViewMatrices=True,
        cameraMatrix=camera['cases'][cameraIndex]['expected'],viewHeight=10 if not cameraEvent or cameraEvent.get('reset') else 10/(cameraEvent['zoom']/1000))
    # These particular sources never engage the controlled screen-size cap.
    assert base['size']*base['particleScale'][0]<base['viewHeight']*base['maxParticleSize']
    frameIndex=len(frames);frames.append(dict(asset=name,eventIndex=eventIndex,cameraIndex=cameraIndex,input=base))
    for arc in range(4):
        phi=arc*math.pi/2;angle=shape['angle']*math.pi/180
        velocity=[math.cos(phi)*math.sin(angle)*model['speed']['scalar'],math.cos(angle)*model['speed']['scalar'],-math.sin(phi)*math.sin(angle)*model['speed']['scalar']]
        birth=[math.cos(phi)*shape['radius']['value'],0,-math.sin(phi)*shape['radius']['value']]
        for age in [.05,.2]:
            position=[birth[i]+velocity[i]*age for i in range(3)]
            for function in [0x80b8a4,0x817658]:
                case={**base,'position':position,'velocity':velocity}
                cases.append(dict(frameIndex=frameIndex,arc=arc,age=age,position=position,velocity=velocity,function=hex(function),expected=n['vertices'](function,case)))
n['uc'].hook_del(hook)
dependencies={name:hashlib.sha256((root/'scripts/fixtures'/name).read_bytes()).hexdigest() for name in ['chibi-spatial-context-native.json','chibi-camera-matrix-native.json','chibi-cone-stretch-native.json']}
proof=dict(schemaVersion=1,binarySha256=n['native']['identity'],dependencies=dependencies,frames=frames,cases=cases,
    boundary='All source fire Show placements paired with latest preceding camera command TARGET pose, not interpolated frame capture. Source parent XYZ, wide-stage XY-only scale, Base parent and native getter matrix feed real renderer context and both vertex writers. Controlled cone rays/ages and nonbinding size cap; auxiliary camera fields retain the earlier controlled values. Not tween/RNG history, actual occlusion or runtime admission.')
target=root/'scripts/fixtures/chibi-source-stretch-native.json'
if args.write:target.write_text(json.dumps(proof,ensure_ascii=False,separators=(',',':')),encoding='utf8')
else:assert json.loads(target.read_text(encoding='utf8'))==proof,'Joined source stretch evidence changed'
print(json.dumps(dict(sourceFrames=len(frames),cases=len(cases))))
