"""Wire semantics and optional full decoded-masterdata parity baseline."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
import sidem_masterdata as wire
import masterdata_extract as legacy

def summarize(data, api=wire):
    digest = hashlib.sha256()
    records = list(api.iter_top_records(data))
    errors = 0
    for field, start, payload_start, end, payload in records:
        values = [field, start, payload_start, end, payload.hex() if isinstance(payload, bytes) else payload]
        if isinstance(payload, bytes):
            for nested in (False, True):
                try:
                    parsed = api.parse_message(payload, nested=nested)
                except (ValueError, EOFError) as error:
                    errors += 1
                    parsed = {'parse_error': type(error).__name__, 'message': str(error)}
                values.append(parsed)
        digest.update(json.dumps(values, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode())
        digest.update(b'\n')
    return {'input_sha256': hashlib.sha256(data).hexdigest(), 'records': len(records),
            'tables': len({record[0] for record in records}), 'parse_errors': errors,
            'records_and_fields_sha256': digest.hexdigest()}

def verify():
    for name in wire.__all__:
        assert getattr(legacy, name) is getattr(wire, name)
    assert wire.read_varint(b'\x96\x01', 0, 2) == (150, 2)
    try:
        wire.read_varint(b'\x80', 0, 1)
    except EOFError:
        pass
    else:
        raise AssertionError('truncated varint accepted')
    message = b'\x08\x01\x08\x02\x12\x03abc\x1a\x01-'
    assert wire.parse_message(message) == {'1': [1, 2], '2': 'abc', '3': '-'}
    assert wire.length_delimited_field_bytes(message, 3) == b'-'
    assert wire.parse_message(b'\x12\x02\x08\x01', nested=True) == {'2': {'1': 1}}
    assert wire.parse_message(b'\x12\x02\x08\x01') == {'2': '0801'}
    assert wire.parse_message(b'\x0d1234\x1112345678') == {'1': '31323334', '2': '3132333435363738'}
    top = b'\x0a' + bytes([len(message)]) + message + b'\x10\x01'
    records = list(wire.iter_top_records(top))
    assert records == [(1, 0, 2, 2 + len(message), message), (2, 2 + len(message), len(top), len(top), 1)]
    assert wire.extract_table_rows(records, {1, 3}) == {
        1: [{**wire.parse_message(message), '_top_field': 1, '_offset': 0}], 3: []}
    assert wire.decode_masterdata_input(wire.xor_decode(top), 'xor') == top
    assert wire.decode_masterdata_input(top, 'decoded') is top
    try:
        wire.decode_masterdata_input(top, 'guess')
    except ValueError:
        pass
    else:
        raise AssertionError('implicit input-state guessing accepted')
    # Preserve legacy tolerance; hardening is a distinct behavior change.
    assert wire.parse_message(b'\x0a\x05ab') == {'1': 'ab'}
    assert wire.parse_message(b'\x0b') == {'1': 'unsupported_wire_3'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decoded-masterdata', type=Path)
    args = parser.parse_args()
    verify()
    if args.decoded_masterdata:
        baseline = json.loads((ROOT/'fixtures/masterdata-wire/decoded-baseline.json').read_text())
        actual = summarize(args.decoded_masterdata.read_bytes())
        assert actual == baseline['summary'], (actual, baseline)
        print(json.dumps(actual))
    print('Masterdata wire: compatibility exports, varints, raw bytes, repeated/nested/fixed fields, offsets and explicit input state passed')

if __name__ == '__main__':
    main()
