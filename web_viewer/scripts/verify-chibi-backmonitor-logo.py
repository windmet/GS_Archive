import copy,json
from pathlib import Path
from live_chibi_backmonitor_logo import logo_model
source=json.loads(Path(__file__).with_name('fixtures').joinpath('chibi-backmonitor-logo-native.json').read_text(encoding='utf-8'))
model=logo_model(source)
assert model['duration']==2 and model['curve']['keys'][0]['coefficients'][2]==180
for change in ('pointer','perspective','pivot','shader','binding','curve'):
    bad=copy.deepcopy(source)
    if change in ('pointer','perspective'):
        offset=32 if change=='pointer' else 76
        data=bytearray.fromhex(bad['rawHex']);data[offset]^=1;bad['rawHex']=data.hex()
        import hashlib
        bad['sha256']=hashlib.sha256(data).hexdigest()
    elif change=='pivot':bad['sprite']['pivot']['x']=0
    elif change=='shader':bad['shader']='Wrong'
    elif change=='binding':bad['clip']['typetree']['m_ClipBindingConstant']['genericBindings'][0]['attribute']=0
    else:bad['clip']['typetree']['m_MuscleClip']['m_Clip']['data']['m_StreamedClip']['data'][12]=0
    try:logo_model(bad)
    except ValueError:pass
    else:raise AssertionError('Changed native logo accepted: '+change)
print('PASS native logo pointers, pivot, material, perspective and script-field streamed curve guards')
