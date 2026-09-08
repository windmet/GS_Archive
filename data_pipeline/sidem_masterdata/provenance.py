"""Field-level masterdata source references shared by domain builders."""
from typing import Any


def source(table: int, fields: dict[str, int], offset: int | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {"table": table, "fields": fields}
    if offset is not None:
        out["offset"] = offset
    return out


