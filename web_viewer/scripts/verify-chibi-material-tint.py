"""Non-default RAW tint is admitted only by consumers carrying the uniform."""
import copy,json
from pathlib import Path
from live_chibi_native_particle_mask import require_native_particle_mask
source=json.loads((Path(__file__).parent/'fixtures/chibi-object-emitters-native.json').read_text(encoding='utf8'))
obj=next(o for o in source['objects'] if o['asset']=='fx_in_mtples_panel_2')
count=0
for p in obj['particles']:
    mat=p['renderer']['materials'][0]
    tint=require_native_particle_mask(mat,allow_tint=True)
    if tint==[1,1,1,1]:assert require_native_particle_mask(mat)==tint;continue
    count+=1;assert tint==[2,2,2,1]
    try:require_native_particle_mask(mat);raise AssertionError('Legacy floor admitted HDR tint without consumption')
    except ValueError:pass
    for value in [-1,float('nan'),float('inf')]:
        bad=copy.deepcopy(mat);bad['colors']['_TintColor']['r']=value
        try:require_native_particle_mask(bad,allow_tint=True);raise AssertionError('Invalid tint admitted')
        except ValueError:pass
assert count==6
print('Six source material tints admitted by emitters; default-only legacy floor and invalid tint guards passed')
