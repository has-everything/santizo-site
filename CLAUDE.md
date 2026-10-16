# santizo-site: santizo.com, version B

The editorial redesign of santizo.com for Hector Augusto Santizo (HAS): full-screen reel, featured work, XR strip, apps, contact; a Work page with a page per video (15); an Apps page (nine has.tools apps); a Burning Man page (photos); an Info page (about, expertise, manifesto); and the HAS Lathe project page.

It is being built **alongside** the current site, SantizoOS (version A, repo `has-everything/santizo-os`, live on santizo.com). B gets its own Vercel project and URL so both can run side by side. B replaces A only when the owner says so.

Built with Astro (static output, no client framework). The build ships plain HTML and CSS plus one small script. The design source is the owner's two HTML mockups (`index.html` and `has-lathe.html`, October 2026). This build was checked pixel-identical to them at 1440px and 390px wide, in day and night themes. Since then the layout was widened (see Wide layout under Conventions), and the top bar and the Play reel button come from the owner's XK variant mockup (`index-xk.html`): a fixed bar (Work, Apps, Info) that inverts over what is behind it, a quieter Play reel link, and the ruled Apps list.

## Structure

- `src/data/`: **the content.** Edit these to change the site.
  - `site.ts`: name, email, the home page's search description, top bar links, reel, intro copy (its `lead` also opens Info), manifesto, footer links, and `indexable` (keep false while this is version B)
  - `photos.ts`: the Burning Man photos (file, size, alt text), in the owner's SantizoOS order (its `burning_man_pics` folder, santizo-os `img/hector_santizo_burning_man_002..019.jpg`)
  - `work.ts`: `projects` (every video: slug, title, blurb, focus, group, Vimeo or YouTube id, optional `year` and `story`), plus the home page's `featured` work (order = layout) and XR strip, built from those projects
  - `expertise.ts`: the six expertise cards (shown on Info)
  - `apps.ts`: the Apps page: `appsIntro` (why the tools exist) and `tools` (the nine apps, grid order, each with a `note` saying what problem it answers), plus the short Apps list on the home page (`apps`). The why copy is condensed from the owner's own words on has.tools (About and Learn sections, and the first paragraph of each `tools/<slug>.html`); keep it in his voice and check new lines against those sources
  - `media.ts`: what can fill a tile: `{ vimeo: id }`, `{ video: '/video/x.mp4', poster }`, `{ art: 'lathe' }`, or `{ img: '/img/x.webp' }`
- `src/pages/`: one file per URL. `index.astro` (home), `work/index.astro` (all videos), `work/[slug].astro` (one page per project, generated), `apps/index.astro` (Apps grid), `apps/has-lathe.astro` (project page), `burning-man.astro` (the photos one per row, all the same width: the column, up to 1200px, with slightly rounded corners; no click needed; `/photos` redirects here via `redirects` in `astro.config.mjs`), `info.astro` (about, expertise, manifesto), `404.astro` (always noindex), plus `robots.txt.ts` and `sitemap.xml.ts` (generated files, see SEO under Conventions)
- `src/layouts/Base.astro`: `<head>` (title, description, noindex or canonical, Open Graph and X/Twitter link previews, JSON-LD, icons), fonts, no-flash theme script, Vercel Web Analytics. Pages pass `title`, `description`, optional `image` (link preview) and `schema` (JSON-LD nodes)
- `src/lib/seo.ts`: the site's absolute address (`origin`, `abs()`), the default link preview image, and the JSON-LD builders (`person`, `website`, `breadcrumbs`)
- `src/components/`
  - `home/`: the home sections in page order: `Showreel`, `Intro`, `FeaturedWork`, `XrStrip`, `Apps`
  - `project/`: project-page pieces: `SpecList`, `PillLink`, `Figure`, `NextProject`
  - `art/`: the HAS Lathe line drawing on the home page's HAS Lathe tile, generated from one profile in `src/lib/lathe.ts`
  - shared: `VideoPlayer` (watchable Vimeo/YouTube embed with controls, for project pages), `Header` (fixed top bar; `overlay` on the home page, where it floats on the reel, otherwise it adds a spacer), `Footer`, `Section`, `SectionHead`, `WorkTile`, `Media`, `NumberedGrid`, `Clock`
