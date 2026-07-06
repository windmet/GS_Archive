import os, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from UnityPy import load as load_bundle

bundle_path = 'E:/BaiduNetdiskDownload/SideM/RAW/asset/fx_adv_2212christmas.unity3d'
env = load_bundle(bundle_path)

print(f"=== fx_adv_2212christmas.unity3d ===")
print(f"Container paths: {list(env.container.keys())}")
print(f"env.assets type: {type(env.assets)}")
if isinstance(env.assets, list):
    print(f"  len: {len(env.assets)}")

for i, assetsfile in enumerate(env.assets):
    print(f"\n--- Assets file #{i} ---")
    # Check what type this is
    print(f"  type: {type(assetsfile)}")
    if hasattr(assetsfile, 'objects'):
        objects = assetsfile.objects
        print(f"  objects type: {type(objects)}")
        if isinstance(objects, dict):
            items = objects.items()
        elif isinstance(objects, list):
            items = enumerate(objects)
        else:
            items = []

        for path_id, obj in items:
            try:
                print(f"\n  PathID/Idx {path_id}: type={obj.type.name}")
                data = obj.read()

                if obj.type.name == 'GameObject':
                    print(f"    Name: {data.m_Name}")
                    if hasattr(data, 'm_Components'):
                        for comp in data.m_Components:
                            try:
                                c_obj = comp.component.read()
                                print(f"    Comp: {comp.component.type.name} -> {getattr(c_obj, 'm_Name', type(c_obj).__name__)}")
                            except Exception as e:
                                print(f"    Comp: {comp.component.type.name} (err: {e})")

                elif obj.type.name == 'Transform':
                    print(f"    LocalPosition: {getattr(data, 'm_LocalPosition', '?')}")

                elif obj.type.name == 'ParticleSystem':
                    print(f"    *** PARTICLE SYSTEM ***")
                    for key, val in data.__dict__.items():
                        if not key.startswith('_'):
                            print(f"    [{key}] = {str(val)[:800]}")

                elif obj.type.name == 'ParticleSystemRenderer':
                    print(f"    *** PARTICLE RENDERER ***")
                    for key, val in data.__dict__.items():
                        if not key.startswith('_'):
                            print(f"    [{key}] = {str(val)[:800]}")

                elif obj.type.name == 'Texture2D':
                    print(f"    Size: {data.m_Width}x{data.m_Height} Format:{data.m_TextureFormat}")
                    try:
                        img = data.image
                        outpath = f'E:/Web_build/SideM_Archived/web_viewer/public/data/fx_extracted/unity_{data.m_Name}.png'
                        img.save(outpath)
                        print(f"    Saved: {outpath}")
                    except Exception as e:
                        print(f"    Image error: {e}")

                elif obj.type.name == 'Material':
                    print(f"    Name: {data.m_Name}")
                    print(f"    Shader ref: {data.m_Shader}")
                    for k, v in data.m_SavedProperties.__dict__.items():
                        print(f"    [{k}] = {v}")

                elif obj.type.name == 'Shader':
                    print(f"    Name: {data.m_ParsedForm.m_Name}")
                    # Try to get serialized shader data
                    sf = getattr(data.m_ParsedForm, 'm_SerializedShader', None) or data.m_ParsedForm
                    for key in dir(sf):
                        if not key.startswith('_'):
                            try:
                                val = getattr(sf, key)
                                if not callable(val):
                                    print(f"    [{key}] = {str(val)[:300]}")
                            except:
                                pass

                elif obj.type.name == 'MonoBehaviour':
                    print(f"    Name: {getattr(data, 'm_Name', '?')}")
                    for key in dir(data):
                        if not key.startswith('_') and not callable(getattr(data, key)):
                            try:
                                val = getattr(data, key)
                                if val is not None:
                                    print(f"    [{key}] = {str(val)[:300]}")
                            except:
                                pass

                else:
                    print(f"    Type data:")
                    for key in data.__dict__:
                        if not key.startswith('_'):
                            print(f"    [{key}] = {str(data.__dict__[key])[:200]}")

            except Exception as e:
                print(f"  PathID {path_id}: {obj.type.name} -> ERROR: {e}")

print("\n\n=== DONE ===")
