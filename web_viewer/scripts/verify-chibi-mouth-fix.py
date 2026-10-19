from live_chibi_mouth_fix import mouth_fix_events

header = ['type', 'time', 'value1', 'value2', 'value3', 'value101', 'value102']
rows = [header, ['Livechara_mouth_shape_fix', '10', '', '450', '200', '', ''],
        ['Livechara_mouth_shape_fix', '10', '1', '', '', '1', '150'],
        ['Other', 'bad', '', '', '', '', '']]
events = mouth_fix_events(rows)
assert events == [{'time': 10, 'sourceRow': 2, 'target': 0, 'erase': False, 'duration': 200, 'openRate': .45},
                  {'time': 10, 'sourceRow': 3, 'target': 1, 'erase': True, 'duration': 150}]
assert mouth_fix_events([list(reversed(row)) for row in rows]) == events
for index, value in [(1, ''), (1, 'nan'), (2, '1.5'), (2, '-1'), (3, 'inf'), (4, '-2'), (5, '2')]:
    invalid = [header, list(rows[1])]
    invalid[1][index] = value
    try:
        mouth_fix_events(invalid)
        raise AssertionError((index, value))
    except ValueError:
        pass
assert mouth_fix_events([header, ['Livechara_mouth_shape_fix', '-100']])[0]['target'] == 0
print('PASS mouth fix CSV: named/reordered columns, blank all-target, rates/durations, erase, source order and malformed values')
