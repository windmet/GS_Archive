"""Regression for typo names, streamed textures and broken Unity pointers."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('audit', Path(__file__).with_name('audit-ssr-dynamic-completeness.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def ptr(oid, file=0):
    return {'m_FileID': file, 'm_PathID': oid}


def fixture():
    trees = {
        1: ('MonoScript', {'m_ClassName': 'SkeletonAnimation'}),
        2: ('MonoScript', {'m_ClassName': 'SkeletonDataAsset'}),
        3: ('MonoScript', {'m_ClassName': 'SpineAtlasAsset'}),
        4: ('MonoBehaviour', {'m_Script': ptr(1), 'skeletonDataAsset': ptr(5)}),
        5: ('MonoBehaviour', {'m_Script': ptr(2), 'skeletonJSON': ptr(7), 'atlasAssets': [ptr(6)]}),
        6: ('MonoBehaviour', {'m_Script': ptr(3), 'atlasFile': ptr(8), 'materials': [ptr(9)]}),
        7: ('TextAsset', {'m_Name': 'card_02jun_ssr02p.skel', 'm_Script': b'skeleton fixture'}),
        8: ('TextAsset', {'m_Name': 'card_02jun_ssr02p.atlas', 'm_Script': '\ncard_02jun_ssr02p.png\nsize: 2,2\n'}),
        9: ('Material', {'m_SavedProperties': {'m_TexEnvs': [['_MainTex', {'m_Texture': ptr(10)}]]}}),
        10: ('Texture2D', {'m_Name': 'card_02jun_ssr02p', 'm_Width': 2, 'm_Height': 2,
                           'image_data': b'', 'get_image_data': lambda: b'streamed texture fixture'}),
    }
    objects = [SimpleNamespace(path_id=oid, type=SimpleNamespace(name=kind),
                               read_typetree=lambda t=tree: t, read=lambda t=tree: SimpleNamespace(**t))
               for oid, (kind, tree) in trees.items()]
    return trees, lambda _: SimpleNamespace(objects=objects)


trees, load = fixture()
result = audit.inspect_bundle(Path('card_021jun_ssr02.unity3d'), load)
assert result['status'] == 'source-chain-verified'
assert result['chains'][0]['skeleton']['name'] == 'card_02jun_ssr02p.skel'
assert result['chains'][0]['atlases'][0]['textures'][0]['encoded_bytes'] > 0
for broken in [ptr(999), ptr(10, file=1)]:
    trees, load = fixture()
    trees[9][1]['m_SavedProperties']['m_TexEnvs'][0][1]['m_Texture'] = broken
    assert audit.inspect_bundle(Path('test'), load)['status'] == 'unresolved'
trees, load = fixture()
trees[8][1]['m_Script'] = '\nwrong-page.png\nsize: 2,2\n'
assert audit.inspect_bundle(Path('test'), load)['status'] == 'unresolved'
trees, load = fixture()
trees[7][1]['m_Script'] = b''
assert audit.inspect_bundle(Path('test'), load)['status'] == 'unresolved'
print('SSR completeness: internal-name mismatch, streamed bytes, broken/external references, atlas mismatch and empty skeleton passed')
