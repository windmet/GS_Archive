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
