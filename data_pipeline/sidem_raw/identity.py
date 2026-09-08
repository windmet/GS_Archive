"""Pure grouping of extracted records by authored Unity container identity."""
import json
import re
from collections import defaultdict
from pathlib import PurePosixPath as Path
from typing import Any

LETTERED_PART = re.compile(r"^(?P<base>.+)_(?P<letter>[a-z])$")


def group_scenario_assets(
    records: list[dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    """Recover semantic scenario identity from Unity container directories."""
    by_directory: dict[str, list[dict[str, Any]]] = defaultdict(list)
    excluded: list[dict[str, Any]] = []
    for record in records:
        name = str(record["name"])
        payload = bytes(record["payload"])
        if not name.startswith("scenario_"):
            excluded.append(
                {
                    "text_asset": name,
                    "container_path": record["container_path"],
                    "path_id": record["path_id"],
                    "reason": "non_scenario_name",
                }
            )
            continue
        try:
            parsed = json.loads(payload.decode("utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            excluded.append(
                {
                    "text_asset": name,
                    "container_path": record["container_path"],
                    "path_id": record["path_id"],
                    "reason": "invalid_json",
                    "error": str(error),
                }
            )
            continue
        part_id = name.removeprefix("scenario_")
        container_path = Path(str(record["container_path"]))
        directory = container_path.parent.as_posix()
        by_directory[directory].append(
            {
                "part_id": part_id,
                "parsed": parsed,
                "payload": payload,
                "text_asset": name,
                "container_path": str(record["container_path"]),
                "path_id": record["path_id"],
            }
        )

    groups: dict[str, dict[str, Any]] = {}
    for directory, directory_records in sorted(by_directory.items()):
        namespace = Path(directory).name
        all_lettered = all(
            LETTERED_PART.match(str(record["part_id"]))
            for record in directory_records
        )
        resource_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
        if all_lettered and len(directory_records) >= 2:
            for record in directory_records:
                match = LETTERED_PART.match(str(record["part_id"]))
                assert match is not None
                resource_groups[match.group("base")].append(record)
        else:
            for record in directory_records:
                resource_groups[str(record["part_id"])].append(record)

        for resource_id, items in sorted(resource_groups.items()):
            scenario_id = (
                resource_id
                if namespace == resource_id
                else f"{namespace}_{resource_id}"
            )
            if scenario_id in groups:
                raise ValueError(
                    f"duplicate semantic scenario id {scenario_id!r} in {directory}"
                )
            groups[scenario_id] = {
                "scenario_id": scenario_id,
                "resource_id": resource_id,
                "namespace": namespace,
                "container_directory": directory,
                "items": sorted(items, key=lambda item: item["container_path"]),
            }
    return groups, excluded


