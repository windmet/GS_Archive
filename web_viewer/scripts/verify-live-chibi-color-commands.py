"""Regression for color-plane identity and named control columns."""
import unittest
from live_chibi_color_commands import color_layer_events


class ColorCommands(unittest.TestCase):
    def rows(self, expanded=False):
        header = ['type', 'time', *[f'value{i}' for i in range(1, 18 if expanded else 16)],
                  'value101', 'value102', 'comment']
        def row(**values):
            return [str(values.get(key, '')) for key in header]
        return header, row

    def test_headers_and_comments(self):
        for expanded in [False, True]:
            h, r = self.rows(expanded)
            events = color_layer_events([h,
                r(type='Whole_screen_color_2', time=-2000, value1=3, value2='#221d23',
                  value3=700, value4=1, value5=1710, comment='1'),
                r(type='Whole_screen_color_2', time=100, value1=3,
                  value101=1, value102=500)])
            self.assertEqual(events[0], {'time':-2000,'id':3,'color':'#221d23',
                'opacity':700,'duration':1,'depth':1710,'hide':False})
            self.assertTrue(events[1]['hide'])
            self.assertEqual(events[1]['duration'], 500)

    def test_simultaneous_layers_and_partial_updates(self):
        h, r = self.rows()
        events = color_layer_events([h,
            r(type='Whole_screen_color_2',time=0,value1=2,value2='#FFFFFF',value3=0,value4=1),
            r(type='Whole_screen_color_2',time=0,value1=1,value4=200),
            r(type='#Whole_screen_color_2',time=0,value1=3)])
        self.assertEqual([event['id'] for event in events], [2, 1])
        self.assertIsNone(events[1]['color'])
        self.assertIsNone(events[1]['opacity'])

    def test_invalid_source_fails(self):
        h, r = self.rows()
        for values in [{'value1':0}, {'value3':1001}, {'value2':'white'},
                       {'time':'NaN'}, {'value4':-1}, {'value1':1.2}]:
            with self.assertRaises(ValueError):
                color_layer_events([h, r(**dict({'type':'Whole_screen_color_2',
                    'time':0,'value1':1,'value2':'#ffffff','value3':700}, **values))])

    def test_hide_keeps_unused_raw_color(self):
        h, r = self.rows()
        event = color_layer_events([h, r(type='Whole_screen_color_2',time=59500,
            value1=18,value2='#71A4D10',value101=1,value102=500)])[0]
        self.assertEqual(event['color'], '#71A4D10')
        self.assertTrue(event['hide'])
        self.assertEqual(event['duration'], 500)

    def test_unaddressed_hide_is_preserved_as_unresolved(self):
        h, r = self.rows()
        event = color_layer_events([h, r(type='Whole_screen_color_2',time=16200,
            value101=1,value102=0)])[0]
        self.assertIsNone(event['id'])
        self.assertEqual(event['unresolvedReason'], 'missing_layer_identity')


if __name__ == '__main__':
    unittest.main()
