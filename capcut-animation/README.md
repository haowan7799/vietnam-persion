# Opus 5.5 · CapCut workshop (30s, single continuous shot)

Final video: `out/opus-capcut-workshop.mp4` (1920×1080, 60fps, H.264 + AAC, ready for X).

Rebuild:
```bash
python3 music.py build/bgm.wav          # original 120 BPM BGM + SFX, no vocals
node render.mjs build/frames 60 4       # render frames from scene.html
ffmpeg -framerate 60 -i build/frames/%05d.png -i build/bgm.wav -c:v libx264 -crf 18 \
  -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -shortest out/opus-capcut-workshop.mp4
```
Fonts: Fredoka and Pacifico (SIL Open Font License, from google/fonts).

## Family vlog edition

`scene-family.html`: the same 30s one-take, but Opus edits a family photo. The real photo becomes
the clips, a CARTOON filter turns it into hand-drawn versions of the family, and they pop out
of the monitor on the drop, dance with Opus, and pose for the finale.
The photo is not committed: put it at `assets/family.jpg` (1280×853) before rendering.
```bash
python3 music.py build/bgm_family.wav --family
SCENE=scene-family.html node render.mjs build/frames_f 60 4
ffmpeg -framerate 60 -i build/frames_f/%05d.png -i build/bgm_family.wav -c:v libx264 -crf 18 \
  -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -shortest out/opus-capcut-family.mp4
```
