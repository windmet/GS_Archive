"""Bind story bg effects (effect_bgstart) to the APK fx_adv_* ParticleSystems.

Reuses the stage tools unchanged: audit.particle_record reads the RAW system,
the stage model() validates and serializes it, and the runtime samples it with
sampleObjectEmitter. Only the ADV placement differs, and it is adapted here:

- StoryEffectController instantiates the prefab under BackEffect (StoryIdolCanvas,
  scale 1/72), keeping its local transforms. Systems use Local scaling, which
  ignores parent scale, so one particle unit is 72 canvas units. The emitter is
  replaced by one synthesized transform at its canvas position in those units.
- Rain_far carries an enabled ForceModule whose axes are all constant 0; it is
  proven inert and dropped.
- The stage model() rejects a moving Edge emitter. Unity's Edge emits along the
  shape's +Y, which is the sampler's case 12 direction, so the speed is
  restored after validation.
- Unity draws a positive particle rotation clockwise on screen; the stage sampler
  draws it counter-clockwise. The rain prefabs prove the native direction: their
  constant start rotations are 90 degrees plus the shape tilt (93 = 90 + 3,
  100 = 90 + 10), which lines each streak up with its fall only when clockwise.
  The ADV model therefore stores the rotation curves negated.
"""
import argparse,copy,hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from importlib.util import module_from_spec,spec_from_file_location
def load(name,file):
    spec=spec_from_file_location(name,ROOT/'scripts'/file);module=module_from_spec(spec);spec.loader.exec_module(module);return module
def sha(data):return hashlib.sha256(data).hexdigest()
def require(ok,message):
    if not ok:raise ValueError(message)

# effect id -> prefab names. cameraflare picks its side from the background's lightPosition (1 left, 2 right).
EFFECTS={'cameraflare':{'1':'fx_adv_cameraflare_left','2':'fx_adv_cameraflare_right'},
    'fx_adv_rain':'fx_adv_rain','fx_adv_rain_heavy':'fx_adv_rain_heavy','fx_adv_rain_heavy2':'fx_adv_rain_heavy2'}
PREFABS=sorted({v for e in EFFECTS.values() for v in (e.values() if isinstance(e,dict) else [e])})
# StoryIdolCanvas: CharacterParent draws at sorting order 10, so lower orders sit behind the idols.
CHARACTER_SORTING_ORDER=10
CANVAS_PER_WORLD=72
# StoryCamera orthographicSize (AdvStageLayout.ADV_ORTHOGRAPHIC_SIZE): the view is twice this in particle units.
VIEW_HEIGHT_WORLD=2*4.347826
# Existing published copies of the native textures (fx_extracted), checked pixel for pixel.
TEXTURE_FILES={'fx_adv_rain':'/data/fx_extracted/unity_fx_adv_rain.png','fx_adv_flare_01':'/data/fx_extracted/unity_fx_adv_flare_01.png'}

def quat_mul(a,b):
    return dict(w=a['w']*b['w']-a['x']*b['x']-a['y']*b['y']-a['z']*b['z'],x=a['w']*b['x']+a['x']*b['w']+a['y']*b['z']-a['z']*b['y'],
        y=a['w']*b['y']-a['x']*b['z']+a['y']*b['w']+a['z']*b['x'],z=a['w']*b['z']+a['x']*b['y']-a['y']*b['x']+a['z']*b['w'])
def quat_apply(q,v):
    p=quat_mul(quat_mul(q,dict(w=0,**v)),dict(w=q['w'],x=-q['x'],y=-q['y'],z=-q['z']));return {k:p[k] for k in 'xyz'}

