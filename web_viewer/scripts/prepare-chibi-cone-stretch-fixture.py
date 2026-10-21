"""Replay source-bound cone stretch inputs; this fixture does not admit new assets."""
import argparse,hashlib,importlib.util,json,math,runpy,sys
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--native-engine',required=True)
parser.add_argument('--unicorn-path')
parser.add_argument('--write',action='store_true')
args=parser.parse_args();root=Path(__file__).resolve().parents[1]
sys.argv=[str(root/'scripts/prepare-chibi-stretch-kernel-fixture.py'),'--native-engine',args.native_engine]
if args.unicorn_path:sys.argv+=['--unicorn-path',args.unicorn_path]
n=runpy.run_path(sys.argv[0])
hook=n['uc'].hook_add(n['UC_HOOK_CODE'],n['null_free'],begin=0x306258,end=0x306258)
spec=importlib.util.spec_from_file_location('cone_extract',root/'scripts/prepare-chibi-object-emitters.py')
em=importlib.util.module_from_spec(spec);spec.loader.exec_module(em)
names={f'fx_in_pfofos_fire_{i}' for i in range(1,9)}
data,raw,images=em.extract(only=names,partial=True)
models={};cases=[]
for name in sorted(names):
    asset=data['assets'][name]
    selected=[s for s in asset['systems'] if s.get('partial')==['stretch_omitted']]
    assert len(selected)==1 and not asset['deferred']
    s=selected[0];p=next(p for o in raw['objects'] if o['asset']==name for p in o['particles'] if p['pathId']==s['source']['pathId'])
    shape=s['shape'];sr=p['renderer']['stretch']
    assert shape['type']==4 and shape['angle']==1 and shape['m_Rotation']==dict(x=-90,y=0,z=0)
    assert shape['m_Scale']==dict(x=1,y=1,z=1) and shape['m_Position']==dict(x=0,y=0,z=0)
    assert s['size']['mode']==s['speed']['mode']==0 and s['sizeOverLife'] is None and s['sizeY'] is None
    assert s['velocity'] is None and s['limit'] is None and s['gravity']['scalar']==0
    assert sr['velocityScale']==0 and sr['lengthScale']==3 and sr['cameraVelocityScale']==0
    assert sr['flip']==dict(x=0,y=0,z=0) and s['alignment']==0
    # Exact source hierarchy, leaf first. Admission remains planar in its parents.
    a,b,c,d,tx,ty,sz,tz=1,0,0,1,0,0,1,0
    world=dict(x=0,y=0,z=0,w=1);scaleX,scaleY,scaleZ=1,1,1
    for tr in s['chain']:
        q=tr['rotation'];scale=tr['scale'];pos=tr['position']
        x,y,z,w=(q[k] for k in ['x','y','z','w'])
        assert all(scale[k]>0 for k in 'xyz')
        assert max(abs(2*(x*z-w*y)),abs(2*(y*z+w*x)),abs(2*(x*z+w*y)),abs(2*(y*z-w*x)))<1e-6
        A=(1-2*(y*y+z*z))*scale['x'];B=2*(x*y+w*z)*scale['x']
        C=2*(x*y-w*z)*scale['y'];D=(1-2*(x*x+z*z))*scale['y']
        a,b,c,d,tx,ty=A*a+C*b,B*a+D*b,A*c+C*d,B*c+D*d,A*tx+C*ty+pos['x'],B*tx+D*ty+pos['y']
        Z=(1-2*(x*x+y*y))*scale['z'];sz,tz=Z*sz,Z*tz+pos['z']
        ox,oy,oz,ow=(world[k] for k in ['x','y','z','w'])
        world=dict(x=w*ox+x*ow+y*oz-z*oy,y=w*oy-x*oz+y*ow+z*ox,
            z=w*oz+x*oy-y*ox+z*ow,w=w*ow-x*ox-y*oy-z*oz)
        scaleX*=scale['x'];scaleY*=scale['y'];scaleZ*=scale['z']
    assert abs(a*c+b*d)<1e-5
    models[name]=dict(bundleSha256=asset['bundleSha256'],system=s,renderer=sr)
    for arc in range(8):
        phi=arc*math.pi/4
        for fraction in [math.sqrt(.001),.5,1]:
            angle=shape['angle']*math.pi/180
            direction=[math.cos(phi)*fraction*math.sin(angle),math.cos(angle),-math.sin(phi)*fraction*math.sin(angle)]
            norm=math.sqrt(sum(x*x for x in direction));v=[x/norm*s['speed']['scalar'] for x in direction]
            birth=[math.cos(phi)*shape['radius']['value']*fraction,0,-math.sin(phi)*shape['radius']['value']*fraction]
            for age in [.025,.1,.225]:
                for camera in [0,.7]:
                    case=dict(position=[birth[i]+v[i]*age for i in range(3)],velocity=v,size=s['size']['scalar'],
                        velocityScale=sr['velocityScale'],lengthScale=sr['lengthScale'],maxParticleSize=sr['maxSize'],
                        matrix=[a,b,c,d,tx,ty],particleScale=[scaleX,scaleY,scaleZ],worldRotation=[world[k] for k in ['x','y','z','w']],depthMatrix=[sz,tz],
                        cameraRotation=camera,packedContext=True,sameViewMatrices=True)
                    for function in [0x80b8a4,0x817658]:
                        cases.append(dict(asset=name,arc=arc,fraction=fraction,age=age,function=hex(function),input=case,expected=n['vertices'](function,case)))
n['uc'].hook_del(hook)
proof=dict(schemaVersion=1,binarySha256=n['native']['identity'],objectIndexSha256=data['objectIndexSha256'],cameraBinding=n['camera_binding'],
    sourceWindows=n['source_windows'],models=models,cases=cases,
    boundary='Controlled cone rays, full source parent XYZ and scalar sizes, two orthographic Z-roll camera conditions. Native context and both vertex writers; only null cleanup adapted. Not native RNG/birth history, all dynamic camera frames, external object placement, perspective, occlusion or scene parity. No new runtime admission.')
target=root/'scripts/fixtures/chibi-cone-stretch-native.json'
if args.write:target.write_text(json.dumps(proof,ensure_ascii=False,separators=(',',':')),encoding='utf8')
else:assert json.loads(target.read_text(encoding='utf8'))==proof,'Native cone stretch/source evidence changed'
print(json.dumps(dict(sourceSystems=len(models),cases=len(cases))))
