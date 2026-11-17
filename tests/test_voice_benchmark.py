import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('voice_benchmark', Path(__file__).resolve().parents[1] / 'diagnostics/benchmark-voices.py')
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)


class VoiceBenchmarkTests(unittest.TestCase):
    def test_valid_audio_has_real_duration_and_energy(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'voice.wav'
            benchmark.write_pcm(path, [0.2, -0.2] * 11025, 22050)
            result = benchmark.audio_metrics(path)
            self.assertEqual(result['audio_seconds'], 1)
            self.assertGreater(result['rms'], 0.19)

    def test_empty_and_silent_audio_are_not_success(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'voice.wav'
            for values in [[], [0] * 100]:
                benchmark.write_pcm(path, values, 22050)
                with self.assertRaises(ValueError):
                    benchmark.audio_metrics(path)

    def test_nonfinite_model_output_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                benchmark.write_pcm(Path(folder) / 'voice.wav', [0, float('nan')], 22050)

    def test_sample_paths_and_duplicate_ids_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'samples.json'
            for samples in [[{'id': '../secret', 'text': 'a'}], [{'id': 'a', 'text': 'a'}, {'id': 'a', 'text': 'b'}]]:
                path.write_text(json.dumps(samples))
                with self.assertRaises(ValueError):
                    benchmark.samples_from(path)


if __name__ == '__main__':
    unittest.main()
