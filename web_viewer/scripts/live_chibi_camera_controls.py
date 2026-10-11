"""Preserve camera erase controls by CSV field name, without changing motion fields."""
import math


def camera_controls(rows):
    required = ('type', 'time', 'value101', 'value102')
    header = [name.strip() for name in rows[0]]
    if any(header.count(name) != 1 for name in required):
        raise ValueError('Missing or ambiguous camera control header')
    fields = {name: header.index(name) for name in required}
    controls = []
    for row in rows[1:]:
        def text(name):
            index = fields[name]
            return row[index].strip() if index < len(row) else ''
        if text('type') != 'Camera':
            continue
        def integer(name, default=None):
            raw = text(name)
            if not raw:
                return default
            value = float(raw)
            if not math.isfinite(value) or not value.is_integer():
                raise ValueError('Invalid camera control: ' + name)
            return int(value)
        time = integer('time')
        flag = text('value101')
        if time is None or flag not in ('', '0', '1'):
            raise ValueError('Invalid camera time or erase flag')
        erase = flag == '1'
        duration = integer('value102', 1) if erase else 0
        if duration < 0:
            raise ValueError('Negative camera reset duration')
        controls.append({'time': time, 'reset': erase, 'resetDuration': duration})
    return sorted(controls, key=lambda item: item['time'])
