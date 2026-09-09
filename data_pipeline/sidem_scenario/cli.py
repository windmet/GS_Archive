"""Explicit legacy command-line and batch entry points; no work on import."""
import json
import os
import sys
from .compiler import ScenarioCompiler


# ----------------------------------------------------------------
# Batch compilation
# ----------------------------------------------------------------

def compile_directory(scenario_root: str, output_root: str):
    """Compile all scenario JSON files under a directory tree."""
    count = 0
    for dirpath, _, filenames in os.walk(scenario_root):
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
                print(f"  ✗ {in_path}: {e}")
    print(f"\nDone. Compiled {count} files.")


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
        compile_directory(sys.argv[2], sys.argv[3])
    else:
        input_path = sys.argv[1]
        output_path = sys.argv[2] if len(sys.argv) > 2 else None
        result = ScenarioCompiler.compile_file(input_path, output_path)
        if not output_path:
            print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
