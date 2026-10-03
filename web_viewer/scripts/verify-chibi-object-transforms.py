"""Native Y half-turns must reflect X, never invert the beam vertically."""
import importlib.util
import json
import math
from pathlib import Path
from types import SimpleNamespace as NS

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('objects', root/'scripts/live_chibi_object_transform.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def transform(row):
    return NS(m_LocalRotation=NS(**row['rotation']), m_LocalScale=NS(**row['scale']),
              m_LocalPosition=NS(**row['position']))

def projected_chain(chain):
    result = (1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)
    for row in reversed(chain[:-1]):
        matrix = module.local_matrix(transform(row))
        result = tuple(sum(result[r*4+k]*matrix[k*4+c] for k in range(4))
                       for r in range(4) for c in range(4))
    return result[0],result[4],result[1],result[5],result[3],result[7]

fixture = json.loads((root/'scripts/fixtures/chibi-object-light-transforms.json').read_text())
for entry in fixture:
    for renderer in entry['renderers']:
        matrix = projected_chain(renderer['chain'])
        expected = (-1,0,0,1,0,0) if (entry['asset'].endswith(('_4','_5'))
                    and not renderer['name'].endswith('_under')) else (1,0,0,1,0,0)
        assert matrix == expected, (entry['asset'], renderer['name'], matrix)
        decomposed = module.decompose(matrix)
        angle = math.radians(decomposed['rotation'])
        skew = math.radians(decomposed['skewX'])
        # Reconstruct Pixi y-down linear transform; its Y basis must stay down.
        actual = (math.cos(angle)*decomposed['scaleX'],math.sin(angle)*decomposed['scaleX'],
                  -math.sin(angle-skew)*decomposed['scaleY'],math.cos(angle-skew)*decomposed['scaleY'])
        for value,want in zip(actual,(matrix[0],-matrix[1],-matrix[2],matrix[3])):
            assert abs(value-want)<1e-6, (actual,matrix)

# Tilt and translated child must compose through Z before projection.
tilt = transform({'rotation':{'x':0,'y':math.sin(math.pi/4),'z':0,'w':math.cos(math.pi/4)},
                  'scale':dict(x=1,y=1,z=1),'position':dict(x=0,y=0,z=0)})
m = module.local_matrix(tilt)
assert abs(m[0])<1e-12 and abs(m[2]-1)<1e-12
assert abs(m[8]+1)<1e-12
print('PASS native object light quaternion hierarchy, horizontal reflection and Pixi affine reconstruction')
