"""Explicit legacy command-line and batch entry points; no work on import."""
import json
import os
import sys
from .compiler import ScenarioCompiler


# ----------------------------------------------------------------
# Batch compilation
# ----------------------------------------------------------------

def compile_directory(scenario_root: str, output_root: str):
    """Compile available files and return explicit partial-failure evidence."""
    if not os.path.isdir(scenario_root):
        raise NotADirectoryError(f"Scenario input directory does not exist: {scenario_root}")
    count = 0
    failures = []

    def record_failure(path, error):
        failures.append({"path": os.fspath(path), "error": str(error)})
        print(f"  [ERROR] {path}: {error}")

    def walk_error(error):
        record_failure(error.filename or scenario_root, error)

    for dirpath, _, filenames in os.walk(scenario_root, onerror=walk_error):
        for fn in filenames:
            if not fn.endswith(".json"):
                continue
            in_path = os.path.join(dirpath, fn)
            rel = os.path.relpath(dirpath, scenario_root)
            out_dir = os.path.join(output_root, rel)
            try:
                ScenarioCompiler.compile_file(in_path, out_dir)
                count += 1
            except Exception as e:
                record_failure(in_path, e)
    print(f"\nDone. Compiled {count} files.")
    if failures:
        print(f"Failed {len(failures)} inputs or directories.")
    return {"compiled": count, "failures": failures}


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  Single file:  python scenario_compiler.py <input.json> [output_dir]")
        print("  Batch:        python scenario_compiler.py --batch <input_dir> <output_dir>")
        sys.exit(1)

    if sys.argv[1] == "--batch":
        if len(sys.argv) < 4:
            print("Usage: python scenario_compiler.py --batch <input_dir> <output_dir>")
            sys.exit(1)
        result = compile_directory(sys.argv[2], sys.argv[3])
        if result["failures"]:
            sys.exit(1)
    else:
        input_path = sys.argv[1]
        output_path = sys.argv[2] if len(sys.argv) > 2 else None
        result = ScenarioCompiler.compile_file(input_path, output_path)
        if not output_path:
            print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
