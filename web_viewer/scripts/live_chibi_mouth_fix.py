"""Project native Livechara_mouth_shape_fix by named CSV fields."""
import math


def mouth_fix_events(rows):
    required = ('type', 'time', 'value1', 'value2', 'value3', 'value101', 'value102')
    if not rows:
        raise ValueError('Missing mouth fix header')
    header = [cell.strip() for cell in rows[0]]
    if any(header.count(field) != 1 for field in required):
        raise ValueError('Missing or ambiguous mouth fix header')
    columns = {field: header.index(field) for field in required}
    events = []
    for source_row, row in enumerate(rows[1:], 2):
        def text(field):
            index = columns[field]
            return row[index].strip() if index < len(row) else ''
        if text('type') != 'Livechara_mouth_shape_fix':
            continue
        def number(field):
            value = float(text(field) or 0)
            if not math.isfinite(value):
                raise ValueError('Invalid mouth fix ' + field)
            return value
        if not text('time') or text('value101') not in ('', '0', '1'):
            raise ValueError('Invalid mouth fix time/erase flag')
        target = number('value1')
        if not target.is_integer() or target < 0:
            raise ValueError('Invalid mouth fix target')
        erase = text('value101') == '1'
        duration = number('value102' if erase else 'value3')
        if duration < 0:
            raise ValueError('Negative mouth fix duration')
        event = {'time': number('time'), 'sourceRow': source_row, 'target': int(target),
                 'erase': erase, 'duration': duration}
        if not erase:
            event['openRate'] = number('value2') / 1000
        events.append(event)
    return sorted(events, key=lambda event: (event['time'], event['sourceRow']))
