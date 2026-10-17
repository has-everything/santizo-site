# santizo-site: santizo.com, version B

The editorial redesign of santizo.com for Hector Augusto Santizo (HAS): full-screen reel, featured work, XR strip, apps, contact; a Work page with a page per video (15); an XR page (AR, VR, mixed reality: the seven XR projects); an Apps page (five has.tools apps), each app with its own page (HAS Lathe, Splay, HAS Sculpt, HAS Truss, HAS Gallery); a Burning Man page (photos); and an Info page (about, expertise, how I work).

**Live on santizo.com since October 2026.** It was built as version B alongside the previous site, SantizoOS (version A, repo `has-everything/santizo-os`), which now lives on at `https://santizo-os.vercel.app` and is linked from the footer as "OS mode". Both are separate Vercel projects; santizo.com and www belong to this one. **www.santizo.com is the primary address** (Vercel's default, as it was for SantizoOS): santizo.com 308-redirects to it, and `site` in `astro.config.mjs` is `https://www.santizo.com`, so every canonical URL, link preview, JSON-LD URL and the sitemap use www.

Built with Astro (static output, no client framework). The build ships plain HTML and CSS plus one small script. The design source is the owner's two HTML mockups (`index.html` and `has-lathe.html`, October 2026). This build was checked pixel-identical to them at 1440px and 390px wide, in day and night themes. Since then the layout was widened (see Wide layout under Conventions), and the top bar and the Play reel button come from the owner's XK variant mockup (`index-xk.html`): a fixed bar (Work, Apps, Info) that inverts over what is behind it, a quieter Play reel link, and the ruled Apps list.

## Structure

- `src/data/`: **the content.** Edit these to change the site.
  - `site.ts`: name, email, the home page's search description, top bar links, reel, intro copy (its `lead` also opens Info), the How I work rules (`howIWork`), footer links, and `indexable` (true since launch; false would put noindex on every page)
  - `photos.ts`: the Burning Man photos (file, size, alt text), in the owner's SantizoOS order (its `burning_man_pics` folder, santizo-os `img/hector_santizo_burning_man_002..019.jpg`)
  - `work.ts`: `projects` (every video: slug, title, blurb, focus, group, Vimeo or YouTube id, optional `year`, `tagline` and `story`), plus the home page's `featured` work (order = layout) and XR strip, and the XR page (`xrPage`: intro, tools, clip order), built from those projects
  - `expertise.ts`: the six expertise cards (shown on Info)
  - `apps.ts`: the Apps page: `appsIntro` (why the tools exist) and `tools` (the five apps, grid order; the owner plans a sixth, which fills the last row; each with a `note` saying what problem it answers), plus the short Apps list on the home page (`apps`: HAS Lathe, Splay, HAS Gallery, HAS Sculpt and HAS Truss, picked by title from `tools`, then a has.tools row). The why copy is condensed from the owner's own words on has.tools (About and Learn sections, and the first paragraph of each `tools/<slug>.html`); keep it in his voice and check new lines against those sources
  - `app-pages.ts`: one page per app (`appPages`, page order = Next order): name, tagline, role, specs, the case study (`story`: Vision, Creative Direction, Execution, Outcome), the six features, figures, details, link preview. Splay, HAS Sculpt, HAS Truss and HAS Gallery carry the owner's own case-study copy, tagline and role (Oct 2026): use it as written. HAS Lathe has no story yet and shows a short why (`lead`, `copy`) condensed from its has.tools page until the owner writes it; never invent a case study or features
  - `media.ts`: what can fill a tile: `{ vimeo: id }`, `{ video: '/video/x.mp4', poster }`, `{ art: 'lathe' }`, or `{ img: '/img/x.webp' }`
- `src/pages/`: one file per URL. `index.astro` (home), `work/index.astro` (all videos), `work/[slug].astro` (one page per project, generated), `xr.astro` (XR intro and clips: the first full width, the rest two per row), `apps/index.astro` (Apps grid, three across on wide screens; each card opens its app page), `apps/[slug].astro` (one page per app, generated from `app-pages.ts`: wide hero, overview with the role first in the specs, the case study as ruled rows (or the short why), Fig. 01 the app at work, six features, two square stills, details, Next app), `burning-man.astro` (the photos one per row, all the same width: the column, up to 1200px, with slightly rounded corners; no click needed; `/photos` redirects here via `redirects` in `astro.config.mjs`), `info.astro` (about, expertise, how I work), `404.astro` (always noindex), plus `robots.txt.ts` and `sitemap.xml.ts` (generated files, see SEO under Conventions)
- `src/layouts/Base.astro`: `<head>` (title, description, noindex or canonical, Open Graph and X/Twitter link previews, JSON-LD, icons), fonts, no-flash theme script, Vercel Web Analytics. Pages pass `title`, `description`, optional `image` (link preview) and `schema` (JSON-LD nodes)
- `src/lib/seo.ts`: the site's absolute address (`origin`, `abs()`), the default link preview image, and the JSON-LD builders (`person`, `website`, `breadcrumbs`)
- `src/components/`
  - `home/`: the home sections in page order: `Showreel`, `Intro`, `FeaturedWork`, `XrStrip`, `Apps`
  - `project/`: project-page pieces: `SpecList`, `PillLink`, `Figure`, `NextProject`, `Story` (a case study as ruled rows, shared by work and app pages; `*asterisks*` in its text become italics)
  - `art/`: the HAS Lathe line drawing on the home page's HAS Lathe tile, generated from one profile in `src/lib/lathe.ts`
  - shared: `VideoPlayer` (watchable Vimeo/YouTube embed with controls, for project pages), `Header` (fixed top bar; `overlay` on the home page, where it floats on the reel, otherwise it adds a spacer), `Footer`, `Section`, `SectionHead`, `WorkTile`, `Media`, `NumberedGrid`, `Clock`
- `src/styles/global.css`: tokens (colors, fonts, spacing), theme, shared utilities, tile hover, line-art classes, motion. Component layout lives in each component's `<style>`.
- `src/scripts/site.ts`: theme toggle, Los Angeles clock, scroll reveal (`.rv`)
- `src/scripts/reel.ts`: Play reel / Stop on the home hero (see Conventions)
- `public/img/photos/`: WebP photos, 1200px wide, from SantizoOS `img/`
- `public/img/apps/<app>.webp`: one 16:9 card per app (2000x1125), from the has.tools stage captures (`has-tools-website/img/<slug>-stage.png`)
- `public/img/apps/<app>/`: each app page's images, all real app output (captured headlessly from the apps in `has-tools-website/apps/`, Oct 2026): `hero.webp` (2400x1029, 7:3; HAS Lathe uses its has.tools Vimeo loop `1213074336` instead), `app.webp` or `editor.webp` (Fig. 01, 1600x900), and two square stills (1360px). Splay: the demo drone assembled, mid-explosion and fully exploded (its own PNG export). HAS Truss: presets, profiles and finishes. HAS Sculpt: a head sculpted with scripted strokes. HAS Gallery: a plan imported as JSON, hung with the owner's Burning Man photos. HAS Lathe: `editor.webp` (has.tools `img/lathe-stage.png`), `vase-render.webp` (from `img/lathe-video-poster.jpg`), `presets.webp`
- `public/img/og/`: link preview images, 1200x630: `santizo.png` (the default card: wordmark, headline, name, on the night colors), `burning-man.jpg` (photo 011), and one per app page (`has-lathe.jpg` is the editor, the others are crops of each hero)
- `public/favicon.svg` (✷, follows the OS light/dark), `favicon.ico` (48px), `apple-touch-icon.png` (180px): the ✷ star, orange on black for the bitmap icons

## Common tasks

**Add a video project**: add an entry to `projects` in `src/data/work.ts` (`slug` becomes `/work/<slug>`; `video` is `{ vimeo: id }` or `{ youtube: id }`). It appears on `/work` in its group and gets its own page automatically. Give it the owner's write-up as `tagline` (shown under the title instead of the blurb) and `story` (sections like `{ title: 'Vision', paras: ['...'] }`, rendered by `Story`), and a `year`; each shows only when set. Van Gogh · The Bedroom and HAS LP-19 have write-ups so far (the owner's, Oct 2026): the owner writes them, so never invent stories, years, clients or credits.