def rect_position(t,parent):
    """Planar placement of a RectTransform: UGUI drives localPosition x/y from the anchors and
    m_AnchoredPosition (the serialized m_LocalPosition x/y is stale in these prefabs); z stays local."""
    require(t['m_AnchorMin']==t['m_AnchorMax'],'Stretched RectTransform needs its parent rect')
    if parent is None:
        # Prefab root under BackEffect: only a centred, unshifted root keeps the BackEffect origin.
        require(t['m_AnchorMin']==dict(x=0.5,y=0.5) and t['m_AnchoredPosition']==dict(x=0.0,y=0.0),'Prefab root offset needs the BackEffect rect')
        return dict(x=0.0,y=0.0,z=t['m_LocalPosition']['z'])
    require(parent['m_AnchorMin']==parent['m_AnchorMax'],'Stretched parent RectTransform')
    anchor={k:(t['m_AnchorMin'][k]-parent['m_Pivot'][k])*parent['m_SizeDelta'][k] for k in 'xy'}
    return dict(x=anchor['x']+t['m_AnchoredPosition']['x'],y=anchor['y']+t['m_AnchoredPosition']['y'],z=t['m_LocalPosition']['z'])

def hierarchy_chain(particle,audit):
    """Transform chain of a system, leaf first. audit.transform_chain only follows plain Transforms; the rain
    prefabs are RectTransforms, placed by their anchors (rect_position)."""
    go=audit.local_object(particle,particle.read_typetree()['m_GameObject'],'GameObject')
    current=next(o for o in (audit.local_object(go,c['component']) for c in go.read_typetree()['m_Component']) if o.type.name in ('Transform','RectTransform'))
    chain=[]
    while current:
        t=current.read_typetree()
        require(t['m_Father']['m_FileID']==0,'External effect parent')
        parent=audit.local_object(current,t['m_Father']) if t['m_Father']['m_PathID'] else None
        position=t['m_LocalPosition'];rect={}
        if current.type.name=='RectTransform':
            parent_tree=parent.read_typetree() if parent else None
            require(parent is None or parent.type.name=='RectTransform','RectTransform under a plain Transform')
            position=rect_position(t,parent_tree)
            rect=dict(rect={k:t[f'm_{k[0].upper()}{k[1:]}'] for k in ('anchorMin','anchorMax','anchoredPosition','sizeDelta','pivot','localPosition')})
        chain.append({**audit.source_ref(current),'position':position,'rotation':t['m_LocalRotation'],'scale':t['m_LocalScale'],**rect,'parent':audit.pointer(t['m_Father'])})
        current=parent
    return chain

def local_chain(chain):
    """Prefab-root-relative world placement in particle units, with only the system's own scale (Local mode)."""
    require(chain and 'unresolvedParent' not in chain[-1] and chain[-1]['parent']==dict(fileId=0,pathId='0'),'Effect is not a prefab root hierarchy')
    position=dict(x=0,y=0,z=0);rotation=dict(x=0,y=0,z=0,w=1);scale=dict(x=1,y=1,z=1)
    for t in reversed(chain):
        offset=quat_apply(rotation,{k:t['position'][k]*scale[k] for k in 'xyz'})
        position={k:position[k]+offset[k] for k in 'xyz'};rotation=quat_mul(rotation,t['rotation']);scale={k:scale[k]*t['scale'][k] for k in 'xyz'}
    # The prefab root's localPosition is in canvas units (it is placed under BackEffect); express in particle units.
    canvas={k:position[k] for k in 'xyz'}
    return dict(pathId=chain[0]['pathId'],serializedFile=chain[0]['serializedFile'],type='Transform',synthesized='adv-local-scaling-v1',
        position={k:canvas[k]/CANVAS_PER_WORLD for k in 'xyz'},rotation=rotation,scale=chain[0]['scale'],parent=dict(fileId=0,pathId='0')),canvas

