"""Native Foot_Color RGBA, geometric cutoff and immediate erase controls."""
from live_chibi_object_commands import field_map

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
