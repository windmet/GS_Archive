from live_chibi_motion_offset import motion_offset_events

header = ['type', 'time', 'value1', 'value101']
rows = [header, ['Livechara_Offset', '-2000', '50', ''], ['Livechara_Offset', '0', 'bad', '1'],
        ['Other', 'bad', '', '']]
expected = [{'time': -2000, 'sourceRow': 2, 'erase': False, 'offsetMs': 50},
            {'time': 0, 'sourceRow': 3, 'erase': True}]
assert motion_offset_events(rows) == expected
assert motion_offset_events([list(reversed(row)) for row in rows]) == expected
assert motion_offset_events([header, ['Livechara_Offset', '0']])[0]['offsetMs'] == 0
for index, value in [(1, ''), (1, 'nan'), (2, 'inf'), (3, '2')]:
    invalid = [header, list(rows[1])]
    invalid[1][index] = value
    try:
        motion_offset_events(invalid)
        raise AssertionError((index, value))
    except ValueError:
        pass
print('PASS motion offset CSV: names/reordering, millisecond preservation, erase no-op projection, default zero and invalid fields')
