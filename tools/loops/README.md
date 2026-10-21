# Tile loops for the home page's Splay and HAS Lathe tiles

Rendered frame by frame in a headless Chrome (Playwright, `channel: 'chrome'`), then
encoded with ffmpeg. Not part of the site build. The Playwright import path at the top
of each script points at a local install (HAS_Video_Editor); change it to yours.

**Splay** (`public/video/splay-tile.mp4`): the Splay speaker STEP
(`Splay-Speaker-HD-Assembled.step`, 341 parts) in the HAS Explode stage.

1. Run the HAS Explode harness: in `has-explode-mcp`, `OUT_DIR=<frames dir> node test/harness.mjs` (port 5177).
2. `node splay-frames.mjs splay.json full` (PNG frames into OUT_DIR; `test` renders 4).
3. Crop off the stage's corner marks and captions, and encode:
   `ffmpeg -framerate 30 -pattern_type glob -i 'sp_*.png' -vf "crop=1696:954,scale=1280:720:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 22 -maxrate 2200k -bufsize 4400k -g 60 -an -movflags +faststart splay-tile.mp4`

**HAS Lathe** (`public/video/has-lathe-tile.mp4`): the app's own modules, driven in the page.

1. In `HAS_Lathe`, `npm run dev -- --port 5191`.
2. `node lathe-frames.mjs <frames dir> full`.
3. `ffmpeg -framerate 30 -pattern_type glob -i 'lt_*.png' -vf "scale=1280:720:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 22 -maxrate 2200k -bufsize 4400k -g 60 -an -movflags +faststart has-lathe-tile.mp4`

Posters are each loop's first frame: `ffmpeg -i <loop>.mp4 -frames:v 1 -c:v libwebp -quality 72 tile-poster.webp`.
