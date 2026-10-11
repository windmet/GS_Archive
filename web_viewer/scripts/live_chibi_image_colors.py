"""Image_color addresses original stage image names; controls are named CSV fields."""
import math
import re
from live_chibi_object_commands import field_map


def image_color_events(rows):
    fields = field_map(rows[0])
    result = []
    for row in rows[1:]:
        def text(name):
            index = fields[name]
            return row[index].strip() if index < len(row) else ''

        def number(name, default=None):
            raw = text(name)
            if not raw:
                return default
            value = float(raw)
            if not math.isfinite(value) or not value.is_integer():
                raise ValueError('Invalid image-color integer: ' + name)
            return int(value)

        if text('type') != 'Image_color':
            continue
        time, asset = number('time'), text('value1')
        hide = text('value101') == '1'
        color, opacity = text('value2') or None, number('value3')
        duration = number('value102' if hide else 'value4', 1)
        if time is None or not asset or duration < 0:
            raise ValueError('Invalid image-color target/interval')
        event = {'time': time, 'asset': asset, 'color': color,
                 'opacity': opacity, 'duration': duration, 'hide': hide}
        reasons = []
        if asset.startswith('#'):
            reasons.append('invalid_image_asset')
        if not hide:
            if opacity is None or not 0 <= opacity <= 1000:
                reasons.append('invalid_opacity')
            if not re.fullmatch(r'#[0-9a-fA-F]{6}', color or ''):
                reasons.append('invalid_rgb_color')
        if reasons:
            event['unresolvedReason'] = 'invalid_image_color_command'
            event['unresolvedFields'] = reasons
        result.append(event)
    return sorted(result, key=lambda event: event['time'])
