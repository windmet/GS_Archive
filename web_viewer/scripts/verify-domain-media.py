#!/usr/bin/env python3
"""Meaningful photo script identity and independent block regressions."""
import importlib.util
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('generator',Path(__file__).with_name('generate-domain-media.py'))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def cmd(kind,*values):
    return dict(Type=kind,Values=list(values))

class PhotoLabelTests(unittest.TestCase):
    def setUp(self):
        self.actor=dict(poses=[dict(id=1,animationName='pose-a'),dict(id=2,animationName='pose-b')],
            faces=[dict(id=3,animationName='face-a')])
        self.commands=[cmd('idol_model','001tom','001tom_002_00'),cmd('idol_position','001tom','0','0'),
            cmd('jump_point','pose-a'),cmd('idol_animation','001tom','0','weight'),
            cmd('jump_point','pose-b'),cmd('idol_animation','001tom','0','surprise'),cmd('idol_neckanimation','001tom','0','neck_question'),
            cmd('jump_point','face-a'),cmd('idol_face','001tom','0','face_joy')]
    def parse(self,commands=None):
        return module.photo_presets(commands or self.commands,self.actor,'scenario.json','a'*64)
    def test_label_is_not_motion(self):
        row=self.parse()['poses:1']
        self.assertEqual(row['motion'],'weight')
        self.assertEqual(row['script']['jumpIndex'],2)
        self.assertEqual(row['commands'][0]['index'],3)
    def test_neck_and_absent_face_are_retained(self):
        row=self.parse()['poses:2']
        self.assertEqual(row['neck'],'neck_question')
        self.assertIsNone(row['face'])
        self.assertEqual(self.parse()['faces:3']['face'],'face_joy')
        self.assertIsNone(self.parse()['faces:3']['motion'])
    def test_previous_selection_does_not_leak(self):
        self.commands.insert(4,cmd('idol_face','001tom','0','face_angry'))
        self.assertEqual(self.parse()['poses:1']['face'],'face_angry')
        self.assertIsNone(self.parse()['poses:2']['face'])
    def test_duplicate_label_is_unresolved(self):
        self.commands.append(cmd('jump_point','pose-a'))
        self.assertEqual(self.parse()['poses:1']['status'],'unresolved-script-label')
    def test_foreign_actor_is_rejected(self):
        self.commands[3]=cmd('idol_animation','002sht','0','weight')
        self.assertEqual(self.parse()['poses:1']['status'],'unsupported-script-block')
    def test_unknown_directive_is_not_dropped(self):
        self.commands.insert(4,cmd('idol_zoom','001tom','2'))
        self.assertEqual(self.parse()['poses:1']['status'],'unsupported-script-block')
    def test_missing_header_model_cannot_be_guessed(self):
        with self.assertRaises(ValueError):
            self.parse(self.commands[1:])

if __name__=='__main__':
    unittest.main()
