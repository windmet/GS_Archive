"""Compatibility import for the packaged authoritative output projection."""
if __package__:
    from .sidem_scenario.authoritative import compile_authoritative_scenario
else:
    from sidem_scenario.authoritative import compile_authoritative_scenario

__all__ = ['compile_authoritative_scenario']
