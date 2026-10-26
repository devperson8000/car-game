"""Prepare additional CryHam engine-sim banks, pinned to Stunt Rally 3.

Usage: python3 scripts/prepare-car-engine-audio.py SOURCE_DIR OUTPUT_ROOT
Download the WAVs from SOURCE_BASE below into SOURCE_DIR first.
Requires ffmpeg. Provenance: public/licenses/car-engine-sources.md.
"""
import array
import hashlib
import json
import math
import pathlib
import subprocess
import sys
import tempfile
import wave

REVISION = 'fe3ecd73fff671c3d75ecaeadccea5c5e6afe0d8'
SOURCE_BASE = f'https://raw.githubusercontent.com/stuntrally/stuntrally3/{REVISION}/data/sounds/engines/'
BANKS = {'boxer4': 'su-oe', 'race-v8': 'b-v8'}


def prepare(source, destination):
    for bank, prefix in BANKS.items():
        output_dir = destination / bank
        output_dir.mkdir(parents=True, exist_ok=True)
        manifest = []
        for band in range(1, 9):
            path = source / f'{prefix}-{band}.wav'
            with wave.open(str(path), 'rb') as wav:
                assert wav.getnchannels() == 1 and wav.getsampwidth() == 2
                rate = wav.getframerate()
                pcm = array.array('h', wav.readframes(wav.getnframes()))
            if sys.byteorder != 'little':
                pcm.byteswap()
            values = [x / 32768 for x in pcm]
            dc = sum(values) / len(values)
            values = [x - dc for x in values]
            seam = round(rate * .012)
            values = values[seam:-seam] + [
                values[-seam+i] * (1-i/(seam-1)) + values[i] * i/(seam-1)
                for i in range(seam)
            ]
            rms = math.sqrt(sum(x*x for x in values) / len(values))
            scale = min(.20 / rms, .85 / max(map(abs, values)))
            encoded = array.array('h', (round(x * scale * 32767) for x in values))
            if sys.byteorder != 'little':
                encoded.byteswap()
            output = output_dir / f'{band}.ogg'
            with tempfile.TemporaryDirectory(prefix='apex-car-engine-') as temp:
                temporary = pathlib.Path(temp) / 'loop.wav'
                with wave.open(str(temporary), 'wb') as wav:
                    wav.setnchannels(1)
                    wav.setsampwidth(2)
                    wav.setframerate(rate)
                    wav.writeframes(encoded.tobytes())
                subprocess.run([
                    'ffmpeg', '-v', 'error', '-y', '-fflags', '+bitexact',
                    '-i', str(temporary), '-fflags', '+bitexact', '-map_metadata', '-1', '-c:a',
                    'libvorbis', '-flags:a', '+bitexact', '-q:a', '6', str(output)
                ], check=True)
            manifest.append(dict(
                rpm=band*1000, source_file=path.name,
                source_revision=REVISION, source_url=SOURCE_BASE+path.name,
                source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                ogg_sha256=hashlib.sha256(output.read_bytes()).hexdigest(),
                bytes=output.stat().st_size,
            ))
        (output_dir / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
        print(f'Prepared {bank}: {sum(x["bytes"] for x in manifest):,} bytes')


if __name__ == '__main__':
    prepare(*map(pathlib.Path, sys.argv[1:3]))