def adapt(p,stage,renderer):
    """Map one ADV system onto the stage model's planar, hierarchy-scaled profile."""
    p=copy.deepcopy(p);m=p['modules'];main=p['main']
    require(main['scalingMode']==1,'ADV adapter expects Local scaling')
    transform,canvas=local_chain(p['transformChain'])
    p['transformChain']=[transform];main['scalingMode']=0
    adaptations=['local-scaling-synthesized-transform']
    force=m.pop('ForceModule',None)
    if force:
        require(all(force[k]['minMaxState']==0 and force[k]['scalar']==0 for k in 'xyz'),'Nonzero ForceModule needs integration')
        adaptations.append('zero-force-module-dropped')
    pivot=p['renderer']['pivot']
    if pivot!=dict(x=0,y=0,z=0):
        # The stage model has no pivot; the ADV runtime offsets each quad by pivot x size along its own axes.
        require(pivot['z']==0,'Depth pivot');p['renderer']['pivot']=dict(x=0,y=0,z=0);adaptations.append('renderer-pivot-applied-by-adv-runtime')
    s=m.get('ShapeModule');speed=m['InitialModule']['startSpeed']
    moving_edge=s and s['type']==12 and speed['scalar']!=0
    if moving_edge:
        require(s['radius']['mode']==0,'Animated edge radius');m['InitialModule']['startSpeed']=dict(speed,scalar=0,minScalar=0)
        adaptations.append('moving-edge-speed-restored')
    system=stage.model(p)
    # StoryParticleEffect.SetEffectAlpha scales the start colour alpha and, when ColorModule is on, every
    # lifetime alpha key: the command alpha reaches the particle twice.
    system['commandAlphaPower']=2 if 'ColorModule' in m else 1
    if moving_edge:system['speed']=stage.initial_curve(speed)
    if pivot!=dict(x=0,y=0,z=0):system['pivot']=dict(x=pivot['x'],y=pivot['y'])
    # m_Flip is the share of particles mirrored on each axis; only all-or-none is deterministic without a draw.
    flip=renderer['m_Flip'];require(flip['z']==0 and flip['x'] in (0,1) and flip['y'] in (0,1),'Partial renderer flip')
    if flip['x'] or flip['y']:system['flip']=dict(x=int(flip['x']),y=int(flip['y']));adaptations.append('renderer-flip-applied-by-adv-runtime')
    # Billboards are clamped to m_MaxParticleSize view heights; prove the clamp never engages.
    largest=max(abs(c[k]) for c in (system['size'],system['sizeY'] or system['size']) for k in ('scalar','minScalar'))
    require(system['size']['mode'] in (0,3) and system['sizeOverLife'] is None and largest<=renderer['m_MaxParticleSize']*VIEW_HEIGHT_WORLD and renderer['m_MinParticleSize']==0,'Particle size clamp engages')
    for field in ('rotation','angularVelocity'):
        curve=system[field]
        if curve is None:continue
        require(curve['mode'] in (0,3) and system.get('rotationX') is None,'Rotation curve needs keyed negation')
        system[field]=dict(curve,scalar=-curve['scalar'],minScalar=-curve['minScalar'])
    adaptations.append('rotation-negated-to-clockwise')
    return system,canvas,adaptations

def prefab_roots(env,audit):
    roots={}
    for go in env.objects:
        if go.type.name!='GameObject':continue
        name=go.read().m_Name
        if name not in PREFABS:continue
        transform=next(o for o in (audit.local_object(go,c['component']) for c in go.read_typetree()['m_Component']) if o.type.name in ('Transform','RectTransform'))
        if not transform.read_typetree()['m_Father']['m_PathID']:
            require(name not in roots,f'Duplicate prefab root {name}');roots[name]=go
    require(sorted(roots)==PREFABS,'Missing fx_adv prefab root')
    return roots

def systems_under(go,audit):
    """ParticleSystems of a prefab in hierarchy order, as (owner, pointer) pairs."""
    out=[];pending=[go]
    while pending:
        g=pending.pop(0);t=g.read_typetree();transform=None
        for c in t['m_Component']:
            ob=audit.local_object(g,c['component'])
            require(ob is not None,'External prefab component')
            if ob.type.name=='ParticleSystem':out.append((ob,c['component']))
            elif ob.type.name in ('Transform','RectTransform'):transform=ob
            else:require(ob.type.name=='ParticleSystemRenderer','Scripted or animated fx_adv prefab: '+ob.type.name)
        for child in transform.read_typetree()['m_Children']:
            pending.append(audit.local_object(transform,audit.local_object(transform,child).read_typetree()['m_GameObject'],'GameObject'))
    return out

def unity_data():
    """APK assets/bin/Data/data.unity3d from the configured XAPK."""
    effects=load('adv_effects','prepare-live-chibi-stage-effects.py')
    sources=effects.load_archive_sources(None);return effects.read_unity_data(effects.find_xapk(None,sources.xapk_file))

