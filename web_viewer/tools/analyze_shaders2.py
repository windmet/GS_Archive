import os, re, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

path = 'E:/BaiduNetdiskDownload/SideM/GS_Res/新建文件夹/RAW/asset/shaders_and_materials.unity3d'
with open(path, 'rb') as f:
    data = f.read()

print(f'File size: {len(data)} bytes')
sig = data[:8].decode('latin-1', errors='replace')
print(f'Signature: {repr(sig)}')
print(f'Version bytes: {data[8:32].hex()}')

# Dump all readable C-style strings (null-terminated)
print('\n--- All null-terminated strings ---')
start = 0
strings = set()
while start < len(data):
    end = data.find(b'\x00', start)
    if end == -1:
        break
    chunk = data[start:end]
    if 4 < len(chunk) < 200:
        try:
            s = chunk.decode('utf-8')
            if s.isprintable():
                strings.add(s)
        except:
            try:
                s = chunk.decode('ascii')
                if s.isprintable():
                    strings.add(s)
            except:
                pass
    start = end + 1

for s in sorted(strings):
    low = s.lower()
    if any(x in low for x in ['shader', 'particle', 'flare', 'shine', 'adv', 'camera', 'mask', 'spine', 'additive', 'pma', 'material', 'fx_adv', 'gradient', 'skeleton', 'unlit', 'alpha', 'softparticle', 'mobile']):
        print(f'  {s}')

# Also look for SerializedFile headers
print('\n--- Bundle structure ---')
# UnityFS has a block/directory structure
# After header: version(4) + fileSize(4) + ... then blockCount + blocks + nodeCount + nodes
import struct
offset = 0
# Skip signature (8 bytes) and version (4 bytes) and unity version string
# Actually let me just find the block structure manually
# Look for "UnityWeb" or "Archive" or files within
for match in re.finditer(r'[\x00-\x7F]{4,}', data.decode('latin-1', errors='replace')):
    s = match.group().strip('\x00').strip()
    if len(s) > 10 and s.count('.') >= 1 and not s.startswith('\x00'):
        print(f'  potential path: {s}')
