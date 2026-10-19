"""Named Penlight CSV projection from native executers and ARM64 call registers.

Penlight_unit and Penlight_unit_color share PlayEffectUnitAndMain; the latter
splits value11 at '&'. Erase is ResetColor, not object deletion or opacity fade.
"""
import math

COMMANDS = ('Penlight', 'Penlight_unit', 'Penlight_unit_color')


def penlight_events(rows):
    if not rows:
        raise ValueError('Missing Penlight CSV header')
    header = [name.strip() for name in rows[0]]
    required = ['type', 'time'] + [f'value{i}' for i in range(1, 11)] + ['value101']
    if any(header.count(name) != 1 for name in required):
        raise ValueError('Missing or ambiguous Penlight header')
    optional = [f'value{i}' for i in range(11, 18)]
    if any(header.count(name) > 1 for name in optional):
        raise ValueError('Ambiguous optional Penlight color header')
    fields = {name: header.index(name) for name in required + optional if name in header}
    result = []
    for source_row, row in enumerate(rows[1:], 2):
        def text(name):
            index = fields.get(name)
            return row[index].strip() if index is not None and index < len(row) else ''
        command = text('type')
        if command not in COMMANDS:
            continue
        def number(name, integer=False):
            raw = text(name)
            try:
                value = float(raw) if raw else 0.0
            except ValueError as error:
                raise ValueError(f'Invalid {command} {name} at row {source_row}') from error
            if not math.isfinite(value) or integer and not value.is_integer():
                raise ValueError(f'Invalid {command} {name} at row {source_row}')
            return int(value) if integer else value
        flag = text('value101')
        if not text('time') or not text('value1') or flag not in ('', '0', '1'):
            raise ValueError(f'Invalid {command} identity/time/erase at row {source_row}')
        prefab = text('value2')
        event = {'time': number('time'), 'sourceRow': source_row, 'command': command,
                 'id': text('value1'), 'prefab': f'LiveObjectPenlight_{prefab}', 'erase': flag == '1'}
        if not event['erase']:
            unit = command != 'Penlight'
            event.update(animationType=number('value3', True), animationId=number('value4', True),
                         speed=number('value5') / 1000,
                         x=number('value6' if unit else 'value7', True),
                         y=number('value7' if unit else 'value8', True),
                         scale=number('value8' if unit else 'value9') / 1000,
                         depth=number('value9' if unit else 'value10', True))
            if unit:
                event['colorMode'] = number('value10', True)
                event['colors'] = text('value11').split('&') if command == 'Penlight_unit_color' else [text(f'value{i}') for i in range(11, 18)]
            else:
                event['color'] = text('value6')
        result.append(event)
    return sorted(result, key=lambda event: (event['time'], event['sourceRow']))