def extract(data):
    import UnityPy
    audit=load('adv_audit','audit-live-chibi-stage-objects.py');stage=load('adv_stage','prepare-chibi-object-emitters.py')
    env=UnityPy.load(data)
    prefabs={};fixture=dict(unityDataSha256=sha(data),prefabs={});textures={};images={}
    for name,go in sorted(prefab_roots(env,audit).items()):
        systems=[];records=[]
        for owner,pointer in systems_under(go,audit):
            record=audit.particle_record(owner,pointer,True);record['transformChain']=hierarchy_chain(owner,audit);records.append(record)
            go_=audit.local_object(owner,owner.read_typetree()['m_GameObject'],'GameObject')
            renderer=next(o for o in (audit.local_object(go_,c['component']) for c in go_.read_typetree()['m_Component']) if o.type.name=='ParticleSystemRenderer').read_typetree()
            record['rendererFlags']={k:renderer[k] for k in ('m_Flip','m_MinParticleSize','m_MaxParticleSize','m_SortMode')}
            system,canvas,adaptations=adapt(record,stage,renderer)
            mat=record['renderer']['materials'][0];tex=next(t for t in mat['textures'] if t['property']=='_MainTex')
            require(tex['scale']==dict(x=1,y=1) and tex['offset']==dict(x=0,y=0),'Texture UV transform')
            texob=owner.assets_file.objects[int(tex['pathId'])];image=texob.read();key=image.m_Name
            require(key in TEXTURE_FILES,'Unpublished fx_adv texture '+key)
            if key not in textures:
                images[key]=image.image.convert('RGBA')
                textures[key]=dict(source=audit.source_ref(texob),rawSha256=sha(texob.get_raw_data()),file=TEXTURE_FILES[key],width=image.m_Width,height=image.m_Height)
            system['texture']=key
            system['layer']='front' if system['sortingOrder']>CHARACTER_SORTING_ORDER else 'back'
            system['canvasPosition']=canvas;system['adaptations']=adaptations
            systems.append(system)
        prefabs[name]=dict(source=audit.source_ref(go),systems=systems)
        fixture['prefabs'][name]=records
    model=dict(schemaVersion=1,contract='native-adv-particle-v1',unityDataSha256=sha(data),
        placement=dict(parent='StoryIdolCanvas/SafeArea_Back/BackEffect',canvasPerWorld=CANVAS_PER_WORLD,characterSortingOrder=CHARACTER_SORTING_ORDER,
            followsCamera=True,alpha='startColor and lifetime alpha keys each scaled by the command alpha (alpha squared)',prewarm=False),
        effects=EFFECTS,prefabs=prefabs,textures=textures)
    return model,fixture,images

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--write',action='store_true');parser.add_argument('--report',action='store_true')
    parser.add_argument('--if-available',action='store_true',help='Exit cleanly when the APK source or UnityPy is absent (verifier mode).');args=parser.parse_args()
    try:source=unity_data()
    except (ImportError,OSError,ValueError) as error:
        if not args.if_available:raise
        print(f'source-absent: {type(error).__name__}: {error}');return
    data,fixture,images=extract(source)
    if args.report:
        for name,prefab in data['prefabs'].items():
            for s in prefab['systems']:print(name,s['name'],s['layer'],s['sortingOrder'],s['canvasPosition'],s['adaptations'],'rate',s['rate'],'cap',s['capacity'],s.get('pivot'),s.get('flip'))
        return
    from PIL import Image
    for key,image in images.items():
        path=ROOT/'public'/data['textures'][key]['file'].lstrip('/')
        require(Image.open(path).convert('RGBA').tobytes()==image.tobytes(),'Published texture differs from the APK: '+key)
        data['textures'][key]['pngSha256']=sha(path.read_bytes())
    for path,value in [(ROOT/'src/data/advParticleEffects.json',data),(ROOT/'scripts/fixtures/adv-particle-effects-native.json',fixture)]:
        if args.write:path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf8')
        else:require(json.loads(path.read_text(encoding='utf8'))==value,f'ADV particle binding changed: {path.name}')
    print(json.dumps(dict(prefabs=len(data['prefabs']),systems=sum(len(p['systems']) for p in data['prefabs'].values()),textures=len(images))))
if __name__=='__main__':main()
