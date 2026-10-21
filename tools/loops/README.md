# Tile loop for the home page's HAS Lathe tile

`public/video/has-lathe-tile.mp4`: rendered frame by frame from the HAS Lathe app's own
modules in a headless Chrome (Playwright, `channel: 'chrome'`), then encoded with ffmpeg.
Not part of the site build. The Playwright import path at the top of the script points at
a local install (HAS_Video_Editor); change it to yours.

1. In `HAS_Lathe`, `npm run dev -- --port 5191`.
2. `node lathe-frames.mjs <frames dir> full` (`test` renders 6 frames).
3. `ffmpeg -framerate 30 -pattern_type glob -i 'lt_*.png' -vf "scale=1280:720:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 22 -maxrate 2200k -bufsize 4400k -g 60 -an -movflags +faststart has-lathe-tile.mp4`

The poster is the loop's first frame: `ffmpeg -i has-lathe-tile.mp4 -frames:v 1 -c:v libwebp -quality 72 tile-poster.webp`.
