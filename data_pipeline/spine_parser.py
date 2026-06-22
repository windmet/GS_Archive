import struct, sys

def read_varint(data, offset, optimize_positive=True):
    """Spine binary varint. Raw value encodes twice the number (zigzag).
    With optimize_positive=True (default), returns the actual value directly."""
    raw = 0
    shift = 0
    while True:
        b = data[offset]
        offset += 1
        raw |= (b & 0x7F) << shift
        shift += 7
        if not (b & 0x80):
            break
    if optimize_positive:
        return raw >> 1, offset
    # Zigzag decode for signed values
    n = raw >> 1
    return -n - 1 if raw & 1 else n, offset

def read_string(data, offset):
    """Spine 3.8 binary string: first byte is first char (0=null).
    Then varint(optimizePositive=true)=remaining_byte_count, then that many UTF-8 bytes."""
    if offset >= len(data):
        return None, offset
    first = data[offset]
    offset += 1
    if first == 0:
        return None, offset
    remaining, offset = read_varint(data, offset)
    if remaining < 0 or remaining > 200 or offset + remaining > len(data):
        return None, offset
    s = chr(first) + data[offset:offset+remaining].decode('utf-8', errors='replace')
    return s, offset + remaining

def skip_attachment(data, offset, att_type):
    """Skip attachment data based on type. Return new offset."""
    if att_type == 0:  # region - fixed fields
        offset += 20  # x, y, rotation, w, h
    elif att_type == 1:  # bounding box
        count, offset = read_varint(data, offset)
        offset += count * 8  # vertices (2 floats per vertex)
        offset += 4  # color
    elif att_type == 2:  # mesh
        count, offset = read_varint(data, offset)
        offset += count * 8  # vertices
        tri_count, offset = read_varint(data, offset)
        offset += tri_count * 2  # triangles (ushort)
        uv_count, offset = read_varint(data, offset)
        offset += uv_count * 8  # uvs
    elif att_type == 3:  # linked mesh
        _, offset = read_string(data, offset)  # skin
        _, offset = read_string(data, offset)  # parent
        offset += 4  # deform
    elif att_type == 4:  # path
        count, offset = read_varint(data, offset)
        offset += count * 8
    elif att_type == 5:  # point
        offset += 8  # x, y
    elif att_type == 6:  # clipping
        count, offset = read_varint(data, offset)
        offset += count * 8
    return offset

def list_anims(skel_path):
    with open(skel_path, 'rb') as f:
        raw = f.read()

    # Strip Unity 20-byte header
    nameLen = struct.unpack_from('<I', raw, 0)[0]
    if 0 < nameLen < 100:
        printable = all(0x20 <= raw[4+i] <= 0x7e for i in range(nameLen))
        if printable:
            padding = (4 - (4 + nameLen) % 4) % 4
            headerSize = 4 + nameLen + padding + 4
            data = raw[headerSize:]
        else:
            data = raw
    else:
        data = raw

    offset = 0
    hash_str, offset = read_string(data, offset)
    version, offset = read_string(data, offset)
    print(f"Spine version: {version}")

    offset += 12  # width, height, fps (3 floats)
    _, offset = read_string(data, offset)  # images path

    offset += 16  # x, y, skelWidth, skelHeight (nonessential)

    # Bones
    bones_count, offset = read_varint(data, offset)
    for _ in range(bones_count):
        _, offset = read_string(data, offset)
        parent, offset = read_varint(data, offset) if bones_count > 1 else (0, offset)
        offset += 28 + 2  # 7 floats + compress + inherit + color

    # Slots
    slots_count, offset = read_varint(data, offset)
    for _ in range(slots_count):
        _, offset = read_string(data, offset)
        _, offset = read_string(data, offset)
        _, offset = read_string(data, offset)
        offset += 6  # color

    # Skins
    skins_count, offset = read_varint(data, offset)
    for _ in range(skins_count):
        _, offset = read_string(data, offset)
        s_count, offset = read_varint(data, offset)
        for _ in range(s_count):
            _, offset = read_varint(data, offset)  # slot index
            a_count, offset = read_varint(data, offset)
            for _ in range(a_count):
                _, offset = read_string(data, offset)  # att name
                att_type, offset = read_varint(data, offset)  # type
                _, offset = read_string(data, offset)  # path
                offset = skip_attachment(data, offset, att_type)

    # Events — skip to next section
    events_count, offset = read_varint(data, offset)
    for _ in range(events_count):
        _, offset = read_string(data, offset)
        # int value: 0 (none) or read varint
        _, offset = read_varint(data, offset)
        # float value: 0 (none) or read varint (int bits of float)
        _, offset = read_varint(data, offset)
        _, offset = read_string(data, offset)
        _, offset = read_string(data, offset)
        offset += 8  # volume + balance

    # Constraints
    cons_count, offset = read_varint(data, offset)
    for _ in range(cons_count):
        _, offset = read_string(data, offset)  # name
        _, offset = read_varint(data, offset)  # order
        _, offset = read_varint(data, offset)  # skinRequired
        # Transform: translate mix, rotate mix, scale mix, shear mix (4 floats)
        # Path: position mode, spacing mode, rotate mode (2 ints + offset)
        # Only reading the common prefix — actual data depends on constraint type
        # But we just need to skip to the next section, so skip generously
        # The constraint data is always preceded by these 3 varints
        try:
            # try reading until we find the next section marker (animation count)
            # Each constraint type has different data. Just try progressive skip.
            for safety in range(200):
                v, next_off = read_varint(data, offset)
                if data[next_off] < 128 and next_off < len(data) - 4:
                    # Check if we're at animation section: next bytes look like a count
                    # Animation count is a varint usually 0-100
                    break
                offset = next_off
        except:
            pass

    # Animations
    anims_count, offset = read_varint(data, offset)
    names = []
    for i in range(anims_count):
        name, offset = read_string(data, offset)
        names.append(name)
    print(f"\n=== ALL {len(names)} ANIMATIONS ===")
    for n in names:
        print(f"  {n}")

if __name__ == '__main__':
    list_anims(sys.argv[1])
