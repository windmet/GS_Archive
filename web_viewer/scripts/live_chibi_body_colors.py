"""Named Livechara_body_color controls address performer slots, not screen order."""
import math
import re
from live_chibi_object_commands import field_map


def parse_body_color(row, fields):
    def text(name):
        index = fields[name]
        return row[index].strip() if index < len(row) else ''

    def number(name, default=None):
        raw = text(name)
        if not raw:
            return default
        value = float(raw)
        if not math.isfinite(value) or not value.is_integer():
            raise ValueError('Invalid body-color integer: ' + name)
        return int(value)

    if text('type') != 'Livechara_body_color':
        return None
    time, slot = number('time'), number('value1')
    hide = text('value101') == '1'
    if time is None or slot is None or slot <= 0:
        raise ValueError('Missing body-color time/performer slot')
    color = text('value2') or None
    opacity = number('value3')
    duration = number('value102' if hide else 'value4', 1)
    if duration < 0 or (not hide and (not re.fullmatch(r'#[0-9a-fA-F]{6}', color or '')
                                    or opacity is None or not 0 <= opacity <= 1000)):
        raise ValueError('Invalid body-color target/interval')
    return {'time': time, 'performerSlot': slot, 'color': color,
            'opacity': opacity, 'duration': duration, 'hide': hide}


def body_color_events(rows, stage_positions):
    fields = field_map(rows[0])
    events = [event for row in rows[1:] if (event := parse_body_color(row, fields))]
    for event in events:
        if event['performerSlot'] not in stage_positions:
            raise ValueError('Unmapped body-color performer slot')
        event['stagePosition'] = stage_positions[event['performerSlot']]
    return sorted(events, key=lambda event: event['time'])
