"""Strict protobuf wire reader. Bytes are never guessed to be text or messages.

This is an audit subset, not a replacement for generated protobuf bindings.
Groups (wire 3/4) are explicitly unsupported. Duplicate singular fields are
rejected to avoid silently publishing ambiguous/malformed canonical rows.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any
import re

class DecodeError(ValueError):
    pass

@dataclass(frozen=True)
class Field:
    number: int
    wire_type: int
    value: int | bytes
    offset: int
    end: int

def varint(data: bytes, offset: int = 0) -> tuple[int, int]:
    value = 0
    for index in range(10):
        if offset >= len(data):
            raise DecodeError(f'truncated varint at {offset}')
        byte = data[offset]; offset += 1
        if index == 9 and byte > 1:
            raise DecodeError('uint64 varint overflow')
        value |= (byte & 127) << (index * 7)
        if byte < 128:
            return value, offset
    raise DecodeError('unterminated varint')

def fields(data: bytes) -> list[Field]:
    out: list[Field] = []
    cursor = 0
    while cursor < len(data):
        start = cursor
        tag, cursor = varint(data, cursor)
        number, wire_type = tag >> 3, tag & 7
        if not 1 <= number <= 536870911:
            raise DecodeError(f'invalid field number at {start}')
        if wire_type == 0:
            value, cursor = varint(data, cursor)
        elif wire_type in (1, 2, 5):
            if wire_type == 2:
                size, cursor = varint(data, cursor)
            else:
                size = 8 if wire_type == 1 else 4
            end = cursor + size
            if end > len(data):
                raise DecodeError(f'truncated field {number} at {start}: need {size} bytes')
            value, cursor = data[cursor:end], end
        else:
            raise DecodeError(f'unsupported wire type {wire_type} at {start}')
        out.append(Field(number, wire_type, value, start, cursor))
    return out

def opaque(field: Field) -> dict[str, Any]:
    result = {'number': field.number, 'wireType': field.wire_type}
    if isinstance(field.value, bytes):
        result['hex'] = field.value.hex()
    else:
        result['unsignedValue'] = str(field.value)  # preserves uint64 beyond JS safety
    return result

def camel(name: str) -> str:
    return name[0].lower() + name[1:]

def decode(data: bytes, model: str, models: dict, depth: int = 0) -> dict:
    if depth > 24:
        raise DecodeError('nesting limit exceeded')
    schema = models[model]['fields']
    result: dict[str, Any] = {}
    unknown: list[dict] = []
    present: list[int] = []
    for field in fields(data):
        present.append(field.number)
        spec = schema.get(str(field.number))
        if not spec:
            unknown.append(opaque(field)); continue
        name, kind = camel(spec['name']), spec['type']
        repeated = kind.startswith('rm/') or kind in ('ru', 'raw')
        if name in result and not repeated:
            raise DecodeError(f'{model}.{name}: duplicate singular field; review required')
        if kind == 'raw':
            result.setdefault(name, []).append(opaque(field)); continue
        if kind == 'ru':
            values = []
            if field.wire_type == 0:
                values = [field.value]
            elif field.wire_type == 2:
                at = 0
                while at < len(field.value):
                    number, at = varint(field.value, at); values.append(number)
            else:
                raise DecodeError(f'{model}.{name}: expected packed/unpacked integer')
            if any(number > 9007199254740991 for number in values):
                raise DecodeError(f'{model}.{name}: packed integer exceeds JS safety')
            result.setdefault(name, []).extend(values); continue
        expected_wire = 0 if kind in ('u', 'i', 'b') else 2
        if field.wire_type != expected_wire:
            raise DecodeError(f'{model}.{name}: wire {field.wire_type}, expected {expected_wire}')
        value = field.value
        if kind == 's':
            try:
                value = value.decode('utf-8', errors='strict')
            except UnicodeDecodeError as exc:
                raise DecodeError(f'{model}.{name}: invalid UTF-8') from exc
        elif kind == 'i':
            value = value if value < (1 << 63) else value - (1 << 64)
        elif kind == 'b':
            if value not in (0, 1):
                raise DecodeError(f'{model}.{name}: noncanonical boolean {value}')
            value = bool(value)
        elif kind.startswith(('m/', 'rm/')):
            value = decode(value, kind.split('/', 1)[1], models, depth + 1)
        elif kind != 'u':
            raise DecodeError(f'unknown type rule {kind}')
        if isinstance(value, int) and not isinstance(value, bool) and abs(value) > 9007199254740991:
            raise DecodeError(f'{model}.{name}: integer exceeds JS safety; add explicit string contract')
        if repeated:
            result.setdefault(name, []).append(value)
        else:
            result[name] = value
    result['_presentFields'] = sorted(set(present))
    if unknown:
        result['_unknownFields'] = unknown
    return result
