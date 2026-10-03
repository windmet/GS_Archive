"""Native LiveObjectIdol -> SpriteRenderer / BoneFollower shadow binding."""
import hashlib
import struct

def require(ok, message):
    if not ok: raise ValueError(message)

def shadow_model(fixture):
    owner, follower, renderer, sprite = (fixture[k] for k in ('owner','follower','renderer','sprite'))
    raw = bytes.fromhex(owner['rawHex'])
    require(hashlib.sha256(raw).hexdigest() == owner['sha256'] and owner['class']=='LiveObjectIdol', 'Changed idol script')
    require(struct.unpack_from('<iq',raw,44)==(0,renderer['pathId'])
            and struct.unpack_from('<iq',raw,92)==(0,follower['pathId']), 'Wrong shadow binding')
    bone_raw=bytes.fromhex(follower['rawHex'])
    require(follower['class']=='BoneFollower' and struct.unpack_from('<i',bone_raw,44)[0]==6
            and bone_raw[48:54]==b'shadow', 'Wrong shadow follower bone')
    require(renderer['tree']['m_GameObject']==follower['gameObject']
            and renderer['tree']['m_Sprite']=={'m_FileID':0,'m_PathID':sprite['pathId']}, 'Wrong shadow sprite')
    s=sprite['tree']
    require(s['m_Name']=='tex_chara_shadow_2' and s['m_Rect']['width']==400
            and s['m_Rect']['height']==80 and s['m_PixelsToUnits']==100
            and s['m_Pivot']=={'x':.5,'y':.5} and sprite['texture']=={'m_FileID':0,'m_PathID':932}, 'Changed native shadow geometry')
    return {'status':'native_sprite_and_bone_follower', 'asset':s['m_Name'], 'bone':'shadow',
            'width':400, 'height':80, 'anchorX':.5, 'anchorY':.5,
            # All five native SkeletonDataAssets use 1/300; Sprite PPU is 100.
            'pixelsToSpineUnits':3, 'serializedFile':'resources.assets','texturePathId':'932',
            'spritePathId':str(sprite['pathId']), 'ownerPathId':str(owner['pathId']),
            'ownerSha256':owner['sha256'], 'followerPathId':str(follower['pathId'])}

def extract_character_shadow(environment):
    owner=next(o for o in environment.objects if o.assets_file.name=='resources.assets' and o.path_id==134600)
    raw=owner.get_raw_data(); value=owner.read(check_read=False)
    require(value.m_Script.read().m_ClassName=='LiveObjectIdol', 'Wrong native idol owner')
    renderer=owner.assets_file.objects[struct.unpack_from('<iq',raw,44)[1]]
    follower=owner.assets_file.objects[struct.unpack_from('<iq',raw,92)[1]]
    require(renderer.type.name=='SpriteRenderer' and follower.type.name=='MonoBehaviour','Wrong native shadow component')
    rv=renderer.read(); fv=follower.read(check_read=False); sp=rv.m_Sprite.deref(); st=sp.read_typetree()
    fixture={'owner':{'pathId':owner.path_id,'class':value.m_Script.read().m_ClassName,
                       'rawHex':raw.hex(),'sha256':hashlib.sha256(raw).hexdigest()},
             'follower':{'pathId':follower.path_id,'class':fv.m_Script.read().m_ClassName,
                         'rawHex':follower.get_raw_data().hex(),
                         'gameObject':{'m_FileID':fv.m_GameObject.m_FileID,'m_PathID':fv.m_GameObject.m_PathID}},
             'renderer':{'pathId':renderer.path_id,'tree':renderer.read_typetree()},
             'sprite':{'pathId':sp.path_id,'tree':{k:st[k] for k in ('m_Name','m_Rect','m_Pivot','m_PixelsToUnits')},'texture':st['m_RD']['texture']}}
    return shadow_model(fixture),fixture
