import os, sys, json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from UnityPy import load as load_bundle

# Try the RAW path (seems to be the primary one)
targets = [
    'E:/BaiduNetdiskDownload/SideM/RAW/asset/fx_adv_2212christmas.unity3d',
    'E:/BaiduNetdiskDownload/SideM/GS_Res/新建文件夹/RAW/asset/fx_adv_2212christmas.unity3d',
    'E:/BaiduNetdiskDownload/SideM/GS_Res/ALL_PHOTOS/assets/resources/advbackground/effects/resources/fx_adv_2212christmas.unity3d',
]

for bundle_path in targets:
    if os.path.exists(bundle_path):
        print(f'\n\n===== Loading: {bundle_path} ({os.path.getsize(bundle_path)} bytes) =====')
        try:
            env = load_bundle(bundle_path)
            print(f'Containers: {list(env.container.keys())}')

            for path, obj in env.container.items():
                print(f'\n--- {path} ({obj.type.name}) ---')

                if obj.type.name in ('GameObject', 'PrefabInstance'):
                    data = obj.read()
                    print(f'  Name: {getattr(data, "m_Name", "N/A")}')
                    if hasattr(data, 'm_Component'):
                        for comp in data.m_Component:
                            print(f'  Comp: {comp}')
                    if hasattr(data, 'm_Components'):
                        for comp in data.m_Components:
                            try:
                                cdata = comp.read()
                                print(f'  C: {comp.type.name} -> {type(cdata).__name__} {getattr(cdata, "m_Name", "")}')
                            except:
                                print(f'  C: {comp.type.name} (unreadable)')
                    # Dump all readable fields
                    blacklist = set(dir(data)) & set(dir(None)) - set(data.__dict__.keys())
                    for key, val in data.__dict__.items():
                        if not key.startswith('_') and key not in ('m_Component', 'm_Components'):
                            print(f'  [{key}] = {str(val)[:200]}')

                elif obj.type.name == 'Texture2D':
                    data = obj.read()
                    print(f'  Name: {data.m_Name}')
                    print(f'  Size: {data.m_Width}x{data.m_Height}')
                    print(f'  Format: {data.m_TextureFormat}')
                    # Save the texture
                    try:
                        img = data.image
                        outpath = os.path.join('E:/Web_build/SideM_Archived/web_viewer/public/data/fx_extracted', f'unity_{data.m_Name}.png')
                        img.save(outpath)
                        print(f'  Saved to: {outpath}')
                    except Exception as e:
                        print(f'  Image save error: {e}')

                elif obj.type.name == 'Shader':
                    data = obj.read()
                    print(f'  Name: {data.m_ParsedForm.m_Name}')
                    lab = data.m_ParsedForm.m_ShaderLab
                    if lab:
                        print(f'  ShaderLab ({len(lab)} bytes):')
                        print(lab[:3000])
                    else:
                        print('  No ShaderLab (compiled)')

                elif obj.type.name == 'Material':
                    data = obj.read()
                    print(f'  Name: {data.m_Name}')
                    print(f'  Shader: {data.m_Shader}')
                    print(f'  SavedProperties keys: {list(data.m_SavedProperties.__dict__.keys())[:10]}')
                    for k, v in data.m_SavedProperties.__dict__.items():
                        print(f'    {k}: {v}')

                elif obj.type.name == 'MonoBehaviour':
                    data = obj.read()
                    print(f'  Name: {getattr(data, "m_Name", "N/A")}')
                    print(f'  Script: {getattr(data, "m_Script", None)}')
                    # Dump all attributes
                    for key in dir(data):
                        if not key.startswith('_'):
                            try:
                                val = getattr(data, key)
                                if not callable(val):
                                    print(f'  [{key}] = {str(val)[:300]}')
                            except:
                                pass
                    # Try to dump the raw binary
                    try:
                        raw = getattr(data, 'm_BinaryData', None) or getattr(data, '_raw_data', None)
                        if raw:
                            print(f'  Raw binary ({len(raw)} bytes): {raw[:200].hex()}')
                    except:
                        pass

                else:
                    data = obj.read()
                    print(f'  Name: {getattr(data, "m_Name", "N/A")}')
                    print(f'  Type fields: {[k for k in data.__dict__.keys() if not k.startswith("_")][:20]}')
                    for key in data.__dict__:
                        if not key.startswith('_'):
                            print(f'  [{key}] = {str(data.__dict__[key])[:300]}')

        except Exception as e:
            print(f'Error: {e}')
            import traceback
            traceback.print_exc()

# Also try the shaders_and_materials bundle for Shader source
print('\n\n===== SHADERS BUNDLE =====')
shader_paths = [p for p in targets if 'shaders' in p.lower()] or ['E:/BaiduNetdiskDownload/SideM/RAW/asset/shaders_and_materials.unity3d']
for sp in shader_paths:
    if os.path.exists(sp):
        print(f'\n--- {sp} ---')
        try:
            env = load_bundle(sp)
            for path, obj in env.container.items():
                if obj.type.name == 'Shader':
                    data = obj.read()
                    print(f'\nShader: {data.m_ParsedForm.m_Name}')
                    lab = data.m_ParsedForm.m_ShaderLab
                    if lab:
                        print(f'  Lab ({len(lab)} bytes):')
                        print(lab[:2000])
        except Exception as e:
            print(f'  Error: {e}')
