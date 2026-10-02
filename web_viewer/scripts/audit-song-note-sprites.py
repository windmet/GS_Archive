#!/usr/bin/env python3
"""Audit and decode only native rhythm-note sprites from an explicitly named IPA.

Does not infer a default skin, original mesh dimensions or gameplay materials.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys
import zipfile

import UnityPy

ROOT=Path(__file__).resolve().parents[1]
MEMBER='Payload/BNEI0395.app/Data/data.unity3d'
PREFIX='live_notes_'
NOTE_ATLASES={'Note1SpriteAtlas','Note2SpriteAtlas','Note3SpriteAtlas','HoldSpriteAtlas','LiveSpriteAtlas'}

def sha(data): return hashlib.sha256(data).hexdigest()
def json_bytes(value): return (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode('utf-8')

def audit(ipa, metadata, output, audit_path, check=False):
    with zipfile.ZipFile(ipa) as archive: binary=archive.read(MEMBER)
    environment=UnityPy.load(binary)
    objects={obj.path_id:obj for obj in environment.objects if obj.assets_file.name=='resources.assets'}
    source={'package':ipa.name,'member':MEMBER,'dataSha256':sha(binary),'dataBytes':len(binary),
            'metadataSha256':sha(metadata.read_bytes()),'unityVersion':str(next(iter(objects.values())).assets_file.unity_version)}
    atlas_trees={}
    for obj in objects.values():
        if obj.type.name=='SpriteAtlas':
            tree=obj.read_typetree()
            if tree['m_Name'] in NOTE_ATLASES: atlas_trees[obj.path_id]=tree
    sprites=[]; pending={}; texture_ids=set()
    for obj in objects.values():
        if obj.type.name!='Sprite':continue
        sprite=obj.read()
        if not sprite.m_Name.startswith(PREFIX):continue
        tree=obj.read_typetree(); atlas_id=tree['m_SpriteAtlas']['m_PathID']
        if atlas_id not in atlas_trees:raise ValueError(f'Unknown atlas for sprite {obj.path_id}')
        atlas=atlas_trees[atlas_id]
        matches=[render for key,render in atlas['m_RenderDataMap'] if key==tree['m_RenderDataKey']]
        if len(matches)!=1:raise ValueError(f'Ambiguous render key for sprite {obj.path_id}')
        render=matches[0]; texture_id=render['texture']['m_PathID']; texture=objects[texture_id].read()
        texture_ids.add(texture_id)
        image=sprite.image.convert('RGBA')
        # UnityPy resolves atlas packing/rotation and reconstructs the sprite;
        # cropping an atlas by name alone would not be equivalent.
        filename=f"{atlas['m_Name']}/{sprite.m_Name}.png"
        if filename in pending:raise ValueError(f'Duplicate sprite role in atlas: {filename}')
        import io
        buffer=io.BytesIO(); image.save(buffer,format='PNG',optimize=True); data=buffer.getvalue()
        pending[filename]=data
        sprites.append({'name':sprite.m_Name,'assetFile':'resources.assets','spritePathId':obj.path_id,
            'atlas':atlas['m_Name'],'atlasPathId':atlas_id,'texturePathId':texture_id,
            'textureName':texture.m_Name,'textureSize':[texture.m_Width,texture.m_Height],
            'textureFormat':int(texture.m_TextureFormat),'renderDataKey':tree['m_RenderDataKey'],
            'sourceRect':tree['m_Rect'],'packedTextureRect':render['textureRect'],
            'packingSettingsRaw':render['settingsRaw'],'pivot':tree['m_Pivot'],'border':tree['m_Border'],
            'file':filename,'width':image.width,'height':image.height,'alphaRange':list(image.getchannel('A').getextrema()),
            'visibleAlphaBounds':list(image.getchannel('A').getbbox()) if image.getchannel('A').getbbox() else None,
            'pngSha256':sha(data),'pixelSha256':sha(image.tobytes()),'bytes':len(data)})
    sprites.sort(key=lambda s:(s['atlas'],s['name']))
    if len(sprites)!=29:raise ValueError(f'Expected 29 native live_notes sprites, got {len(sprites)}')
    # Inspect stripped component headers without pretending that runtime fields
    # have been recovered from Unity's absent custom TypeTrees.
    settings=[]; materials=[]
    for obj in objects.values():
        if obj.type.name=='MonoBehaviour':
            header=obj.read(check_read=False)
            if header.m_Script.m_PathID==0:continue
            if header.m_Script.read().m_ClassName!='RhythmIconListItem':continue
            raw=obj.get_raw_data()
            if len(raw)!=92:raise ValueError('Unexpected RhythmIconListItem payload layout')
            pointers=[]
            for offset,role in zip(range(32,92,12),['_toggle','_notesNormalImage','_notesSwipeUpImage','_notesSwipeLeftImage','_notesSwipeRightImage']):
                file_id,path_id=struct.unpack_from('<iq',raw,offset)
                if file_id!=0:raise ValueError('External settings pointer requires another adapter')
                image_obj=objects[path_id]; image_header=image_obj.read(check_read=False)
                image_raw=image_obj.get_raw_data(); candidates=[]
                for i in range(32,len(image_raw)-11,4):
                    fid,pid=struct.unpack_from('<iq',image_raw,i)
                    hit=next((s for s in sprites if s['spritePathId']==pid),None)
                    if fid==0 and hit:candidates.append({'offset':i,'spritePathId':pid,'atlas':hit['atlas'],'name':hit['name']})
                pointers.append({'role':role,'pointerOffset':offset,'componentPathId':path_id,
                    'componentClass':image_header.m_Script.read().m_ClassName,'spritePointerCandidates':candidates})
            settings.append({'pathId':obj.path_id,'gameObjectName':header.m_GameObject.read().m_Name,
                'rawSha256':sha(raw),'bytes':len(raw),'pointers':pointers,
                'boundary':'field roles inferred from native declaration order; sprite reference offsets checked in raw bytes; runtime skin assignment unverified'})
        elif obj.type.name=='Material':
            tree=obj.read_typetree()
            for name,entry in tree.get('m_SavedProperties',{}).get('m_TexEnvs',[]):
                if entry['m_Texture']['m_FileID']==0 and entry['m_Texture']['m_PathID'] in texture_ids:
                    materials.append({'pathId':obj.path_id,'name':tree['m_Name'],'property':name,'texturePathId':entry['m_Texture']['m_PathID']})
    sys.path.insert(0,str(ROOT.parent/'data_pipeline'))
    import extract_il2cpp_protobuf_schema as native
    native_bytes=metadata.read_bytes()
    _,sections=native.parse_header(native_bytes)
    strings=native.build_string_reader(native_bytes,sections['string'])
    types=native.read_records(native_bytes,sections['type_definitions'],native.TYPE_DEFINITION_FORMAT)
    fields=native.read_records(native_bytes,sections['fields'],native.FIELD_DEFINITION_FORMAT)
    candidates=[(i,t) for i,t in enumerate(types) if strings(t[0])=='RhythmIconListItem']
    if len(candidates)!=1:raise ValueError('Ambiguous native settings class')
    number,t=candidates[0]
    declared=[{'fieldIndex':k,'name':strings(fields[k][0]),'typeIndex':fields[k][1]} for k in range(t[8],t[8]+t[18])]
    if [f['name'] for f in declared[:5]]!=[p['role'] for p in settings[0]['pointers']]:raise ValueError('Native settings declaration changed')
    result={'schemaVersion':1,'kind':'native-song-chart-sprite-audit','checkedOn':'2026-10-01','source':source,
        'nativeSettingsClass':{'typeDefinitionIndex':number,'name':'RhythmIconListItem','fields':declared},
        'sprites':sprites,'settingPreviewReferences':sorted(settings,key=lambda s:s['pathId']),
        'serializedAtlasMaterialReferences':materials,
        'boundaries':{'runtimeDefaultSkin':'unverified','settingItemNumberToAtlas':'unverified',
          'eventTypeToSpecialSprite':'unverified','meshSizeAndPerspective':'unverified',
          'shaderAndTint':'unverified','holdUvMapping':'unverified','currentPreviewUsesNativeSprites':False}}
    if check:
        if json.loads(audit_path.read_bytes())!=json.loads(json_bytes(result)):raise ValueError('Native sprite audit drift')
        for filename,data in pending.items():
            if (output/filename).read_bytes()!=data:raise ValueError(f'Native PNG differs: {filename}')
    else:
        for filename,data in pending.items():
            target=output/filename; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(data)
        audit_path.parent.mkdir(parents=True,exist_ok=True); audit_path.write_bytes(json_bytes(result))
    print(f"Native note sprites {'verified' if check else 'audited'}: {len(sprites)} sprites, {len(settings)} settings items, {sum(map(len,pending.values()))} PNG bytes")
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ipa',type=Path,required=True)
    parser.add_argument('--metadata',type=Path,default=ROOT/'.analysis/sidem_ios_keyfiles/global-metadata.dat')
    parser.add_argument('--output-root',type=Path,default=ROOT/'public/assets/song-chart-sprites')
    parser.add_argument('--audit',type=Path,default=ROOT/'config/song-chart-sprite-audit.v1.json')
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    audit(args.ipa,args.metadata,args.output_root,args.audit,args.check)
