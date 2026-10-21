# Tile loops for the home page's Splay and HAS Lathe tiles

Both scripts drive the apps in a headless Chrome (Playwright, `channel: 'chrome'`). Not part
of the site build. The Playwright import path at the top of each script points at a local
install (HAS_Video_Editor); change it to yours.

**Splay** (`public/video/splay-tile.mp4`): Splay's own Render (MP4, frame by frame,
offscreen, no interface) of its quadcopter demo, then made into a loop with ffmpeg.

1. In `ExplodedView/app`, `pnpm dev --port 5178 --strictPort`.
2. `node splay-render.mjs quad-1080.mp4 1080p` (loads the demo, renders the explode once, forward).
3. Explode, hold the last frame 1 s, play it back reversed, and frame it at 92% on the
   viewport's background (`#181c22`):
   `ffmpeg -i quad-1080.mp4 -filter_complex "[0:v]split=2[f][r];[f]tpad=stop_mode=clone:stop_duration=1[fh];[r]reverse,trim=start_frame=1:end_frame=90,setpts=PTS-STARTPTS[rv];[fh][rv]concat=n=2:v=1[c];[c]scale=1180:664:flags=lanczos,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x181c22,format=yuv420p[v]" -map "[v]" -r 30 -c:v libx264 -preset slow -crf 22 -maxrate 2200k -bufsize 4400k -g 60 -an -movflags +faststart splay-tile.mp4`
   (`end_frame` is the render's frame count minus one.)

**HAS Lathe** (`public/video/has-lathe-tile.mp4`): rendered frame by frame from the HAS Lathe app's own
modules, then encoded with ffmpeg.

1. In `HAS_Lathe`, `npm run dev -- --port 5191`.
2. `node lathe-frames.mjs <frames dir> full` (`test` renders 6 frames).
3. `ffmpeg -framerate 30 -pattern_type glob -i 'lt_*.png' -vf "scale=1280:720:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 22 -maxrate 2200k -bufsize 4400k -g 60 -an -movflags +faststart has-lathe-tile.mp4`

Posters are each loop's first frame: `ffmpeg -i <loop>.mp4 -frames:v 1 -c:v libwebp -quality 72 tile-poster.webp`.
