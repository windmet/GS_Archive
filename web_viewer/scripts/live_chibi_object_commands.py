"""Object_layer controls are named CSV fields, not fixed column offsets."""


def field_map(header):
    required = ['type', 'time', *[f'value{i}' for i in range(1, 7)], 'value101', 'value102']
    names = [value.strip() for value in header]
    if any(names.count(name) != 1 for name in required):
        raise ValueError('Missing or ambiguous Object_layer CSV header')
    return {name: names.index(name) for name in required}


def parse_object_layer(row, fields):
    def text(name):
        index = fields[name]
        return row[index].strip() if index < len(row) else ''

    def number(name, default=None):
        try:
            return int(float(text(name)))
        except ValueError:
            return default

    if text('type') != 'Object_layer':
        return None
    time, asset = number('time'), text('value1')
    if time is None or not asset:
        return None
    hide = text('value101') == '1'
    return {'time': time, 'asset': asset,
            'duration': number('value102' if hide else 'value2', 1),
            'x': number('value3'), 'y': number('value4'),
            'scale': number('value5'), 'depth': number('value6'), 'hide': hide,
            # Preserve the historical diagnostic column; never interpret it as a control.
            'raw19': row[19].strip() if len(row) > 19 and row[19].strip() else None}


def object_layer_events(rows):
    fields = field_map(rows[0])
    events = [event for row in rows[1:] if (event := parse_object_layer(row, fields))]
    return sorted(events, key=lambda event: (event['time'], event['depth'] or 0, event['asset']))
