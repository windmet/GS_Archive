import unittest
from live_chibi_object_commands import field_map, parse_object_layer


class ObjectControlTests(unittest.TestCase):
    def event(self, extra=0, hide='1', duration='200', comment=''):
        header = ['type', 'time', *[f'value{i}' for i in range(1, 16 + extra)], 'value101', 'value102', 'コメント']
        row = [''] * len(header)
        for name, value in {'type': 'Object_layer', 'time': '85600', 'value1': 'fx_window',
                            'value101': hide, 'value102': duration, 'コメント': comment}.items():
            row[header.index(name)] = value
        return parse_object_layer(row, field_map(header))

    def test_old_and_extended_headers_share_hide_semantics(self):
        for extra in (0, 2):
            event = self.event(extra)
            self.assertTrue(event['hide'])
            self.assertEqual(event['duration'], 200)
            self.assertIsNone(event['x'])

    def test_comment_one_is_never_a_hide_control(self):
        self.assertFalse(self.event(comment='1', hide='')['hide'])
        self.assertEqual(self.event(comment='1', hide='')['duration'], 1)

    def test_missing_and_duplicate_controls_fail_closed(self):
        for header in (['type', 'time'], ['type', 'time', *[f'value{i}' for i in range(1, 7)],
                                        'value101', 'value101', 'value102']):
            with self.assertRaises(ValueError):
                field_map(header)


if __name__ == '__main__':
    unittest.main()
