import os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from UnityPy import load as load_bundle

bundle_path = 'E:/BaiduNetdiskDownload/SideM/GS_Res/新建文件夹/RAW/asset/adv_background_bg092_315proext_out_01.unity3d'
print(f'Loading: {bundle_path} ({os.path.getsize(bundle_path)} bytes)')

env = load_bundle(bundle_path)
for assetsfile in env.assets:
    for path_id, obj in assetsfile.objects.items():
        try:
            data = obj.read()
            tn = obj.type.name
            print(f'\nPathID {path_id}: type={tn}')

            if tn == 'GameObject':
                print(f'  Name: {data.m_Name}')
            elif tn == 'Transform':
                print(f'  Pos: {getattr(data, "m_LocalPosition", "?")}')
            elif tn in ('ParticleSystem',):
                print(f'  *** PARTICLE SYSTEM ***')
                for key in data.__dict__:
                    if not key.startswith('_'):
                        v = str(data.__dict__[key])[:300]
                        print(f'  [{key}] = {v}')
            elif tn == 'ParticleSystemRenderer':
                print(f'  *** RENDERER ***')
                print(f'  RenderMode: {data.m_RenderMode}')
                print(f'  SortingOrder: {data.m_SortingOrder}')
                print(f'  Materials: {data.m_Materials}')
            elif tn == 'Mesh':
                print(f'  Vertices: {len(getattr(data, "m_Vertices", "") or [])}')
                print(f'  Tris: {len(getattr(data, "m_Indices", "") or [])}')
            elif tn == 'Material':
                print(f'  Name: {data.m_Name}')
                print(f'  Shader: {data.m_Shader}')
            elif tn == 'Shader':
                print(f'  Name: {data.m_ParsedForm.m_Name}')
            elif tn == 'Texture2D':
                print(f'  Size: {data.m_Width}x{data.m_Height} Format:{data.m_TextureFormat}')
        except Exception as e:
            print(f'PathID {path_id}: {obj.type.name} ERROR: {e}')
