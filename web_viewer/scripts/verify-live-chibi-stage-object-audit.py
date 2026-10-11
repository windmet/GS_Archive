"""Verify serialized-file identity isolation and lossless audit boundaries."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest

spec = importlib.util.spec_from_file_location(
    "stage_object_audit", Path(__file__).with_name("audit-live-chibi-stage-objects.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class IdentityTests(unittest.TestCase):
    def test_file_scope_and_external_reference(self):
        path_id = 8016511438745583967
        material = SimpleNamespace(type=SimpleNamespace(name="Material"))
        impostor = SimpleNamespace(type=SimpleNamespace(name="Texture2D"))
        first = SimpleNamespace(assets_file=SimpleNamespace(objects={path_id: material}))
        second = SimpleNamespace(assets_file=SimpleNamespace(objects={path_id: impostor}))
        ptr = {"m_FileID": 0, "m_PathID": path_id}
        self.assertIs(audit.local_object(first, ptr, "Material"), material)
        self.assertIsNone(audit.local_object(second, ptr, "Material"))
        self.assertIsNone(audit.local_object(first, {**ptr, "m_FileID": 1}, "Material"))

    def test_large_path_ids_survive_json_consumers(self):
        path_id = 8016511438745583967
        value = {"slots": [{"m_PathID": path_id, "m_FileID": 2}], "size": 4.25}
        safe = audit.stringify_path_ids(value)
        self.assertEqual(safe["slots"][0]["m_PathID"], str(path_id))
        self.assertEqual(safe["slots"][0]["m_FileID"], 2)
        self.assertEqual(value["slots"][0]["m_PathID"], path_id)

    def test_unresolved_shader_keeps_exact_external_identity(self):
        owner = SimpleNamespace(assets_file=SimpleNamespace(objects={}, externals=[
            SimpleNamespace(path="archive:/CAB-source/CAB-source", guid=b"\x01" * 16)]))
        result = audit.reference(owner, {"m_FileID": 1, "m_PathID": -4808288818266491244}, "Shader")
        self.assertEqual(result["status"], "external_unresolved")
        self.assertEqual(result["externalPath"], "archive:/CAB-source/CAB-source")
        self.assertNotIn("name", result)
        self.assertEqual(result["pathId"], "-4808288818266491244")

    def test_curve_tangents_are_bound_even_in_summary_mode(self):
        original = {"enabled": True, "startLifetime": {"minMaxState": 1, "scalar": 1,
                    "maxCurve": {"m_Curve": [{"time": 0, "value": 1, "outSlope": 2}]}}}
        changed = {"enabled": True, "startLifetime": {"minMaxState": 1, "scalar": 1,
                   "maxCurve": {"m_Curve": [{"time": 0, "value": 1, "outSlope": 3}]}}}
        self.assertNotEqual(audit.module_summary(original)["parametersSha256"],
                            audit.module_summary(changed)["parametersSha256"])

    def test_external_resolution_requires_cab_and_path_id(self):
        shader = SimpleNamespace(type=SimpleNamespace(name="Shader"), path_id=44,
                                 assets_file=SimpleNamespace(name="CAB-exact"),
                                 read_typetree=lambda: {"m_ParsedForm": {"m_Name": "Masked/Additive"}})
        dependency = SimpleNamespace(objects={44: shader})
        owner = SimpleNamespace(assets_file=SimpleNamespace(objects={}, externals=[
            SimpleNamespace(path="archive:/CAB-exact/CAB-exact", guid=b"\x00" * 16)]))
        ptr = {"m_FileID": 1, "m_PathID": 44}
        wrong = audit.reference(owner, ptr, "Shader", {"CAB-other": dependency})
        self.assertEqual(wrong["status"], "external_unresolved")
        exact = audit.reference(owner, ptr, "Shader", {"CAB-exact": dependency})
        self.assertEqual(exact["status"], "resolved_dependency")
        self.assertEqual(exact["name"], "Masked/Additive")
        absent = audit.reference(owner, {**ptr, "m_PathID": 45}, "Shader", {"CAB-exact": dependency})
        self.assertEqual(absent["status"], "external_unresolved")


if __name__ == "__main__":
    unittest.main()
