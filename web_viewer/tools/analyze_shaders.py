import os, re, json

path = 'E:/BaiduNetdiskDownload/SideM/GS_Res/新建文件夹/RAW/asset/shaders_and_materials.unity3d'
size = os.path.getsize(path)
with open(path, 'rb') as f:
    data = f.read()

print(f'File size: {size} bytes')
print(f'First 32 hex: {data[:32].hex()}')
print(f'Magic bytes: {data[:8]}')

# Unity3D bundle format: web files start with UnityFS
sig = data[:8].decode('latin-1', errors='replace')
print(f'Sig string: {repr(sig)}')

# Try to find CAB-format block structure
# UnityFS: signature(8) + version(4) + ... + block_count + blocks + node_count + nodes
if sig == 'UnityFS':
    print("Format: UnityFS (asset bundle)")

# Search for all readable strings
text = data.decode('latin-1', errors='replace')
# Extract asset names, shader names
for p in re.findall(r'[\w./\\-]{12,}', text):
    low = p.lower()
    if any(x in low for x in ['shader', 'particle', 'flare', 'shine', 'advbackground', 'camera', 'mask', 'spine', 'additive', 'pma', 'material', 'prefab', 'fx_adv']):
        print(f'  -> {p}')

# Also dump all unique paths
print('\n--- ALL UNIQUE PATHS ---')
paths = set(re.findall(r'[\w./\\-]{12,}', text))
for p in sorted(paths, key=len, reverse=True)[:50]:
    print(f'  {p}')

# Check for the fx_adv prefab reference
print('\n--- Looking for fx_adv ---')
for m in re.finditer(r'fx_adv[^\\]{0,50}', text):
    print(f"  {m.group()} at offset {m.start()}")
