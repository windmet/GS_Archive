"""Join every bnckgy fire Show with source camera targets and native stretch vertices."""
import argparse,hashlib,json,math,runpy,sys
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--native-engine',required=True);p.add_argument('--unicorn-path');p.add_argument('--write',action='store_true');args=p.parse_args();root=Path(__file__).resolve().parents[1]
def load(name):return json.loads((root/'scripts/fixtures'/name).read_text(encoding='utf8'))
shared=load('chibi-spatial-context-native.json');fire=load('chibi-bnckgy-fire-native.json');camera=load('chibi-fire-camera-native.json')
sys.argv=[str(root/'scripts/prepare-chibi-stretch-kernel-fixture.py'),'--native-engine',args.native_engine]
if args.unicorn_path:sys.argv+=['--unicorn-path',args.unicorn_path]
n=runpy.run_path(sys.argv[0]);hook=n['uc'].hook_add(n['UC_HOOK_CODE'],n['null_free'],begin=0x306258,end=0x306258)
S=shared['constants']['wideStageScale']['value'];baseZ=sum(t['position']['z'] for t in shared['container']['chain']);frames=[];cases=[]
for eventIndex,event in enumerate(fire['arrangement']['fireEvents']):
 if event['hide']:continue
 for bound in fire['models']['fx_in_bnckgy_fire']['stretchSystems']:
  model=bound['system'];shape=model['shape'];raw=next(c['input'] for c in fire['cases'] if c['source']==model['source']);outer=event['scale']/1000
  rootTransform=model['chain'][-1];assert rootTransform['position']==dict(x=0,y=0,z=0) and rootTransform['rotation']==dict(x=0,y=0,z=0,w=1) and rootTransform['scale']==dict(x=1,y=1,z=1)
  cameraIndex=max(i for i,c in enumerate(camera['cases']) if c['time'] is None or c['time']<=event['time']);ce=None if cameraIndex==0 else fire['arrangement']['cameraEvents'][cameraIndex-1]
  a,b,c,d,tx,ty=raw['matrix'];sz,tz=raw['depthMatrix']
  base=dict(size=raw['size'],velocityScale=raw['velocityScale'],lengthScale=raw['lengthScale'],maxParticleSize=raw['maxParticleSize'],matrix=[a*S*outer,b*S*outer,c*S*outer,d*S*outer,S*(tx*outer+event['x']*.01),S*(ty*outer+(event['y']-360)*.01)],particleScale=[raw['particleScale'][0]*S*outer,raw['particleScale'][1]*S*outer,raw['particleScale'][2]*outer],worldRotation=raw['worldRotation'],depthMatrix=[sz*outer,baseZ+tz*outer],packedContext=True,sameViewMatrices=True,cameraMatrix=camera['cases'][cameraIndex]['expected'],viewHeight=10 if not ce or ce.get('reset') else 10/(ce['zoom']/1000))
  assert base['size']*base['particleScale'][0]<base['viewHeight']*base['maxParticleSize']
  frameIndex=len(frames);frames.append(dict(source=model['source'],eventIndex=eventIndex,cameraIndex=cameraIndex,input=base))
  for arc in range(4):
   phi=arc*math.pi/2;angle=shape['angle']*math.pi/180;velocity=[math.cos(phi)*math.sin(angle)*model['speed']['scalar'],math.cos(angle)*model['speed']['scalar'],-math.sin(phi)*math.sin(angle)*model['speed']['scalar']];birth=[math.cos(phi)*shape['radius']['value'],0,-math.sin(phi)*shape['radius']['value']]
   for age in [.05,.2]:
    position=[birth[i]+velocity[i]*age for i in range(3)]
    for function in [0x80b8a4,0x817658]:cases.append(dict(frameIndex=frameIndex,arc=arc,age=age,position=position,velocity=velocity,function=hex(function),expected=n['vertices'](function,{**base,'position':position,'velocity':velocity})))
n['uc'].hook_del(hook)
dependencies={name:hashlib.sha256((root/'scripts/fixtures'/name).read_bytes()).hexdigest() for name in ['chibi-spatial-context-native.json','chibi-fire-camera-native.json','chibi-bnckgy-fire-native.json']}
proof=dict(schemaVersion=1,binarySha256=n['native']['identity'],dependencies=dependencies,frames=frames,cases=cases,boundary='Every actual fire Show paired to its latest preceding camera command TARGET pose. All six source stretch systems, source parent XYZ, normalized wide-stage and native getter camera matrices; real context and both vertex writers. Not interpolated frame capture, RNG/birth history, camera tween/occlusion, Noise or device parity.')
target=root/'scripts/fixtures/chibi-fire-scene-native.json'
if args.write:target.write_text(json.dumps(proof,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
else:assert json.loads(target.read_text(encoding='utf8'))==proof,'Fire scene evidence changed'
print(json.dumps(dict(showEvents=sum(not e['hide'] for e in fire['arrangement']['fireEvents']),frames=len(frames),cases=len(cases))))
