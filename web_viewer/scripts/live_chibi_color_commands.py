"""Named-field parsing for independently addressed Whole_screen_color_2 planes."""
import math
import re
from live_chibi_object_commands import field_map


def parse_color_layer(row, fields):
    def text(name):
        index = fields[name]
        return row[index].strip() if index < len(row) else ''

    def number(name, default=None):
        raw = text(name)
        if not raw:
            return default
        value = float(raw)
        if not math.isfinite(value) or not value.is_integer():
            raise ValueError(f'Invalid integer {name}')
        return int(value)

    if text('type') != 'Whole_screen_color_2':
        return None
    time, layer = number('time'), number('value1')
    hide = text('value101') == '1'
    if time is None or (layer is None and not hide) or (layer is not None and layer <= 0):
        raise ValueError('Missing color-plane time/identity')
    color = text('value2') or None
    # Hide only consumes identity and fade duration. Keep unused source text
    # (including authored typos) as evidence; do not render or silently repair it.
    if not hide and color is not None and not re.fullmatch(r'#[0-9a-fA-F]{6}', color):
        raise ValueError('Invalid color-plane RGB')
    opacity = number('value3')
    if opacity is not None and not 0 <= opacity <= 1000:
        raise ValueError('Invalid color-plane opacity')
    duration = number('value102' if hide else 'value4', 1)
    if duration < 0:
        raise ValueError('Negative color-plane transition')
    event = {'time': time, 'id': layer, 'color': color, 'opacity': opacity,
             'duration': duration, 'depth': number('value5'), 'hide': hide}
    if layer is None:
        event['unresolvedReason'] = 'missing_layer_identity'
    return event


def color_layer_events(rows):
    fields = field_map(rows[0])
    events = [event for row in rows[1:] if (event := parse_color_layer(row, fields))]
    # Python's stable sort preserves authored order for simultaneous events.
    return sorted(events, key=lambda event: event['time'])
