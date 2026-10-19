"""Native Backmonitor layout, retaining serialized RectTransform coordinates."""
import hashlib
import struct
from UnityPy.helpers.MeshHelper import MeshHandler


def backmonitor_geometry(environment):
    objects = {o.path_id: o for o in environment.objects if o.assets_file.name == 'resources.assets'}
    # Bound serialized fields, not a match on a GameObject/texture name.
    root_script = objects[135504].get_raw_data()
    movie_script = objects[110859].get_raw_data()
    controller = objects[125252].get_raw_data()
    assert len(root_script) == 108 and len(controller) == 104 and len(movie_script) == 44
    assert struct.unpack_from('<iq', root_script, 32) == (0, 110859) # _moviePrefab
    assert struct.unpack_from('<i', root_script, 44)[0] == 0 # _movies starts empty
    assert struct.unpack_from('<iq', root_script, 48) == (0, 7269) # _baseObj
    assert struct.unpack_from('<iq', movie_script, 32) == (0, 125252) # CriMana controller
    assert struct.unpack_from('<iq', controller, 88) == (0, 53127) # target renderer
    def transform(go_id):
        go = objects[go_id].read()
        return next(c.component.deref() for c in go.m_Component
                    if c.component.deref().type.name in ('Transform', 'RectTransform'))
    root, base, panel = [transform(pid) for pid in (23467, 7269, 8836)]
    rt, bt, pt = [o.read_typetree() for o in (root, base, panel)]
    assert root.type.name == 'Transform' and base.type.name == panel.type.name == 'RectTransform'
    assert bt['m_Father']['m_PathID'] == root.path_id
    assert rt['m_LocalPosition'] == {'x': 0, 'y': 0, 'z': 0}
    for t in (rt, bt, pt):
        assert t['m_LocalRotation'] == {'x': 0, 'y': 0, 'z': 0, 'w': 1}
    for t in (bt, pt):
        assert t['m_AnchorMin'] == t['m_AnchorMax'] == t['m_Pivot'] == {'x': .5, 'y': .5}
        assert t['m_SizeDelta'] == {'x': 1, 'y': 1}
    assert bt['m_LocalScale'] == {'x': 1, 'y': 1, 'z': 1}
    assert pt['m_AnchoredPosition'] == {'x': 0, 'y': 0}
    renderer = objects[53127].read()
    assert renderer.m_GameObject.path_id == 8836 and renderer.m_Sprite.path_id == 1734
    assert renderer.m_DrawMode == renderer.m_MaskInteraction == 0 and renderer.m_SortingOrder == 1000
    sprite = objects[1734].read()
    mesh = MeshHandler(sprite.m_RD, objects[1734].version)
    mesh.process()
    vertices = mesh.m_Vertices
    bounds = dict(xMin=min(v[0] for v in vertices), xMax=max(v[0] for v in vertices),
                  yMin=min(v[1] for v in vertices), yMax=max(v[1] for v in vertices))
    assert sprite.m_PixelsToUnits == 100 and sprite.m_Pivot.x == sprite.m_Pivot.y == .5
    # A centred anchor in a centred 1x1 parent has a zero reference offset.
    # Base's parent is a regular Transform, so its reference offset is zero too.
    # m_LocalPosition is the serialized Transform cache; the Rect layout owns XY.
    position = bt['m_AnchoredPosition']
    model = dict(originY=360, baseOffsetX=round(position['x'] * 100, 4),
                 baseOffsetY=round(position['y'] * 100, 4),
                 width=round((bounds['xMax']-bounds['xMin'])*pt['m_LocalScale']['x']*100, 4),
                 height=round((bounds['yMax']-bounds['yMin'])*pt['m_LocalScale']['y']*100, 4))
    assert model == dict(originY=360, baseOffsetX=0, baseOffsetY=135, width=520, height=270)
    return dict(model=model, source=dict(serializedFile='resources.assets',
        transforms=[dict(pathId=str(o.path_id), type=o.type.name,
                         sha256=hashlib.sha256(o.get_raw_data()).hexdigest(), tree=t)
                    for o,t in zip((root,base,panel),(rt,bt,pt))],
        rendererPathId='53127', spritePathId='1734', bounds=bounds,
        scripts=[dict(pathId=str(pid),sha256=hashlib.sha256(objects[pid].get_raw_data()).hexdigest())
                 for pid in (135504,110859,125252)],
        spriteSha256=hashlib.sha256(objects[1734].get_raw_data()).hexdigest()))