- `src/styles/global.css`: tokens (colors, fonts, spacing), theme, shared utilities, tile hover, line-art classes, motion. Component layout lives in each component's `<style>`.
- `src/scripts/site.ts`: theme toggle, Los Angeles clock, scroll reveal (`.rv`)
- `src/scripts/reel.ts`: Play reel / Stop on the home hero (see Conventions)
- `public/img/photos/`, `public/img/apps/`: WebP images (photos 1200px wide, from SantizoOS `img/`)
- `public/img/lathe/`: the HAS Lathe page's figures, all real app output: `editor.webp` (has.tools `img/lathe-stage.png`), `vase-render.webp` (the vase cropped from has.tools `img/lathe-video-poster.jpg`), `presets.webp` (bowl, cup, bottle and plate, captured from the running app). The page hero is the app's Vimeo loop from `tools/lathe.html` on has.tools (`1213074336`)
- `public/img/og/`: link preview images, 1200x630: `santizo.png` (the default card: wordmark, headline, name, on the night colors), `burning-man.jpg` (photo 011), `has-lathe.jpg` (the editor)
- `public/favicon.svg` (✷, follows the OS light/dark), `favicon.ico` (48px), `apple-touch-icon.png` (180px): the ✷ star, orange on black for the bitmap icons

## Common tasks

**Add a video project**: add an entry to `projects` in `src/data/work.ts` (`slug` becomes `/work/<slug>`; `video` is `{ vimeo: id }` or `{ youtube: id }`). It appears on `/work` in its group and gets its own page automatically. Give it a write-up with `story: ['paragraph', ...]` and a `year`; both show only when set. No project has a write-up yet: the owner has not written them, so never invent stories, years, clients or credits.

