"""Native Foot_Color RGBA, geometric cutoff and immediate erase controls."""
from live_chibi_object_commands import field_map
import math
import re


def addressed_foot_color_events(rows):
    """Preserve global/solo source order; solo targets index the native idol list."""
    fields = field_map(rows[0])
    result = []
    for source_row, row in enumerate(rows[1:], 2):
        def text(name):
            i = fields[name]
            return row[i].strip() if i < len(row) else ''
        kind = text('type')
        if kind not in ('Livechara_Foot_Color', 'Livechara_foot_color_solo'):
            continue
        if kind == 'Livechara_Foot_Color':
            event = foot_color_events([rows[0], row])[0]
            result.append(dict(event, sourceRow=source_row, target=0, solo=False))
            continue
        if text('value101') not in ('', '0', '1'):
            raise ValueError('Invalid solo foot erase flag')
        target = int(text('value1') or 0)
        if target < 0 or target > 5:
            raise ValueError('Invalid solo foot target')
        hide = text('value101') == '1'
        event = dict(time=int(text('time')), sourceRow=source_row, target=target, solo=True, hide=hide,
                     color='#ffffff' if hide else text('value2'), opacity=0 if hide else int(text('value3') or 0),
                     duration=int(text('value102') or 0) if hide else int(text('value4') or 0),
                     cutoff=0 if hide else int(text('value5')))
        if (not re.fullmatch(r'#[0-9a-fA-F]{6}', event['color']) or not 0 <= event['opacity'] <= 1000
                or event['duration'] < 0 or not hide and event['cutoff'] <= 0
                or not all(math.isfinite(v) for v in (event['time'], event['duration'], event['cutoff']))):
            raise ValueError('Invalid solo foot controls')
        result.append(event)
    return sorted(result, key=lambda event: (event['time'], event['sourceRow']))

def foot_color_events(rows):
    fields = field_map(rows[0])
    result = []
    for row in rows[1:]:
        def text(name):
            i = fields[name]
            return row[i].strip() if i < len(row) else ''
        if text('type') != 'Livechara_Foot_Color':
            continue
        hide = text('value101') == '1'
        event = dict(time=int(text('time')), hide=hide)
        if not hide:
            event.update(color=text('value1'), opacity=int(text('value2') or 0),
                         duration=int(text('value3') or 1), cutoff=int(text('value4')))
            if event['cutoff'] <= 0:
                raise ValueError('Unresolved native zero/negative foot cutoff')
        result.append(event)
    return sorted(result, key=lambda event: event['time'])
