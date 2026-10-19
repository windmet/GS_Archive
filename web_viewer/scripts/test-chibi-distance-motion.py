"""Fail-closed motion-profile tests; RAW regeneration separately checks real assets."""
import copy
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest

spec=importlib.util.spec_from_file_location('emitters',Path(__file__).with_name('prepare-chibi-object-emitters.py'))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class MotionProofTests(unittest.TestCase):
    def setUp(self):
        ref=lambda n:dict(m_FileID=0,m_PathID=n)
        self.trees={
            1:dict(m_GameObject=ref(2),m_Children=[]),
            2:dict(m_Component=[dict(component=ref(1)),dict(component=ref(3)),dict(component=ref(5))]),
            3:dict(m_Script=ref(4)),
            4:dict(m_ClassName='LiveObjectObjectLayerRefKeeper',m_Namespace='Growing.Live',m_AssemblyName='Assembly-CSharp.dll'),
            5:{},6:{},
        }
        self.objects={n:SimpleNamespace(path_id=n,type=SimpleNamespace(name=kind),read_typetree=lambda n=n:self.trees[n])
                      for n,kind in [(1,'Transform'),(2,'GameObject'),(3,'MonoBehaviour'),(4,'MonoScript'),(5,'ParticleSystem'),(6,'Animator')]}
        self.env=SimpleNamespace(objects=list(self.objects.values()))
        self.audit=SimpleNamespace(local_object=lambda owner,p,kind:self.objects[p['m_PathID']],
                                   source_ref=lambda o:dict(pathId=str(o.path_id),type=o.type.name),json_hash=lambda t:repr(t))
        self.record=dict(asset='test',keeper=dict(pathId='3'),rootTransformChain=[dict(pathId='1',parent=dict(fileId=0,pathId='0'))])
        self.event=dict(asset='test',hide=False,x=0,y=0,scale=1)
        self.choreography=dict(songs=[dict(id='test',objectLayerEvents=[self.event,dict(asset='test',hide=True)])])

    def proof(self):
        return module.stationary_distance_proof(self.record,self.env,self.audit,self.choreography)

    def test_stationary_hierarchy_is_admitted(self):
        self.assertEqual(self.proof()['profile'],'stationary-object-layer-v1')

    def test_repeated_show_requires_motion_history(self):
        self.choreography['songs'][0]['objectLayerEvents'].append(copy.deepcopy(self.event))
        with self.assertRaisesRegex(ValueError,'motion/repeated Play'):self.proof()

    def test_animator_is_not_silently_treated_as_stationary(self):
        self.trees[2]['m_Component'].append(dict(component=dict(m_FileID=0,m_PathID=6)))
        with self.assertRaisesRegex(ValueError,'Animated or scripted'):self.proof()

    def test_unknown_keeper_namespace_is_rejected(self):
        self.trees[4]['m_Namespace']='Other'
        with self.assertRaisesRegex(ValueError,'Unknown keeper'):self.proof()

    def test_external_parent_is_rejected(self):
        self.record['rootTransformChain'][0]['parent']['pathId']='999'
        with self.assertRaisesRegex(ValueError,'External emitter parent'):self.proof()


if __name__=='__main__':unittest.main()
