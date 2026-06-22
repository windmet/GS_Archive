"""
skel2json.py — Convert Spine 3.8 binary .skel to .json for Spine Editor inspection.

Usage:
  python skel2json.py <model_id> [output.json]
  python skel2json.py 039mcr_002_00
  python skel2json.py 040ren_002_00 --all    # dump all data including anims
"""

import struct, sys, os, json

# ── Binary readers (Spine 3.8 format) ──────────────────────────────

def read_varint(data, offset, optimize_positive=True):
    raw = 0; shift = 0
    while True:
        b = data[offset]; offset += 1
        raw |= (b & 0x7F) << shift; shift += 7
        if not (b & 0x80): break
    if optimize_positive: return raw >> 1, offset
    n = raw >> 1
    return (-n - 1) if (raw & 1) else n, offset

def read_string(data, offset):
    if offset >= len(data): return None, offset
    first = data[offset]; offset += 1
    if first == 0: return None, offset
    remaining, offset = read_varint(data, offset)
    if remaining < 0 or remaining > 5000: return None, offset
    s = chr(first) + data[offset:offset+remaining].decode('utf-8', errors='replace')
    return s, offset + remaining

def read_float(data, offset):
    return struct.unpack_from('<f', data, offset)[0], offset + 4

def read_boolean(data, offset):
    return bool(data[offset]), offset + 1

def skip_attachment(data, offset, att_type):
    if att_type == 0:  # region
        offset += 20
    elif att_type == 1:  # bounding box
        v, offset = read_varint(data, offset); offset += v * 4
    elif att_type == 2:  # mesh
        v, offset = read_varint(data, offset); offset += v * 4
        v, offset = read_varint(data, offset); offset += v * 4
        v, offset = read_varint(data, offset); offset += v * 4
    elif att_type == 3:  # linked mesh
        _, offset = read_string(data, offset); _, offset = read_string(data, offset)
        v, offset = read_varint(data, offset); offset += v * 4
        v, offset = read_varint(data, offset); offset += v * 4
        v, offset = read_varint(data, offset); offset += v * 4
    elif att_type == 4:  # path
        v, offset = read_varint(data, offset); offset += v * 4
        closed, offset = read_boolean(data, offset); constantSpeed, offset = read_boolean(data, offset)
    elif att_type == 5:  # clipping
        v, offset = read_varint(data, offset); offset += v * 4
    return offset

def read_color(data, offset):
    r, offset = read_float(data, offset); g, offset = read_float(data, offset)
    b, offset = read_float(data, offset); a, offset = read_float(data, offset)
    return f"{r:.2f},{g:.2f},{b:.2f},{a:.2f}", offset

def read_attachment(data, offset, att_type):
    """Read attachment data and return a dict representation."""
    entry = {'type': att_type}
    if att_type == 0:  # region
        entry['rotation'], offset = read_float(data, offset)
        entry['x'], offset = read_float(data, offset)
        entry['y'], offset = read_float(data, offset)
        entry['width'], offset = read_float(data, offset)
        entry['height'], offset = read_float(data, offset)
    elif att_type == 1:  # bounding box
        v, offset = read_varint(data, offset)
        entry['vertices'] = v
    elif att_type == 2:  # mesh
        v, offset = read_varint(data, offset)
        entry['uv_count'] = v
        v, offset = read_varint(data, offset)
        entry['tri_count'] = v
        v, offset = read_varint(data, offset)
        entry['vert_count'] = v
    elif att_type == 3:  # linked mesh
        entry['skin'], offset = read_string(data, offset)
        entry['parent'], offset = read_string(data, offset)
        v, offset = read_varint(data, offset)
        entry['uv_count'] = v
        v, offset = read_varint(data, offset)
        entry['tri_count'] = v
        v, offset = read_varint(data, offset)
        entry['vert_count'] = v
    return entry, offset

# ── Main parser ────────────────────────────────────────────────────

