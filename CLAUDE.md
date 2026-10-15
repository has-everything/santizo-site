# santizo-site: santizo.com, version B

The editorial redesign of santizo.com for Hector Augusto Santizo (HAS): full-screen reel, featured work, XR strip, apps, contact; an Apps page (nine has.tools apps); an Info page (about and expertise); and project pages (HAS Lathe first).

It is being built **alongside** the current site, SantizoOS (version A, repo `has-everything/santizo-os`, live on santizo.com). B gets its own Vercel project and URL so both can run side by side. B replaces A only when the owner says so.

Built with Astro (static output, no client framework). The build ships plain HTML and CSS plus one small script. The design source is the owner's two HTML mockups (`index.html` and `has-lathe.html`, October 2026). This build was checked pixel-identical to them at 1440px and 390px wide, in day and night themes. Since then, the top bar and the Play reel button come from the owner's XK variant mockup (`index-xk.html`): a fixed bar (Work, Apps, Info) that inverts over what is behind it, a quieter Play reel link, and the ruled Apps list.

## Structure

- `src/data/`: **the content.** Edit these to change the site.
  - `site.ts`: name, email, top bar links, reel, intro copy, footer links, and `indexable` (keep false while this is version B)
  - `work.ts`: featured work (order = layout) and the XR clips
  - `expertise.ts`: the six expertise cards (shown on Info)
  - `apps.ts`: the Apps page: `appsIntro` (why the tools exist) and `tools` (the nine apps, grid order, each with a `note` saying what problem it answers), plus the short Apps list on the home page (`apps`). The why copy is condensed from the owner's own words on has.tools (About and Learn sections, and the first paragraph of each `tools/<slug>.html`); keep it in his voice and check new lines against those sources
  - `media.ts`: what can fill a tile: `{ vimeo: id }`, `{ video: '/video/x.mp4', poster }`, `{ art: 'lathe' }`, or `{ img: '/img/x.webp' }`
- `src/pages/`: one file per URL. `index.astro` (home), `apps/index.astro` (Apps grid), `apps/has-lathe.astro` (project page), `info.astro` (about, expertise), `404.astro`
- `src/layouts/Base.astro`: `<head>`, fonts, no-flash theme script, noindex/canonical, Vercel Web Analytics
- `src/components/`
  - `home/`: the home sections in page order: `Showreel`, `Intro`, `FeaturedWork`, `XrStrip`, `Apps`
  - `project/`: project-page pieces: `SpecList`, `PillLink`, `Figure`, `NextProject`
  - `art/`: the HAS Lathe line drawings, all generated from one profile in `src/lib/lathe.ts`
  - shared: `Header` (fixed top bar; `overlay` on the home page, where it floats on the reel, otherwise it adds a spacer), `Footer`, `Section`, `SectionHead`, `WorkTile`, `Media`, `NumberedGrid`, `Clock`
- `src/styles/global.css`: tokens (colors, fonts, spacing), theme, shared utilities, tile hover, line-art classes, motion. Component layout lives in each component's `<style>`.
- `src/scripts/site.ts`: theme toggle, Los Angeles clock, scroll reveal (`.rv`)
- `src/scripts/reel.ts`: Play reel / Stop on the home hero (see Conventions)

## Common tasks

**Add or reorder featured work**: edit `featured` in `src/data/work.ts`. The first item runs full width; the rest pair up in rows that alternate wide/narrow and narrow/wide.

**Swap a Vimeo loop for a self-hosted clip**: put the file in `public/video/` (and a poster in `public/img/`), then change that item's `media` to `{ video: '/video/name.mp4', poster: '/img/name.jpg' }`. `*.mp4` is gitignored by default (mirrors santizo-os); remove that line from `.gitignore` to commit clips, or host them elsewhere.

