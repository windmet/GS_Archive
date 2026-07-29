"""Minimal read-only helpers for CRI @UTF tables embedded in SideM ACB files."""

from __future__ import annotations

import struct
from typing import Any


UTF_TYPES: dict[int, tuple[str, int]] = {
    0x0: (">B", 1),
    0x1: (">b", 1),
    0x2: (">H", 2),
    0x3: (">h", 2),
    0x4: (">I", 4),
    0x5: (">i", 4),
    0x6: (">Q", 8),
    0x7: (">q", 8),
    0x8: (">f", 4),
    0xA: ("string", 4),
    0xB: ("data", 8),
}


class UtfTable:
    """Parse the subset of CRI @UTF storage used by the archived ACB files."""

    def __init__(self, payload: bytes) -> None:
        if payload[:4] != b"@UTF":
            raise ValueError("not a CRI @UTF table")
        self.payload = payload
        (
            _table_size,
            _unknown,
            row_offset,
            string_offset,
            data_offset,
            _table_name_offset,
            column_count,
            row_size,
            row_count,
        ) = struct.unpack_from(">IHHIIIHHI", payload, 4)
        self.row_base = row_offset + 8
        self.string_base = string_offset + 8
        self.data_base = data_offset + 8

        cursor = 0x20
        columns: list[tuple[str, int, int, Any]] = []
        for _ in range(column_count):
            field_type = payload[cursor]
            name_offset = struct.unpack_from(">I", payload, cursor + 1)[0]
            cursor += 5
            storage = field_type & 0xF0
            value_type = field_type & 0x0F
            name = self._cstring(self.string_base + name_offset)
            if storage in (0x30, 0x70):
                constant, cursor = self._read_value(cursor, value_type)
            elif storage == 0x10:
                constant = 0
            elif storage == 0x50:
                constant = None
            else:
                raise ValueError(f"unsupported @UTF storage 0x{storage:02x}")
            columns.append((name, storage, value_type, constant))

        self.rows: list[dict[str, Any]] = []
        for row_number in range(row_count):
            cursor = self.row_base + row_number * row_size
            row: dict[str, Any] = {}
            for name, storage, value_type, constant in columns:
                if storage == 0x50:
                    value, cursor = self._read_value(cursor, value_type)
                else:
                    value = constant
                row[name] = value
            self.rows.append(row)

    def _cstring(self, offset: int) -> str:
        end = self.payload.index(0, offset)
        return self.payload[offset:end].decode("utf-8")

    def _read_value(self, offset: int, value_type: int) -> tuple[Any, int]:
        kind, size = UTF_TYPES[value_type]
        if kind == "string":
            string_offset = struct.unpack_from(">I", self.payload, offset)[0]
            return self._cstring(self.string_base + string_offset), offset + size
        if kind == "data":
            data_offset, data_size = struct.unpack_from(">II", self.payload, offset)
            start = self.data_base + data_offset
            return self.payload[start : start + data_size], offset + size
        return struct.unpack_from(kind, self.payload, offset)[0], offset + size


def nested_table(top: UtfTable, name: str) -> UtfTable:
    payload = top.rows[0].get(name)
    if not isinstance(payload, bytes) or not payload:
        raise ValueError(f"ACB has no non-empty {name}")
    return UtfTable(payload)


def table_index_list(payload: bytes) -> list[int]:
    """Decode the big-endian uint16 index arrays used by ACB sequence tables."""
    if len(payload) % 2:
        raise ValueError(f"odd-sized ACB index list: {len(payload)} bytes")
    return [
        struct.unpack_from(">H", payload, offset)[0]
        for offset in range(0, len(payload), 2)
    ]


def parse_track_commands(payload: bytes) -> list[dict[str, Any]]:
    """Decode length-prefixed ACB track commands without assigning unknown semantics."""
    commands: list[dict[str, Any]] = []
    cursor = 0
    while cursor < len(payload):
        if cursor + 3 > len(payload):
            raise ValueError("truncated ACB track command")
        command = struct.unpack_from(">H", payload, cursor)[0]
        width = payload[cursor + 2]
        cursor += 3
        if cursor + width > len(payload):
            raise ValueError(f"truncated argument for ACB command 0x{command:04x}")
        argument = payload[cursor : cursor + width]
        cursor += width
        commands.append(
            {
                "command": f"0x{command:04x}",
                "argument_hex": argument.hex(),
                "argument_uint": int.from_bytes(argument, "big") if argument else None,
            }
        )
        if command == 0:
            if cursor != len(payload):
                raise ValueError("bytes remain after ACB track end command")
            break
    return commands
