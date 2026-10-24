"""Prepare CryHam V8 WAV bands (v8f-1.wav … v8f-8.wav) as normalized Ogg loops.
Usage: python3 scripts/prepare-engine-audio.py SOURCE_DIR OUTPUT_DIR
Upstream provenance is in public/licenses/v8-source.md. Requires ffmpeg.
"""
import array, hashlib, json, math, pathlib, subprocess, sys, tempfile, wave
source, destination = map(pathlib.Path, sys.argv[1:3]); destination.mkdir(parents=True, exist_ok=True)
manifest = []
for band in range(1, 9):
    path = source / f'v8f-{band}.wav'
    with wave.open(str(path), 'rb') as wav:
        assert wav.getnchannels() == 1 and wav.getsampwidth() == 2
        rate = wav.getframerate(); pcm = array.array('h', wav.readframes(wav.getnframes()))
    values = [x / 32768 for x in pcm]; dc = sum(values) / len(values); values = [x - dc for x in values]
    seam = round(rate * .012)
    # Last 12 ms crossfades into the first 12 ms; playback resumes at sample seam.
    values = values[seam:-seam] + [values[-seam+i]*(1-i/(seam-1)) + values[i]*i/(seam-1) for i in range(seam)]
    rms = math.sqrt(sum(x*x for x in values) / len(values))
    scale = min(.20 / rms, .85 / max(map(abs, values)))
    encoded = array.array('h', (round(x * scale * 32767) for x in values))
    with tempfile.TemporaryDirectory(prefix='apex-v8-') as temp:
        temporary = pathlib.Path(temp) / 'loop.wav'
        with wave.open(str(temporary), 'wb') as wav:
            wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(rate); wav.writeframes(encoded.tobytes())
        output = destination / f'{band}.ogg'
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(temporary),'-c:a','libvorbis','-q:a','6',str(output)],check=True)
    manifest.append(dict(rpm=band*1000,source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),ogg_sha256=hashlib.sha256(output.read_bytes()).hexdigest(),bytes=output.stat().st_size))
(destination / 'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Prepared {len(manifest)} V8 loops: {sum(x["bytes"] for x in manifest):,} bytes')
