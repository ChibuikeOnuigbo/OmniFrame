#!/usr/bin/env python3
"""Regression checks for tempo-alias handling in voice_realtrack_study.py."""
import unittest

from voice_realtrack_study import strongest_octave_alias


class TempoAliasTests(unittest.TestCase):
    def test_strong_half_time_candidate_blocks_normal_speed_claim(self):
        candidates = [(117.5, 0.80), (59.0, 0.76), (39.0, 0.69)]
        alias = strongest_octave_alias(candidates)
        self.assertIsNotNone(alias)
        self.assertEqual(alias, (candidates[0], candidates[1]))

    def test_weak_octave_candidate_does_not_block_primary_estimate(self):
        candidates = [(120.0, 0.80), (60.0, 0.35), (92.0, 0.30)]
        self.assertIsNone(strongest_octave_alias(candidates))

    def test_non_octave_peak_is_not_treated_as_alias(self):
        candidates = [(120.0, 0.80), (80.0, 0.75), (57.0, 0.72)]
        self.assertIsNone(strongest_octave_alias(candidates))

    def test_empty_candidate_list(self):
        self.assertIsNone(strongest_octave_alias([]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