**Add photos**: save as WebP in `public/img/photos/` and add `{ src, w, h, alt }` to `src/data/photos.ts` (w/h are the real pixel size: they reserve each photo's space before it loads). Every photo shows at the same width, up to 1200px, so export new ones at least 1200px wide or they get upscaled; larger exports would look sharper on big retina screens.

**Add or reorder featured work**: edit `featured` in `src/data/work.ts`. The first item runs full width; the rest pair up in rows that alternate wide/narrow and narrow/wide.

**Swap a Vimeo loop for a self-hosted clip**: put the file in `public/video/` (and a poster in `public/img/`), then change that item's `media` to `{ video: '/video/name.mp4', poster: '/img/name.jpg' }`. `*.mp4` is gitignored by default (mirrors santizo-os); remove that line from `.gitignore` to commit clips, or host them elsewhere.

**Change the apps on /apps**: edit `tools` in `src/data/apps.ts`. Card images are the has.tools card captures (`has-tools-website/img/<slug>-card.png`, 800x500) saved as WebP in `public/img/apps/<slug>.webp`. Cards link to the has.tools showcase page (`https://has.tools/tools/<slug>.html`), except HAS Lathe, which has its own page here. Left out on purpose: HAS Frame Extract and HAS Frames (2D utilities, weakest fit for a 3D motion portfolio).

**Change the XR clips on the home page**: the home XR section shows three wide clips in a row (one per row on phones); pick them by slug in `xr.clips` in `src/data/work.ts` (currently Wrist Interaction, 3D Calculator and Pinch Twist: Vimeo loops that match the statement). All XR clips are on `/work`.

**Add a project page**: copy `src/pages/apps/has-lathe.astro` to a new file (its path is its URL), change the copy, figures, `description`, preview `image` and `schema`, add its path to `src/pages/sitemap.xml.ts`, then point the work item's `href` at it.

**Change colors or type**: tokens at the top of `src/styles/global.css` (`:root` for day, `[data-theme="night"]` for night).

## Conventions

- **No em dashes** anywhere in copy. Use commas, colons, or the middot ` · `.
- **Wide layout** (field.io-like, owner's call, Oct 2026): media fills the window instead of a centered 1440px column (`--max: 100%`), with thin margins (`--gutter`, up to 24px) and tight gaps between tiles (`--tile-gap`), all in `:root` of `global.css`. Media grids use `.grid-2` / `.grid-3` (fixed column counts, so big screens get bigger tiles, not more of them). Text keeps its own `ch` reading widths. Project videos sit edge to edge on a black band, sized to fit the screen under the top bar. Burning Man photos stay capped at 1200px (their real size). To go back to the centered column, set `--max: 1440px`.
- **Prefer simple over optimal**: no extra config, infra, or dependencies unless there is a user-visible problem.
- Theme: day by default; `?theme=night` in the URL; the footer toggle remembers the choice in `localStorage` under `santizo-theme`.
- Tiles show Vimeo clips as muted background loops (`background=1`) and YouTube videos as their thumbnail; every tile opens its project page on this site, where `VideoPlayer` plays it with sound and controls.
- **Play reel stays on the site**: it restarts the reel from the top with sound and the button becomes Stop; Stop, the end of the reel, or scrolling away returns to the silent loop. Two drivers in `src/scripts/reel.ts`:
  - Vimeo loop (default): unmuted through the Player API, lazy-loaded `@vimeo/player`. Works in desktop browsers (owner-tested). iPhones and iPads refuse sound started from the page on a cross-origin embed, so there Play reel stays a plain link to the reel's own page (`reel.href`, `/work/santizo-reel-2026`), where it plays with sound and controls. A desktop browser that rejects play() is sent there too; one that pauses the unmuted video just returns to the silent loop.
  - Direct file: when `reel.file` in `src/data/site.ts` holds an MP4 of the reel (Vimeo: video settings, ⋯ menu, Video file links, Copy link), the hero plays it in a plain `<video>` and sound works everywhere, iPhones included.
- **Never show Vimeo's controls** on the hero (owner's call), and don't add timers or checks that swap the player: an earlier 6-second check misfired on a working embed and restarted the reel.
- The end of the reel is detected from `timeupdate` jumping back to the start, because background embeds loop.
- Top bar: Work (`/work`), Apps (`/apps`), Burning Man (`/burning-man`), Info (`/info`). Checked to stay on one line from 320px up: labels never wrap, and gaps tighten below 400px (and the text drops to 14px below 350px). Re-check narrow widths before adding a fifth link. The bar sits inset from the media edges (gutter plus 0 to 24px, growing with screen width) so the logo and menu don't line up flush with the videos. It has no background, by design: page content scrolls under it.
- The footer's "(04) Contact" number follows each page's own sections (`<Footer num="03" />` on Info).
- Numbered cards (`NumberedGrid`: Expertise on Info, "What it does" on HAS Lathe) use fixed columns, 1, 2, then 3 from 1100px, so six cards always make even rows. Keep those lists at 3 or 6 items.
- **SEO and link previews**: every page sets a unique `title` and `description` on `<Base>`; pages with their own picture pass `image` (1200x630 in `public/img/og/`), the rest use the default card. Structured data (JSON-LD, via `src/lib/seo.ts`): Person and WebSite on Home, ProfilePage on Info, CreativeWork per project, SoftwareApplication on HAS Lathe, ImageGallery on Burning Man, CollectionPage on Work and Apps, and breadcrumbs on every inner page. Absolute URLs come from `origin` in `seo.ts`: this project's Vercel production address before launch (`VERCEL_PROJECT_PRODUCTION_URL`, so previews of santizo-site.vercel.app links load their images), santizo.com once `site.indexable` is true. A new page needs a description, and a line in `src/pages/sitemap.xml.ts`.
- **Link previews were made, not shot**: the default card was rendered from HTML in the site's fonts and night colors (a reel still would be better: export one from the reel at 1200x630 and replace `public/img/og/santizo.png`).

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

1. `site.indexable = true` in `src/data/site.ts`, in the same push as step 4 (or right after it). That one switch drops noindex on every page but the 404, adds canonical URLs, points every absolute URL (canonical, link previews, JSON-LD, sitemap) at santizo.com, and adds the `Sitemap:` line to robots.txt. Everything else (link previews, JSON-LD Person like santizo-os has, robots.txt, sitemap.xml, icons) is already live.
2. After the switch: add santizo.com in Google Search Console (a DNS TXT record at Netfirms or the HTML-file method, never a nameserver change) and submit `https://santizo.com/sitemap.xml`. Check a link preview (for example by pasting the URL in iMessage or Slack, or in LinkedIn's Post Inspector).
3. OS mode: the footer's "OS mode ↗" links to SantizoOS at `https://santizo-os.vercel.app` (not santizo.com, so it survives the switch). SantizoOS keeps its own boring mode. Optional: an `os.santizo.com` address (one CNAME record at Netfirms, never a nameserver change), and an "exit OS" link in SantizoOS's menu back to this site.
4. In Vercel, move the `santizo.com` and `www` domains from project `santizo-os` to this project. **Do not touch DNS or nameservers** (zone is on Netfirms, MX carries email). The A records already point at Vercel, so moving domains between projects needs no DNS change.
5. Old SantizoOS deep links (`/?open=...`) land on the home page, which is fine.

## A real A/B split (optional, later)

To send a share of santizo.com visitors to B before a full switch, add Vercel Routing Middleware to the **santizo-os** project. It assigns each visitor a sticky cookie (`ab=a|b`) and rewrites the `b` group to this project's URL. Compare the two in Vercel Web Analytics. Not set up yet; only do it if the owner asks.
