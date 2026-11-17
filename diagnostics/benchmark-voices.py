#!/usr/bin/env python3
"""Optional local voice experiment. Does not read games or modify the extension.

Standard-library backend: macOS say + afconvert.
Optional backend: chatterbox-tts (model download occurs only when requested).
"""
import argparse
import array
import importlib.metadata
import json
import math
import platform
import subprocess
import sys
import time
import wave
from pathlib import Path


def audio_metrics(path):
    with wave.open(str(path), 'rb') as audio:
        if audio.getsampwidth() != 2 or audio.getcomptype() != 'NONE':
            raise ValueError('16-bit PCM WAV gerekli')
        rate = audio.getframerate()
        frames = audio.getnframes()
        pcm = array.array('h', audio.readframes(frames))
    if sys.byteorder != 'little':
        pcm.byteswap()
    if not frames or not pcm or rate <= 0:
        raise ValueError('Ses dosyası boş')
    rms = math.sqrt(sum(value * value for value in pcm) / len(pcm)) / 32768
    if rms < 0.0001:
        raise ValueError('Üretilen ses sessiz veya sessize çok yakın')
    return {'audio_seconds': frames / rate, 'sample_rate': rate, 'rms': rms,
            'peak': max(abs(value) for value in pcm) / 32768}


def write_pcm(path, values, rate):
    samples = []
    for value in values:
        value = float(value)
        if not math.isfinite(value):
            raise ValueError('Model sonlu olmayan ses örneği üretti')
        samples.append(round(max(-1, min(1, value)) * 32767))
    pcm = array.array('h', samples)
    if sys.byteorder != 'little':
        pcm.byteswap()
    with wave.open(str(path), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(pcm.tobytes())


def samples_from(path):
    samples = json.loads(path.read_text())
    if not isinstance(samples, list) or not samples:
        raise ValueError('Örnek listesi boş')
    ids = set()
    for item in samples:
        key = item.get('id', '')
        if not key or any(char not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for char in key) or key in ids:
            raise ValueError('Örnek kimliği geçersiz veya tekrar ediyor')
        if not isinstance(item.get('text'), str) or not 1 <= len(item['text']) <= 500:
            raise ValueError('Örnek metni 1–500 karakter olmalı')
        ids.add(key)
    return samples


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend', required=True, choices=['system', 'chatterbox'])
    parser.add_argument('--device', default='cpu', choices=['cpu', 'mps', 'cuda'])
    parser.add_argument('--voice', default='Yelda (Türkçe (Türkiye))')
    parser.add_argument('--output', type=Path, default=Path('release/voice-comparison'))
    parser.add_argument('--samples', type=Path, default=Path(__file__).with_name('voice-samples.json'))
    parser.add_argument('--validate-only', action='store_true')
    args = parser.parse_args(argv)
    samples = samples_from(args.samples)
    if args.validate_only:
        print(json.dumps({'backend': args.backend, 'samples': len(samples), 'device': args.device, 'validated': True}))
        return 0
    args.output.mkdir(parents=True, exist_ok=True)
    report = {'schema': 1, 'backend': args.backend, 'device': args.device if args.backend == 'chatterbox' else 'macOS-say',
              'voice': args.voice if args.backend == 'system' else 'Chatterbox Multilingual default',
              'python': platform.python_version(), 'platform': platform.platform(), 'rows': [],
              'note': 'Üretim süresi tüm cümleyi üretme süresidir; Chrome başlangıç gecikmesi veya duyulduğu anlamına gelmez.'}
    start = time.perf_counter()
    model = None
    try:
        if args.backend == 'system':
            if platform.system() != 'Darwin':
                raise RuntimeError('system arka ucu yalnızca macOS içindir')
        else:
            import torch
            from chatterbox.mtl_tts import ChatterboxMultilingualTTS
            report['chatterbox_version'] = importlib.metadata.version('chatterbox-tts')
            torch.manual_seed(42)
            model = ChatterboxMultilingualTTS.from_pretrained(device=args.device)
        report['model_load_seconds'] = time.perf_counter() - start
        # Repeat the first text at the end, distinguishing cold/warm generation.
        for index, item in enumerate(samples + [{**samples[0], 'id': samples[0]['id'] + '-warm'}]):
            filename = f"{args.backend}-{item['id']}.wav"
            path = args.output / filename
            row = {**item, 'file': filename, 'phase': 'cold' if index == 0 else 'warm'}
            started = time.perf_counter()
            try:
                if args.backend == 'system':
                    intermediate = args.output / f".{args.backend}-{item['id']}.aiff"
                    try:
                        subprocess.run(['say', '-v', args.voice, '-o', str(intermediate), item['text']], check=True, capture_output=True, timeout=90)
                        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16', str(intermediate), str(path)], check=True, capture_output=True, timeout=30)
                    finally:
                        intermediate.unlink(missing_ok=True)
                else:
                    audio = model.generate(item['text'], language_id='tr')
                    write_pcm(path, audio.detach().cpu().reshape(-1).tolist(), model.sr)
                row['generation_seconds'] = time.perf_counter() - started
                row.update(audio_metrics(path))
                row['real_time_factor'] = row['generation_seconds'] / row['audio_seconds']
                row['status'] = 'generated'
            except Exception as error:
                path.unlink(missing_ok=True)
                row['status'] = 'error'
                row['error'] = str(error)[:350]
            report['rows'].append(row)
            print(item['id'] + ': ' + row['status'])
    except Exception as error:
        report['error'] = str(error)[:350]
    target = args.output / f'report-{args.backend}.json'
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(target.resolve())
    return 0 if report['rows'] and all(row['status'] == 'generated' for row in report['rows']) else 1


if __name__ == '__main__':
    raise SystemExit(main())
