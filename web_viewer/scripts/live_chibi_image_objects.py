"""Named ImageObject fields; unproven show value6 is retained, not interpreted."""
import math


def image_object_events(rows):
    names = [name.strip() for name in rows[0]]
    required = ['type', 'time', *[f'value{i}' for i in range(1, 10)], 'value101', 'value102']
    if any(names.count(name) != 1 for name in required):
        raise ValueError('Missing or ambiguous ImageObject header')
    fields = {name: names.index(name) for name in required}
    result = []
    for row in rows[1:]:
        def text(name):
            index = fields[name]
            return row[index].strip() if index < len(row) else ''

        def number(name, default=None):
            value = text(name)
            if not value:
                return default
            parsed = float(value)
            if not math.isfinite(parsed):
                raise ValueError(f'Non-finite {name}')
            return parsed

        kind = text('type')
        if kind not in ('ImageObject_create', 'ImageObject_show'):
            continue
        time, identity = number('time'), number('value1')
        if time is None or identity is None or identity <= 0 or not identity.is_integer():
            raise ValueError('Missing ImageObject time/identity')
        event = {'time': time, 'id': int(identity)}
        if kind == 'ImageObject_create':
            asset = text('value2')
            if not asset:
                raise ValueError('Missing ImageObject asset')
            hide = text('value101') == '1'
            event.update({'type': 'hide' if hide else 'create', 'asset': asset})
            if hide:
                event['duration'] = number('value102', 0)
                if event['duration'] < 0:
                    raise ValueError('Negative ImageObject hide interval')
            else:
                for field, column in [('opacity', 3), ('scaleX', 4), ('scaleY', 5),
                                      ('rotation', 6), ('x', 7), ('y', 8), ('depth', 9)]:
                    event[field] = number(f'value{column}')
                    if event[field] is None:
                        raise ValueError(f'Missing ImageObject {field}')
        else:
            event.update({'type': 'show', 'delay': number('value2', 0),
                          'fadeIn': number('value3', 0), 'hold': number('value4', 0),
                          'fadeOut': number('value5', 0), 'rawValue6': text('value6')})
            if any(event[field] < 0 for field in ('delay', 'fadeIn', 'hold', 'fadeOut')):
                raise ValueError('Negative ImageObject show interval')
        result.append(event)
    return sorted(result, key=lambda event: event['time'])
