"""Legacy file convenience API, shared by the public compiler class."""
import json
import os
from typing import Optional


class ScenarioFileIO:
    # ----------------------------------------------------------------
    # File I/O convenience
    # ----------------------------------------------------------------

    @staticmethod
    def load_json(path: str) -> dict:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def save_json(data: dict, path: str, indent: int = 2):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=indent)

    @classmethod
    def compile_file(cls, path: str, output_dir: Optional[str] = None) -> dict:
        """Load, compile, optionally save."""
        data = cls.load_json(path)
        basename = os.path.splitext(os.path.basename(path))[0]
        part_id = basename.removeprefix("scenario_")
        compiler = cls(data, basename, part_id, os.path.basename(path))
        result = compiler.compile()
        if output_dir:
            out_path = os.path.join(output_dir, f"{basename}_compiled.json")
            cls.save_json(result, out_path)
            print(f"  → {out_path}  ({result['total_steps']} steps)")
        return result


