"""Check stripped APK keeper decoding against retained source bytes."""
import json,struct
from pathlib import Path
from types import SimpleNamespace
from live_chibi_object_keeper import object_keeper_tree
class Source:
    def __init__(self,raw,classname='LiveObjectObjectLayer',tree=None):
        self.raw=raw;self.classname=classname;self.tree=tree
    def read_typetree(self,**kwargs):return dict(self.tree or {'m_Name':''})
    def get_raw_data(self):return self.raw
    def read(self,**kwargs):
        return SimpleNamespace(m_Script=SimpleNamespace(read=lambda:SimpleNamespace(
            m_ClassName=self.classname,m_Namespace='Growing.Live',m_AssemblyName='Assembly-CSharp.dll')))
fixture=json.loads((Path(__file__).parent/'fixtures/chibi-built-in-object-sources.json').read_text(encoding='utf8'))
for row in fixture['located'].values():
    raw=bytes.fromhex(row['keeperRawHex'])
    actual=object_keeper_tree(Source(raw,row['scriptClass']))
    assert {k:actual[k] for k in row['fields']}==row['fields']
    for bad in [raw[:20],raw[:-1],raw+b'\0',raw[:32]+struct.pack('<i',-1)+raw[36:]]:
        try:object_keeper_tree(Source(bad));raise AssertionError('Malformed keeper accepted')
        except ValueError:pass
    try:object_keeper_tree(Source(raw,'UnrelatedClass'));raise AssertionError('Unknown class accepted')
    except ValueError:pass
typed={'_particles':[],'_sprites':[],'_groups':[],'_keepOriginalOrder':True}
assert object_keeper_tree(Source(b'',tree=typed))==typed
print('Four actual APK keeper byte layouts, typed RAW passthrough, truncated/count/tail/class guards passed')
