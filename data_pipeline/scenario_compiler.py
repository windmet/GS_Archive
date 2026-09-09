"""Compatibility import and CLI for the sidem_scenario package.

Existing scripts retain ScenarioCompiler/ScenarioState and compile_directory.
Running this file retains the legacy single-file and --batch argument behavior.
"""
if __package__:
    from .sidem_scenario import ScenarioCompiler, ScenarioState
    from .sidem_scenario.cli import compile_directory, main
else:
    from sidem_scenario import ScenarioCompiler, ScenarioState
    from sidem_scenario.cli import compile_directory, main

__all__ = ["ScenarioCompiler", "ScenarioState", "compile_directory"]

if __name__ == "__main__":
    main()
