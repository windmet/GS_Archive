import copy,json
from pathlib import Path
from live_chibi_old_suspension import old_suspension_model
p=Path(__file__).with_name('fixtures')
source=json.loads((p/'chibi-old-suspension-native.json').read_text())
expected=json.loads((p/'chibi-old-suspension-model.json').read_text())
assert old_suspension_model(source['prefabs'],source['controllers'])==expected
for mutation in ('pointer','pivot','rotation','duration'):
    bad=copy.deepcopy(source)
    root=bad['prefabs'][0]
    if mutation=='pointer':
        c=next(c for c in root['components'] if c.get('scriptClass'))
        c['rawHex']='00'+c['rawHex'][2:-2]+'01'
    elif mutation=='duration':
        next(iter(bad['controllers'].values()))['clips'][0]['typetree']['m_MuscleClip']['m_StopTime']=3
    else:
        c=root['children'][0]['children'][0]['children'][0]['components']
        if mutation=='pivot':next(x for x in c if x['type']=='SpriteRenderer')['sprite']['pivot']['y']=.5
        else:next(x for x in root['children'][0]['children'][0]['components'] if x['type']=='Transform')['rotation']['z']=0
    try:old_suspension_model(bad['prefabs'],bad['controllers'])
    except ValueError:pass
    else:raise AssertionError('Changed native binding accepted: '+mutation)
print('PASS old sidelight native sprite, pivot, base and two streamed Animator bindings')