**Change the apps on /apps**: edit `tools` in `src/data/apps.ts`. Card images are the has.tools card captures (`has-tools-website/img/<slug>-card.png`, 800x500) saved as WebP in `public/img/apps/<slug>.webp`. Cards link to the has.tools showcase page (`https://has.tools/tools/<slug>.html`), except HAS Lathe, which has its own page here. Left out on purpose: HAS Frame Extract and HAS Frames (2D utilities, weakest fit for a 3D motion portfolio).

**Add an XR clip**: add an entry to `xr.clips` in `src/data/work.ts`. The "04 clips" label counts itself.

**Add a project page**: copy `src/pages/apps/has-lathe.astro` to a new file (its path is its URL), change the copy and figures, then point the work item's `href` at it.

**Change colors or type**: tokens at the top of `src/styles/global.css` (`:root` for day, `[data-theme="night"]` for night).

## Conventions

- **No em dashes** anywhere in copy. Use commas, colons, or the middot ` · `.
- **Prefer simple over optimal**: no extra config, infra, or dependencies unless there is a user-visible problem.
- Theme: day by default; `?theme=night` in the URL; the footer toggle remembers the choice in `localStorage` under `santizo-theme`.
- Vimeo clips are muted background loops (`background=1`). Work tiles link to the clip on vimeo.com.
- **Play reel stays on the site**: it restarts the reel from the top with sound and the button becomes Stop; Stop, the end of the reel, or scrolling away returns to the silent loop. Two drivers in `src/scripts/reel.ts`:
  - Vimeo loop (default): unmuted through the Player API, lazy-loaded `@vimeo/player`. Works in desktop browsers (owner-tested). iPhones refuse sound started from the page on a cross-origin embed; there the hero just stays on the silent loop.
  - Direct file: when `reel.file` in `src/data/site.ts` holds an MP4 of the reel (Vimeo: video settings, ⋯ menu, Video file links, Copy link), the hero plays it in a plain `<video>` and sound works everywhere, iPhones included.
- **Never show Vimeo's controls** on the hero (owner's call), and don't add timers or checks that swap the player: an earlier 6-second check misfired on a working embed and restarted the reel.
- The end of the reel is detected from `timeupdate` jumping back to the start, because background embeds loop.
- Top bar: Work (`/#work`), Apps (`/apps`), Info (`/info`). Keep it short so it fits on a phone. It has no background, by design: page content scrolls under it.
- The footer's "(04) Contact" number follows each page's own sections (`<Footer num="02" />` on Info).
- Placeholder art: the HAS Lathe figures print `[Video] ...` / `[Still] ...` labels until real captures replace them.

## Run it

```
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

## Deploy

Vercel project imported from this GitHub repo, Framework Preset **Astro**, all defaults (build `astro build`, output `dist`). Push to `main` = production; any other branch gets its own preview URL. santizo-os notes that the GitHub webhook has missed pushes before. If a push doesn't show up, run `vercel deploy --prod` from this folder.

Web Analytics: the snippet is in `Base.astro`. Turn it on in the Vercel project (Analytics tab) to compare B's traffic with A's.

## Launch checklist (when B replaces A)

1. `site.indexable = true` in `src/data/site.ts` (drops noindex, adds canonical URLs).
2. Add `public/robots.txt` and a sitemap, an `og:image` (1200x630), and JSON-LD Person markup like santizo-os has.
3. Boring mode: the footer links to `santizo.com/boring.html`, which lives in santizo-os. Bring it over (or drop the link) before the switch.
4. In Vercel, move the `santizo.com` and `www` domains from project `santizo-os` to this project. **Do not touch DNS or nameservers** (zone is on Netfirms, MX carries email). The A records already point at Vercel, so moving domains between projects needs no DNS change.
5. Old SantizoOS deep links (`/?open=...`) land on the home page, which is fine.

## A real A/B split (optional, later)

To send a share of santizo.com visitors to B before a full switch, add Vercel Routing Middleware to the **santizo-os** project. It assigns each visitor a sticky cookie (`ab=a|b`) and rewrites the `b` group to this project's URL. Compare the two in Vercel Web Analytics. Not set up yet; only do it if the owner asks.
