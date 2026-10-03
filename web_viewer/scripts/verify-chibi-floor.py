import copy
import importlib.util
import json
from pathlib import Path
base=Path(__file__).parent
spec=importlib.util.spec_from_file_location('floor',base/'prepare-live-chibi-floor.py')
floor=importlib.util.module_from_spec(spec);spec.loader.exec_module(floor)
e=json.loads((base/'fixtures/chibi-floor-inputs.json').read_text(encoding='utf8'))
m=json.loads((base/'fixtures/chibi-floor-model.json').read_text(encoding='utf8'))
assert [floor.floor_system(p) for p in e['object']['particles']]==m['systems']
for mutate in [lambda p:p['renderer'].update(alignment=0),
               lambda p:p['modules'].update(VelocityModule={'enabled':True}),
               lambda p:p['modules']['InitialModule']['startLifetime'].update(minMaxState=2),
               lambda p:p['renderer']['materials'][0]['textures'][0].update(pathId='wrong')]:
 p=copy.deepcopy(e['object']['particles'][0]);mutate(p)
 try:floor.floor_system(p)
 except ValueError:pass
 else:raise AssertionError('Unsupported floor source accepted')
print('Four typed native floor emitters, gradient keys, mask material and changed-source rejection passed')
spec=importlib.util.spec_from_file_location('catalog',base/'prepare-live-chibi-floor-catalog.py')
catalog=importlib.util.module_from_spec(spec);spec.loader.exec_module(catalog)
native=json.loads((base/'fixtures/chibi-floor-box-inputs.json').read_text(encoding='utf8'))
published=json.loads((base/'fixtures/chibi-floor-catalog.json').read_text(encoding='utf8'))
expected=published['assets'][native['asset']]
parsed=[catalog.system(p) for p in native['particles']]
assert [s for s,_ in parsed]==expected['systems']
assert {id for _,id in parsed}=={expected['mask']['texture']}
for change in [lambda p:p['modules']['InitialModule']['startSpeed'].update(scalar=1),
               lambda p:p['modules']['ShapeModule'].update(type=0),
               lambda p:p['modules']['EmissionModule'].update(m_Bursts=[{}]),
               lambda p:p['modules'].update(NoiseModule={}),
               lambda p:p['modules']['UVModule']['startFrame'].update(minMaxState=3)]:
    p=copy.deepcopy(native['particles'][0]);change(p)
    try:catalog.system(p)
    except ValueError:pass
    else:raise AssertionError('Unimplemented source semantics entered general box profile')
print('Independent floor source fixture matches catalog; velocity, sphere, burst, noise and random-UV guards passed')
