"""Registration of UnityPy cropped Sprite PNGs to native Sprite vertices."""
import math

def sprite_geometry(sprite,width,height):
    from UnityPy.export.SpriteHelper import SpriteSettings
    from UnityPy.enums import SpritePackingMode
    from UnityPy.helpers.MeshHelper import MeshHandler
    settings=SpriteSettings(sprite.m_RD.settingsRaw)
    mesh=MeshHandler(sprite.m_RD,sprite.object_reader.version);mesh.process()
    if settings.packingMode==SpritePackingMode.kSPMTight and mesh.m_Vertices:
        vertices=mesh.m_Vertices
        xmin,xmax=min(v[0] for v in vertices),max(v[0] for v in vertices)
        ymin,ymax=min(v[1] for v in vertices),max(v[1] for v in vertices)
        ppu=sprite.m_PixelsToUnits
        if round((xmax-xmin)*ppu)!=width or round((ymax-ymin)*ppu)!=height:
            raise ValueError('Published Sprite PNG does not match native tight mesh bounds')
        return {'pivot':{'x':-xmin*ppu/width,'y':ymax*ppu/height},
            'bounds':{'xMin':xmin,'xMax':xmax,'yMin':ymin,'yMax':ymax},'kind':'native_tight_mesh_crop'}
    if settings.packed:
        raise ValueError('Packed rectangle registration unsupported')
    rd=sprite.m_RD;rect=sprite.m_Rect
    return {'pivot':{'x':(sprite.m_Pivot.x*rect.width-rd.textureRectOffset.x)/width,
        'y':1-(sprite.m_Pivot.y*rect.height-rd.textureRectOffset.y)/height},'kind':'native_rectangle_crop'}