def parse_skel(data):
    result = {}

    # Hash
    hsh, offset = read_string(data, 0)
    result['hash'] = hsh

    # Version string (e.g. "3.8.75")
    ver_name, offset = read_string(data, offset)
    result['spine'] = ver_name

    # Width / Height
    result['width'], offset = read_float(data, offset)
    result['height'], offset = read_float(data, offset)

    # FPS + images path
    v, offset = read_varint(data, offset)
    result['fps'] = v
    img_path, offset = read_string(data, offset)
    result['images'] = img_path or './images/'

    # Audio path (usually empty)
    aud_path, offset = read_string(data, offset)

    result['skeleton'] = {
        'hash': result.pop('hash'), 'spine': result.pop('spine'),
        'width': result.pop('width'), 'height': result.pop('height'),
        'fps': result.pop('fps'), 'images': result.pop('images'),
    }

    # ── Bones ──
    bones = []
    bone_count, offset = read_varint(data, offset)
    for _ in range(bone_count):
        name, offset = read_string(data, offset)
        parent_name, offset = read_string(data, offset)
        bone = {'name': name}
        if parent_name: bone['parent'] = parent_name
        length, offset = read_float(data, offset)
        if length: bone['length'] = round(length, 3)
        x, offset = read_float(data, offset)
        y, offset = read_float(data, offset)
        if abs(x) > 0.001 or abs(y) > 0.001: bone['x'] = round(x, 3); bone['y'] = round(y, 3)
        rotation, offset = read_float(data, offset)
        if rotation: bone['rotation'] = round(rotation, 3)
        scaleX, offset = read_float(data, offset)
        scaleY, offset = read_float(data, offset)
        if scaleX != 1: bone['scaleX'] = round(scaleX, 3)
        if scaleY != 1: bone['scaleY'] = round(scaleY, 3)
        shearX, offset = read_float(data, offset)
        shearY, offset = read_float(data, offset)
        if shearX: bone['shearX'] = round(shearX, 3)
        if shearY: bone['shearY'] = round(shearY, 3)
        compress, offset = read_boolean(data, offset)
        _, offset = read_boolean(data, offset)  # inherit
        if compress:
            v, offset = read_varint(data, offset)
        bones.append(bone)
    result['bones'] = bones

    # ── Slots ──
    slots = []
    slot_count, offset = read_varint(data, offset)
    for _ in range(slot_count):
        name, offset = read_string(data, offset)
        bone_name, offset = read_string(data, offset)
        slot = {'name': name, 'bone': bone_name}
        att_name, offset = read_string(data, offset)
        if att_name: slot['attachment'] = att_name
        color, offset = read_color(data, offset)
        if color != '1.00,1.00,1.00,1.00': slot['color'] = color
        # blend mode: 0=normal, 1=additive, 2=multiply, 3=screen
        bmode, offset = read_varint(data, offset)
        if bmode: slot['blend'] = ['', 'additive', 'multiply', 'screen'][bmode]
        slots.append(slot)
    result['slots'] = slots

    # ── Skins ──
    skins = []
    skin_count, offset = read_varint(data, offset)
    for si in range(skin_count):
        skin_name, offset = read_string(data, offset)
        skin = {'name': skin_name or 'default', 'attachments': {}}
        slot_count, offset = read_varint(data, offset)
        for _ in range(slot_count):
            slot_idx, offset = read_varint(data, offset)
            att_count, offset = read_varint(data, offset)
            for _ in range(att_count):
                att_name, offset = read_string(data, offset)
                att_type, offset = read_varint(data, offset)
                path_name, offset = read_string(data, offset)
                att_entry, offset = read_attachment(data, offset, att_type)
                att_entry['path'] = path_name or att_name
                if slot_idx not in skin['attachments']:
                    skin['attachments'][slot_idx] = {}
                skin['attachments'][slot_idx][att_name] = att_entry
        skins.append(skin)
    result['skins'] = skins

    # ── Events ──
    events = {}
    ev_count, offset = read_varint(data, offset)
    for _ in range(ev_count):
        name, offset = read_string(data, offset)
        ev = {}
        int_val, offset = read_varint(data, offset)
        if int_val: ev['int'] = int_val
        float_bits, offset = read_varint(data, offset)
        if float_bits:
            import struct
            ev['float'] = struct.unpack('<f', struct.pack('<I', float_bits))[0]
        str_val, offset = read_string(data, offset)
        if str_val: ev['string'] = str_val
        audio, offset = read_string(data, offset)
        if audio: ev['audio'] = audio
        vol, offset = read_float(data, offset)
        if vol != 1: ev['volume'] = round(vol, 2)
        bal, offset = read_float(data, offset)
        if bal: ev['balance'] = round(bal, 2)
        if name: events[name] = ev
    result['events'] = events

    # ── Constraints (skip) ──
    con_count, offset = read_varint(data, offset)
    for _ in range(con_count):
        _, offset = read_string(data, offset)
        _, offset = read_varint(data, offset)
        _, offset = read_varint(data, offset)
        # Skip constraint data generously
        while offset < len(data):
            # Check if next byte looks like animation count
            if offset + 5 < len(data) and data[offset] < 100 and data[offset+1] < 100:
                try_next, _ = read_varint(data, offset + 1)
                if try_next < 100:
                    break
            v, o2 = read_varint(data, offset)
            if o2 == offset: break
            offset = o2

    # ── Animations (names only for lightweight export) ──
    anims = {}
    anim_count, offset = read_varint(data, offset)
    for i in range(anim_count):
        name, offset = read_string(data, offset)
        anims[name] = {'timelines': '...'}
    result['animations'] = list(anims.keys())

    return result


# ── Main ───────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    model_id = sys.argv[1]
    spine_dir = f"E:/Web_build/SideM_Archived/web_viewer/public/assets/spines/{model_id}"
    skel_path = os.path.join(spine_dir, "comu.skel")

    if not os.path.exists(skel_path):
        # Try raw .skel
        raw_path = os.path.join(spine_dir, "comu_raw.skel")
        if os.path.exists(raw_path):
            skel_path = raw_path
        else:
            print(f"Error: .skel not found for model '{model_id}'")
            print(f"Looked in: {spine_dir}")
            sys.exit(1)

    with open(skel_path, "rb") as f:
        raw_data = f.read()

    # Strip Unity binary header (4-byte name length + name + padding + 4-byte metadata)
    name_len = struct.unpack_from('<I', raw_data, 0)[0]
    if name_len > 0 and name_len < 100:
        header_size = 4 + name_len
        padding = (4 - header_size % 4) % 4
        header_size += padding + 4
        data = raw_data[header_size:]
        print(f"  Stripped {header_size}-byte Unity header (name_len={name_len})")
    else:
        data = raw_data

    result = parse_skel(data)

    if len(sys.argv) >= 3 and sys.argv[2] == '--all':
        # Default output: print JSON to stdout
        pass

    output_path = None
    if len(sys.argv) >= 3 and not sys.argv[2].startswith('--'):
        output_path = sys.argv[2]
    else:
        output_path = os.path.join(spine_dir, f"{model_id}.json")

    print(f"  Bones: {len(result['bones'])}")
    print(f"  Slots: {len(result['slots'])}")
    print(f"  Skins: {len(result['skins'])}")
    print(f"  Events: {len(result.get('events', {}))}")
    print(f"  Animations: {len(result.get('animations', []))}")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"\n  → Saved to {output_path}")
    print(f"\n  Open this .json in Spine Editor to inspect the model.")

if __name__ == '__main__':
    main()
