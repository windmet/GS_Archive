"""Replay actual stripped APK Mask bytes against the typed RAW field layout."""
import json,struct
from pathlib import Path
from types import SimpleNamespace
from live_chibi_native_particle_mask import native_mask_tree

data=json.loads((Path(__file__).parent/'fixtures/chibi-built-in-object-runtime.json').read_text(encoding='utf8'))
class Mask:
    def __init__(self,raw,tree=None,namespace='ToJ'):
        self.raw=raw;self.tree=tree;self.namespace=namespace
    def read_typetree(self,**kwargs):return self.tree or {'m_Name':''}
    def get_raw_data(self):return self.raw
    def read(self,**kwargs):return SimpleNamespace(m_Script=SimpleNamespace(read=lambda:SimpleNamespace(m_Namespace=self.namespace,m_ClassName='Mask')))

typed=data['typedMask']
decoded=native_mask_tree(Mask(bytes.fromhex(typed['rawHex'])))
for key,value in typed['tree'].items():
    if key not in ['m_GameObject','m_Enabled','m_Script','m_Name']:assert decoded[key]==value,key
assert native_mask_tree(Mask(b'',typed['tree']))==typed['tree']
for source in data['masks']:
    raw=bytes.fromhex(source['rawHex'])
    actual=native_mask_tree(Mask(raw))
    for key,value in actual.items():assert source['tree'][key]==value,key
    for broken in [raw[:-1],raw+b'\0',raw[:32]+struct.pack('<I',2)+raw[36:],raw[:80]+struct.pack('<i',1)]:
        try:native_mask_tree(Mask(broken));raise AssertionError('Invalid mask layout accepted')
        except ValueError:pass
    try:native_mask_tree(Mask(raw,namespace='Unrelated'));raise AssertionError('Wrong mask class accepted')
    except ValueError:pass
assert len(data['masks'])==2
print('Two actual APK alpha-mask byte layouts, typed RAW field-order witness and malformed/class guards passed')
