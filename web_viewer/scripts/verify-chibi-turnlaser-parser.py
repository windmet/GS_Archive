import copy
import json
from pathlib import Path
from live_chibi_turnlaser import turnlaser_model, streamed

root=Path(__file__).parent
fixture=json.loads((root/'fixtures/chibi-turnlaser-native.json').read_text(encoding='utf-8'))
expected=json.loads((root/'fixtures/chibi-turnlaser-model.json').read_text(encoding='utf-8'))
assert turnlaser_model(**fixture)==expected
reordered=copy.deepcopy(fixture)
for p in reordered['prefabs']:
    p['systems'].reverse();p['animators'].reverse()
assert turnlaser_model(**reordered)==expected
for mutate in (
    lambda f: f['root'].__setitem__('sha256','0'*64),
    lambda f: f['prefabs'][0]['animators'][0].__setitem__('particlePathId','1'),
    lambda f: f['prefabs'][0]['systems'][0]['transformChain'][1]['position'].__setitem__('x',1),
    lambda f: next(iter(f['animationEvidence'].values()))['clips'][0]['typetree']['m_ClipBindingConstant']['genericBindings'][0].__setitem__('path',1),
    lambda f: next(iter(f['animationEvidence'].values()))['typetree']['m_Controller']['m_StateMachineArray'][0]['data']['m_StateConstantArray'][0]['data'].__setitem__('m_TimeParamID',1),
):
    bad=copy.deepcopy(fixture);mutate(bad)
    try:turnlaser_model(**bad)
    except ValueError:pass
    else:raise AssertionError('Changed Animator/particle source accepted')
for model in expected['styles'].values():
    assert [s['mirrored'] for s in model['systems']]==[False,False,True,True]
    for s in model['systems']:
        angle=streamed.sample_curve(s['animation']['curve'],1.5)
        assert angle==(10 if s['animation']['clipPathId']=='1242' else 30)
print('PASS turn laser: native particle/Animator PPtrs, 10/30 degree witnesses, mirrored parent planes, unsupported controller rejection')
