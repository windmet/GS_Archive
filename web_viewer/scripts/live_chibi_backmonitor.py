"""Preserve Backmonitor controls without assigning unproven alpha semantics."""

def parse_backmonitor_row(row):
    if len(row) < 9 or row[0] != 'Backmonitor':
        return None
    def number(index):
        try:
            text = row[index].strip()
            return int(float(text)) if text else None
        except (AttributeError, TypeError, ValueError, OverflowError):
            return None
    time = number(1)
    if time is None:
        return None
    return dict(time=time, movie=row[2].strip() or None,
                transition=row[3].strip() or None, x=number(4), y=number(5),
                scale=number(6), rawValue6=number(7), rawValue7=number(8))
