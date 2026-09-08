"""Legacy masterdata wire decoding and provenance-preserving table records.

This is the archive's existing heuristic decoder, not a complete protobuf schema
or a strict wire validator. Domain builders interpret the resulting fields.
"""
from __future__ import annotations
from typing import Any

DEFAULT_KEY = b"DefaultPassPhrase"


def read_varint(data: bytes, pos: int, end: int) -> tuple[int, int]:
    value = 0
    shift = 0
    while pos < end:
        byte = data[pos]
        pos += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return value, pos
        shift += 7
    raise EOFError("truncated varint")


def xor_decode(data: bytes, key: bytes = DEFAULT_KEY) -> bytes:
    return bytes(byte ^ key[i % len(key)] for i, byte in enumerate(data))


def decode_masterdata_input(data: bytes, input_state: str) -> bytes:
    if input_state == "xor":
        return xor_decode(data)
    if input_state == "decoded":
        return data
    raise ValueError("input_state must be 'xor' or 'decoded'")


def iter_top_records(data: bytes):
    pos = 0
    end = len(data)
    while pos < end:
        start = pos
        tag, pos = read_varint(data, pos, end)
        field_no = tag >> 3
        wire_type = tag & 7
        if wire_type == 2:
            length, pos = read_varint(data, pos, end)
            payload_start = pos
            pos += length
            yield field_no, start, payload_start, pos, data[payload_start:pos]
        elif wire_type == 0:
            value, pos = read_varint(data, pos, end)
            yield field_no, start, pos, pos, value
        elif wire_type == 1:
            payload_start = pos
            pos += 8
            yield field_no, start, payload_start, pos, data[payload_start:pos]
        elif wire_type == 5:
            payload_start = pos
            pos += 4
            yield field_no, start, payload_start, pos, data[payload_start:pos]
        else:
            raise ValueError(f"unsupported top-level wire type {wire_type} at {start:#x}")


def decode_string(raw: bytes) -> str | None:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return None
    if not text:
        return ""
    printable = sum(ch.isprintable() or ch in "\r\n\t" for ch in text) / len(text)
    return text if printable > 0.85 else None


def parse_message(data: bytes, nested: bool = False) -> dict[str, Any]:
    pos = 0
    end = len(data)
    out: dict[str, Any] = {}
    multi: dict[str, list[Any]] = {}

    def put(field_no: int, value: Any) -> None:
        key = str(field_no)
        if key in out:
            if key not in multi:
                multi[key] = [out[key]]
            multi[key].append(value)
            out[key] = multi[key]
        else:
            out[key] = value

    while pos < end:
        tag, pos = read_varint(data, pos, end)
        field_no = tag >> 3
        wire_type = tag & 7
        if wire_type == 0:
            value, pos = read_varint(data, pos, end)
            put(field_no, value)
        elif wire_type == 2:
            length, pos = read_varint(data, pos, end)
            raw = data[pos : pos + length]
            pos += length
            text = decode_string(raw)
            if text is not None:
                put(field_no, text)
            elif nested:
                put(field_no, parse_message(raw, nested=False))
            else:
                put(field_no, raw.hex())
        elif wire_type == 1:
            put(field_no, data[pos : pos + 8].hex())
            pos += 8
        elif wire_type == 5:
            put(field_no, data[pos : pos + 4].hex())
            pos += 4
        else:
            put(field_no, f"unsupported_wire_{wire_type}")
            break
    return out


def length_delimited_field_bytes(data: bytes, target_field: int) -> bytes | None:
    """Return an exact length-delimited payload without guessing whether it is text.

    Some client tables store numeric identifiers in protobuf bytes fields.  The
    generic parser intentionally decodes printable one-byte values as text, so
    table 80 character ids such as 45 (``-``) would otherwise lose their
    numeric identity.
    """
    pos = 0
    end = len(data)
    while pos < end:
        tag, pos = read_varint(data, pos, end)
        field_no = tag >> 3
        wire_type = tag & 7
        if wire_type == 0:
            _, pos = read_varint(data, pos, end)
        elif wire_type == 1:
            pos += 8
        elif wire_type == 2:
            length, pos = read_varint(data, pos, end)
            raw = data[pos : pos + length]
            pos += length
            if field_no == target_field:
                return raw
        elif wire_type == 5:
            pos += 4
        else:
            return None
    return None


def extract_table_rows(
    records: list[tuple[int, int, int, int, Any]],
    table_ids: set[int],
    *,
    nested: bool = True,
) -> dict[int, list[dict[str, Any]]]:
    tables: dict[int, list[dict[str, Any]]] = {table_id: [] for table_id in table_ids}
    for top_field, start, payload_start, end, payload in records:
        if top_field not in table_ids or not isinstance(payload, bytes):
            continue
        parsed = parse_message(payload, nested=nested)
        parsed["_top_field"] = top_field
        parsed["_offset"] = start
        tables[top_field].append(parsed)
    return tables