**Add photos**: save as WebP in `public/img/photos/` and add `{ src, w, h, alt }` to `src/data/photos.ts` (w/h are the real pixel size: they reserve each photo's space before it loads). Every photo shows at the same width, up to 1200px, so export new ones at least 1200px wide or they get upscaled; larger exports would look sharper on big retina screens.

**Add or reorder featured work**: edit `featured` in `src/data/work.ts`. The first item runs full width; the rest pair up in rows that alternate wide/narrow and narrow/wide.

**Swap a Vimeo loop for a self-hosted clip**: put the file in `public/video/` (and a poster in `public/img/`), then change that item's `media` to `{ video: '/video/name.mp4', poster: '/img/name.jpg' }`. `*.mp4` is gitignored by default (mirrors santizo-os); remove that line from `.gitignore` to commit clips, or host them elsewhere.

**Change the apps on /apps**: edit `tools` in `src/data/apps.ts` (grid order, three across on wide screens; a half-empty last row is fine, owner's call). Card images are the has.tools stage captures (`has-tools-website/img/<slug>-stage.png`, 2400x1350) saved as 2000px WebP in `public/img/apps/<slug>.webp`. Each card opens the app's page here (`/apps/<slug>`); the page's "Open … ↗" button goes to the app on has.tools. On the site (owner's pick, Oct 2026): Splay, HAS Lathe, HAS Sculpt, HAS Truss, HAS Gallery. Left out: HAS Cabinet, HAS Books, HAS Dither and PLAT (removed by the owner), and HAS Frame Extract and HAS Frames (2D utilities, weakest fit for a 3D motion portfolio).

**Add an app page**: add an entry to `appPages` in `src/data/app-pages.ts` (its position sets the Next order), put its images in `public/img/apps/<app>/` and a 1200x630 preview in `public/img/og/`, then add the card to `tools` in `src/data/apps.ts` with `href: '/apps/<slug>'`. The page and its sitemap entry are generated.

**Change the XR clips on the home page**: the home XR section shows three wide clips in a row (one per row on phones); pick them by slug in `xr.clips` in `src/data/work.ts` (currently Wrist Interaction, 3D Calculator and Pinch Twist: Vimeo loops that match the statement). Its "All XR →" opens `/xr`.

**Change the XR page**: `xrPage` in `src/data/work.ts`. `lead` and `body` were written from the owner's placeholder (his tools list is verbatim); `projects` is the clip order and the layout: the first runs full width, the rest pair up, so keep the count odd. A new XR project goes in `projects` (group `xr`, so it also shows on /work) and in `xrPage.projects`.

**Add a one-off project page**: build it from `src/pages/apps/[slug].astro` and its parts (its path is its URL): copy, figures, `description`, preview `image` and `schema`; add its path to `src/pages/sitemap.xml.ts`, then point the work item's `href` at it.

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
- Top bar: Work (`/work`), XR (`/xr`), Apps (`/apps`), Burning Man (`/burning-man`), Info (`/info`). Measured to stay on one line, inside the right margin, at every width from 320px up: labels never wrap, gaps tighten below 400px, the text drops to 14px below 375px and to 13px below 351px. There is no room for a sixth link on small phones; to add one, move Burning Man to the footer first. The bar sits inset from the media edges (gutter plus 0 to 24px, growing with screen width) so the logo and menu don't line up flush with the videos. It has no background, by design: page content scrolls under it.
- The footer's "(04) Contact" number follows each page's own sections (`<Footer num="03" />` on Info).
- Numbered cards (`NumberedGrid`: Expertise on Info, "What it does" on every app page) use fixed columns, 1, 2, then 3 from 1100px, so six cards always make even rows. Keep those lists at 3 or 6 items.
- **SEO and link previews**: every page sets a unique `title` and `description` on `<Base>`; pages with their own picture pass `image` (1200x630 in `public/img/og/`), the rest use the default card. Structured data (JSON-LD, via `src/lib/seo.ts`): Person and WebSite on Home, ProfilePage on Info, CreativeWork per project, SoftwareApplication on each app page, ImageGallery on Burning Man, CollectionPage on Work and Apps, and breadcrumbs on every inner page. Absolute URLs come from `origin` in `seo.ts`: `site` in `astro.config.mjs` (www.santizo.com) while `site.indexable` is true; with it false, this project's Vercel production address (`VERCEL_PROJECT_PRODUCTION_URL`). A new page needs a description, and a line in `src/pages/sitemap.xml.ts`.
- **Link previews were made, not shot**: the default card was rendered from HTML in the site's fonts and night colors (a reel still would be better: export one from the reel at 1200x630 and replace `public/img/og/santizo.png`).

## Run it

```
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

## Deploy

Vercel project imported from this GitHub repo, Framework Preset **Astro**, all defaults (build `astro build`, output `dist`). Push to `main` = production; any other branch gets its own preview URL. santizo-os notes that the GitHub webhook has missed pushes before. If a push doesn't show up, run `vercel deploy --prod` from this folder.

Web Analytics: the snippet is in `Base.astro`. Turn it on in the Vercel project (Analytics tab).

## Launch (October 2026)

1. Done in code: `site.indexable = true` in `src/data/site.ts`. That one switch drops noindex on every page but the 404, adds canonical URLs, points every absolute URL (canonical, link previews, JSON-LD, sitemap) at www.santizo.com, and adds the `Sitemap:` line to robots.txt.
2. Done in Vercel: the `santizo.com` and `www.santizo.com` domains moved from project `santizo-os` to this project (www primary, santizo.com 308-redirects to it; if that is ever flipped in Vercel, change `site` in `astro.config.mjs` to match). Vercel shows "DNS Change Recommended" (newer Vercel IPs); the current records work, so it was left alone. **Do not touch DNS or nameservers** (zone is on Netfirms, MX carries email). The A records already point at Vercel, so moving domains between projects needs no DNS change.
3. Done (verified Oct 2026): Google Search Console, a URL-prefix property for `https://www.santizo.com/`, verified with the HTML tag method (the `google-site-verification` meta tag in `Base.astro`, on every page; keep it, removing it unverifies the site; no DNS needed), then submit `https://www.santizo.com/sitemap.xml`.
4. OS mode: the footer's "OS mode ↗" links to SantizoOS at `https://santizo-os.vercel.app`. SantizoOS keeps its own boring mode; its canonical points at www.santizo.com, so search engines treat it as a copy of this site. Optional: an `os.santizo.com` address (one CNAME record at Netfirms, never a nameserver change), and an "exit OS" link in SantizoOS's menu back to this site.
5. Old SantizoOS deep links (`/?open=...`) land on the home page, which is fine. `/boring.html` and SantizoOS's image paths now 404 on santizo.com (the 404 page links home).
