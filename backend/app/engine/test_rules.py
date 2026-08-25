import unittest
from rules import HotspotInput, classify_hotspot

class TestClassificationEngine(unittest.TestCase):
    def test_demo_scenario_1_industrial_flare(self):
        # Persistent industrial gas flare
        # Should be <= 1000m, persistent, near refinery
        data = HotspotInput(
            temperature=1200.5,
            frp=45.2,
            confidence='high',
            distance_to_industrial=0, # inside
            days_observed=10,
            observation_count=24,
            industrial_zone_type='Refinery'
        )
        result = classify_hotspot(data)
        self.assertEqual(result.classification, "industrial_fire_flare")
        self.assertEqual(result.subclass, "gas_flare")
        self.assertEqual(result.confidence, "high")
        self.assertIn("Distance to industrial zone is 0", result.evidence[0])

    def test_demo_scenario_2_natural_vegetation(self):
        # Natural vegetation fire
        # Far away (>2km), not persistent
        data = HotspotInput(
            temperature=600.0,
            frp=12.5,
            confidence='nominal',
            distance_to_industrial=8473.0, # As calculated by PostGIS earlier
            days_observed=1,
            observation_count=1,
            industrial_zone_type=None
        )
        result = classify_hotspot(data)
        self.assertEqual(result.classification, "natural_vegetation")
        self.assertEqual(result.subclass, "wildfire")
        self.assertEqual(result.confidence, "nominal")
        self.assertIn("Distance to industrial zone is 8473.0", result.evidence[0])

    def test_demo_scenario_3_unknown_uncertain(self):
        # Unknown/uncertain hotspot
        # ~1927m away, between 1km and 2km -> unknown
        data = HotspotInput(
            temperature=400.0,
            frp=5.0,
            confidence='low',
            distance_to_industrial=1927.0, # As calculated by PostGIS earlier
            days_observed=2,
            observation_count=2,
            industrial_zone_type=None
        )
        result = classify_hotspot(data)
        self.assertEqual(result.classification, "unknown_uncertain")
        self.assertEqual(result.confidence, "low")
        self.assertTrue(any("buffer zone" in ev for ev in result.evidence))
        
    def test_conflicting_evidence_returns_unknown(self):
        # Near industrial, but not persistent
        data = HotspotInput(
            temperature=300.0,
            frp=2.0,
            confidence='nominal',
            distance_to_industrial=500.0,
            days_observed=1,
            observation_count=1,
            industrial_zone_type='Refinery'
        )
        result = classify_hotspot(data)
        self.assertEqual(result.classification, "unknown_uncertain")
        self.assertTrue(any("Conflicting evidence" in ev for ev in result.evidence))

if __name__ == '__main__':
    unittest.main()
