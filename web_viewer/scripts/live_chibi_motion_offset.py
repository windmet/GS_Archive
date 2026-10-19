"""Native danceStartOffset assignment, not authored-motion or XY displacement."""
import math


def motion_offset_events(rows):
    required = ('type', 'time', 'value1', 'value101')
    if not rows:
        raise ValueError('Missing motion offset header')
    header = [cell.strip() for cell in rows[0]]
    if any(header.count(field) != 1 for field in required):
        raise ValueError('Missing or ambiguous motion offset header')
    columns = {field: header.index(field) for field in required}
    events = []
    for source_row, row in enumerate(rows[1:], 2):
        def text(field):
            index = columns[field]
            return row[index].strip() if index < len(row) else ''
        if text('type') != 'Livechara_Offset':
            continue
        if not text('time') or text('value101') not in ('', '0', '1'):
            raise ValueError('Invalid motion offset time/erase flag')
        time = float(text('time'))
        erase = text('value101') == '1'
        value = float(text('value1') or 0) if not erase else 0
        if not math.isfinite(time) or not math.isfinite(value):
            raise ValueError('Invalid motion offset number')
        event = {'time': time, 'sourceRow': source_row, 'erase': erase}
        if not erase:
            event['offsetMs'] = value
        events.append(event)
    return sorted(events, key=lambda event: (event['time'], event['sourceRow']))
