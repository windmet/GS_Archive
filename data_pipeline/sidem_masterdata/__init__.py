"""Masterdata decoding API, independent of domain generation and publication."""
from .wire import (
    DEFAULT_KEY,
    read_varint,
    xor_decode,
    decode_masterdata_input,
    iter_top_records,
    decode_string,
    parse_message,
    length_delimited_field_bytes,
    extract_table_rows,
)

__all__ = ['DEFAULT_KEY', 'read_varint', 'xor_decode', 'decode_masterdata_input', 'iter_top_records', 'decode_string', 'parse_message', 'length_delimited_field_bytes', 'extract_table_rows']
