import copy,json
from pathlib import Path
from live_chibi_character_shadow import shadow_model
root=Path(__file__).parent/'fixtures'
f=json.loads((root/'chibi-character-shadow-native.json').read_text(encoding='utf-8'))
assert shadow_model(f)==json.loads((root/'chibi-character-shadow-model.json').read_text(encoding='utf-8'))
for change in (
 lambda f:f['follower'].__setitem__('pathId',0),
 lambda f:f['sprite']['tree'].__setitem__('m_PixelsToUnits',200),
 lambda f:f['sprite'].__setitem__('texture',{'m_FileID':0,'m_PathID':885}),
 lambda f:f['owner'].__setitem__('sha256','0'*64),
):
 bad=copy.deepcopy(f);change(bad)
 try:shadow_model(bad)
 except ValueError:pass
 else:raise AssertionError('Wrong native shadow binding accepted')
print('PASS native shadow: idol PPtrs, follower bone, sprite identity, size and unit conversion')
