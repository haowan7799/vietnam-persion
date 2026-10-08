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
