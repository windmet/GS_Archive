"""Follow LiveStage's serialized idol slots, not similarly named prefabs."""
import hashlib
import json
import struct
from pathlib import Path
import UnityPy


def character_geometry(environment, raw_assets, skeleton_fixture):
    objects = {o.path_id: o for o in environment.objects if o.assets_file.name == 'resources.assets'}
    stage = objects[114160]
    raw = stage.get_raw_data()
    assert stage.read(check_read=False).m_Script.read().m_ClassName == 'LiveStage'
    assert struct.unpack_from('<iq', raw, 32) == (0, 10178)
    assert struct.unpack_from('<i', raw, 44)[0] == 6

    def transform(go_id):
        go = objects[go_id].read()
        return next(c.component.deref() for c in go.m_Component
                    if c.component.deref().type.name == 'Transform')

    stage_transform = transform(stage.read(check_read=False).m_GameObject.path_id)
    base = transform(10178)
    bt = base.read_typetree()
    assert bt['m_Father']['m_PathID'] == stage_transform.path_id
    assert bt['m_LocalPosition'] == dict(x=0, y=0, z=10)
    assert bt['m_LocalScale'] == dict(x=1, y=1, z=1)
    slots = []
    for index in range(6):
        file_id, script_id = struct.unpack_from('<iq', raw, 48 + 12 * index)
        assert file_id == 0
        script = objects[script_id]
        value = script.read(check_read=False)
        assert value.m_Script.read().m_ClassName == 'LiveObjectIdol'
        node = transform(value.m_GameObject.path_id)
        tree = node.read_typetree()
        assert tree['m_Father']['m_PathID'] == base.path_id
        assert tree['m_LocalRotation'] == dict(x=0, y=0, z=0, w=1)
        assert tree['m_LocalScale'] == dict(x=0.7149999737739563, y=0.7149999737739563, z=1)
        slots.append(dict(slot=index, scriptPathId=str(script_id), transformPathId=str(node.path_id),
                          scriptSha256=hashlib.sha256(script.get_raw_data()).hexdigest(),
                          transformSha256=hashlib.sha256(node.get_raw_data()).hexdigest(), tree=tree))
    bodies = []
    for binding in skeleton_fixture['bodies']:
        bundle = raw_assets / binding['bundle']
        assert hashlib.sha256(bundle.read_bytes()).hexdigest() == binding['bundleSha256']
        env = UnityPy.load(str(bundle))
        asset = next(o for o in env.objects if str(o.path_id) == binding['assetPathId'])
        assert hashlib.sha256(asset.get_raw_data()).hexdigest() == binding['assetSha256']
        tree = asset.read_typetree()
        assert tree['scale'] == binding['scale']
        assert tree['defaultMix'] == 0 and tree['fromAnimation'] == tree['toAnimation'] == tree['duration'] == []
        assert tree['skeletonJSON']['m_PathID'] == int(binding['skeletonPathId'])
        bodies.append(dict(bodyType=binding['bodyType'], scale=tree['scale'], defaultMix=tree['defaultMix'],
                           assetSha256=binding['assetSha256'], bundleSha256=binding['bundleSha256']))
    return dict(model=dict(originY=360, pixelsPerUnityUnit=100,
                           idolRootScale=slots[0]['tree']['m_LocalScale']['x'],
                           skeletonScales={str(b['bodyType']): b['scale'] for b in bodies}),
                source=dict(stagePathId=str(stage.path_id), stageSha256=hashlib.sha256(raw).hexdigest(),
                            basePathId=str(base.path_id), baseSha256=hashlib.sha256(base.get_raw_data()).hexdigest(),
                            baseTree=bt, slots=slots, bodies=bodies))
