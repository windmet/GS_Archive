"""Native rotating backmonitor logo; runtime activation is reference-bounded."""
import hashlib
import struct
import zlib
from live_chibi_turnlaser import streamed
from live_chibi_laser import require

def logo_model(source):
    raw=bytes.fromhex(source['rawHex'])
    require(len(raw)==80 and hashlib.sha256(raw).hexdigest()==source['sha256'], 'Changed RotateSprite fields')
    require(struct.unpack_from('<iq',raw,32)==(0,1832) and struct.unpack_from('<iq',raw,44)==(0,104), 'Changed logo Sprite/material pointers')
    require(struct.unpack_from('<6f',raw,56)==(1,1,1,0,0,10), 'Changed logo color/angle/perspective')
    sprite=source['sprite']
    require(sprite['name']=='live_backmonitor_movie_logo_m' and sprite['texturePathId']=='463'
            and sprite['rect']=={'x':0,'y':0,'width':1200,'height':800}
            and sprite['pivot']=={'x':.5,'y':.5} and sprite['pixelsToUnits']==100, 'Changed native logo geometry')
    require(source['transform']['position']=={'x':0,'y':0,'z':0}
            and source['transform']['rotation']=={'x':0,'y':0,'z':0,'w':1}
            and source['transform']['scale']=={'x':0.3499999940395355,'y':0.3499999940395355,'z':1}, 'Changed logo transform')
    require(source['shader']=='Growing/RotateSprite' and source['sortingOrder']==1005, 'Changed logo renderer')
    tree=source['clip']['typetree'];muscle=tree['m_MuscleClip'];data=muscle['m_Clip']['data']
    binding=tree['m_ClipBindingConstant']
    require(binding=={'genericBindings':[{'path':0,'attribute':zlib.crc32(b'_rotateAngle'),
            'script':{'m_FileID':1,'m_PathID':2622},'typeID':114,'customType':0,'isPPtrCurve':0}],
            'pptrCurveMapping':[]}, 'Changed RotateSprite animated field')
    require(tree['m_Name']=='RotateSpriteAnim' and muscle['m_StartTime']==0 and muscle['m_StopTime']==2 and muscle['m_LoopTime']
            and data['m_StreamedClip']['curveCount']==1 and not data['m_DenseClip']['m_CurveCount']
            and not data['m_ConstantClip']['data'], 'Changed logo animation format')
    curves,evidence=streamed.decode_stream(data['m_StreamedClip']['data'],1)
    curve=curves[0]
    require(curve=={'index':0,'initialValue':0,'keys':[{'time':0,'coefficients':[0,0,180,0]},
            {'time':2,'coefficients':[0,0,0,360]}]}, 'Changed logo rotation curve')
    return {'status':'native_sprite_curve_reference_activation_projective_mesh',
            'width':1200,'height':800,'localScale':source['transform']['scale']['x'],
            'perspectiveAngle':10,'duration':2,'curve':curve,'clipSource':source['clip']['sha256'],
            'streamSha256':evidence['sha256'],'layers':[{'asset':sprite['name']}],
            'previewSongs':['tkstp1','tkstp2'],'previewMovie':'live_backmonitor_movie_trhorz_01'}

def extract_logo_source(environment):
    objects={o.path_id:o for o in environment.objects if o.assets_file.name=='resources.assets'}
    script=objects[132450];sprite=objects[1832].read();transform=objects[44407].read()
    clip=objects[1077];material=objects[104].read();renderer=objects[45611].read()
    vec=lambda v,keys:{k:getattr(v,k) for k in keys}
    return {'rawHex':script.get_raw_data().hex(),'sha256':hashlib.sha256(script.get_raw_data()).hexdigest(),
            'sprite':{'name':sprite.m_Name,'texturePathId':str(sprite.m_RD.texture.path_id),
                'rect':vec(sprite.m_Rect,('x','y','width','height')),'pivot':vec(sprite.m_Pivot,('x','y')),
                'pixelsToUnits':sprite.m_PixelsToUnits},
            'transform':{'position':vec(transform.m_LocalPosition,('x','y','z')),
                'rotation':vec(transform.m_LocalRotation,('x','y','z','w')),'scale':vec(transform.m_LocalScale,('x','y','z'))},
            'shader':material.m_Shader.read().m_ParsedForm.m_Name,'sortingOrder':renderer.m_SortingOrder,
            'clip':{'pathId':str(clip.path_id),'sha256':hashlib.sha256(clip.get_raw_data()).hexdigest(),'typetree':clip.read_typetree()}}
