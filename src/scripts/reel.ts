// Home showreel. "Play reel" restarts the reel from the top with sound and the
// button becomes "Stop". Stop, the end of the reel, or scrolling the hero out of
// view returns it to the silent loop. Vimeo's controls never show.
//
// Two ways to drive it, picked by what the hero holds:
// - a direct file (<video>, from reel.file in src/data/site.ts): the click
//   itself unlocks sound, so it works in every browser, iPhones included.
// - the Vimeo loop (<iframe>): unmuted through Vimeo's player API. Works in
//   desktop browsers. iPhones and iPads refuse sound started this way, so there
//   Play reel stays a plain link to the reel's page (reel.href), where it plays
//   with sound and controls. A desktop browser that refuses goes there too.
//   Setting reel.file keeps everyone on the hero.
import type Player from '@vimeo/player';
import { isIOS } from './ios';

interface Driver { play(): void; stop(): void }

const hero = document.querySelector<HTMLElement>('[data-reel]');
if (hero) setup(hero);

function setup(hero: HTMLElement) {
  const toggle = hero.querySelector<HTMLAnchorElement>('[data-reel-toggle]')!;
  const label = toggle.querySelector('span')!;
  let playing = false;

  function set(on: boolean) {
    playing = on;
    hero.classList.toggle('playing', on);
    label.textContent = on ? 'Stop' : 'Play reel';
    toggle.setAttribute('aria-pressed', String(on));
  }

  function stop() {
    if (!playing) return;
    set(false);
    driver.stop();
  }

  const video = hero.querySelector('video');
  if (!video) uncover(hero, hero.querySelector('iframe')!);
  // iOS can't unmute the Vimeo loop: leave the link alone, it opens the reel's page
  if (!video && isIOS()) return;

  const driver = video
    ? fileDriver(video, stop)
    : vimeoDriver(hero.querySelector('iframe')!, stop, () => location.assign(toggle.href));

  toggle.setAttribute('role', 'button');
  toggle.setAttribute('aria-pressed', 'false');
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    if (playing) return stop();
    set(true);
    driver.play();
  });
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) stop();
  }).observe(hero);
}

// Fade out the still and loading line over the Vimeo loop (Showreel.astro) once
// it is half a second in, where the still was taken, so the hand-off doesn't
// show. If Vimeo never plays (blocked, offline), the still stays.
function uncover(hero: HTMLElement, iframe: HTMLIFrameElement) {
  if (!hero.querySelector('[data-reel-cover]')) return;
  import('@vimeo/player').then(({ default: VimeoPlayer }) => {
    const p = new VimeoPlayer(iframe);
    const check = ({ seconds }: { seconds: number }) => {
      if (seconds < 0.5) return;
      hero.classList.add('ready');
      p.off('timeupdate', check);
    };
    p.on('timeupdate', check);
  }, () => {});
}

// `done` is called when the reel ends or the browser refuses to play it with sound.

function fileDriver(video: HTMLVideoElement, done: () => void): Driver {
  video.addEventListener('ended', done);
  return {
    play() {
      video.loop = false;
      video.currentTime = 0;
      video.muted = false;
      video.volume = 1;
      video.play().catch(done);
    },
    stop() {
      video.muted = true;
      video.loop = true;
      video.play().catch(() => {});
    },
  };
}

// `refused` (Vimeo only): play() was rejected, so open the reel's page instead.
function vimeoDriver(iframe: HTMLIFrameElement, done: () => void, refused: () => void): Driver {
  let player: Promise<Player> | undefined;
  let active = false;
  let last = 0;
  const quiet = (p: Promise<unknown>) => p.catch(() => {});

  // Loaded on first click only
  const get = () =>
    (player ??= import('@vimeo/player').then(({ default: VimeoPlayer }) => {
      const p = new VimeoPlayer(iframe);
      // Paused by the browser (sound refused): back to the silent loop
      p.on('pause', () => active && done());
      // The embed loops, so the end of the reel shows up as time jumping back to the start
      p.on('timeupdate', ({ seconds }) => {
        if (!active) return;
        if (seconds + 1 < last) return done();
        if (seconds < last + 2) last = seconds; // ignore stale times from before the restart
      });
      return p;
    }));

  return {
    play() {
      active = true;
      last = 0;
      get().then((p) => {
        // Fire and forget: background embeds don't always answer every call
        quiet(p.setCurrentTime(0));
        quiet(p.setMuted(false));
        quiet(p.setVolume(1));
        p.play().catch(() => { done(); refused(); });
      }, done);
    },
    stop() {
      active = false;
      get().then((p) => {
        quiet(p.setMuted(true));
        quiet(p.play());
      }, () => {});
    },
  };
}
