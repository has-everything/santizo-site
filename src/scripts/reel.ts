// Home showreel sound. "Play reel" restarts the hero loop from the top with
// sound; "Mute" silences it again, and so does scrolling the hero out of view.
// Some browsers (iPhones in particular) block sound that a page starts on a
// video. When that happens the hero switches to Vimeo's own player instead,
// where one tap plays the reel with sound. Either way the visitor stays here.
import type Player from '@vimeo/player';

const hero = document.querySelector<HTMLElement>('[data-reel]');
if (hero) setup(hero);

function setup(hero: HTMLElement) {
  const toggle = hero.querySelector<HTMLAnchorElement>('[data-reel-toggle]')!;
  const label = toggle.querySelector('span')!;
  const close = hero.querySelector<HTMLButtonElement>('[data-reel-close]')!;
  const frame = () => hero.querySelector('iframe')!;
  const ambientSrc = frame().src;
  const playerSrc = `https://player.vimeo.com/video/${hero.dataset.reel}?autoplay=1&dnt=1&title=0&byline=0&portrait=0&playsinline=1`;

  let player: Player | null = null;
  let sound = false;
  let busy = false;

  toggle.setAttribute('role', 'button');
  toggle.setAttribute('aria-pressed', 'false');

  function setSound(on: boolean) {
    sound = on;
    hero.classList.toggle('sound', on);
    label.textContent = on ? 'Mute' : 'Play reel';
    toggle.setAttribute('aria-pressed', String(on));
  }

  async function getPlayer() {
    if (!player) {
      const { default: VimeoPlayer } = await import('@vimeo/player');
      player = new VimeoPlayer(frame());
    }
    return player;
  }

  async function playWithSound() {
    const p = await getPlayer();
    await p.setCurrentTime(0);
    await p.setMuted(false);
    await p.setVolume(1);
    await p.play();
    // A browser that blocks the sound may accept the calls, then pause or re-mute a moment later.
    await wait(700);
    if ((await p.getPaused()) || (await p.getMuted())) throw new Error('sound blocked');
    setSound(true);
  }

  async function mute() {
    setSound(false);
    try { await (await getPlayer()).setMuted(true); } catch {}
  }

  // Swap in a fresh iframe (the old Player instance stays bound to the old one)
  function swapFrame(src: string, interactive: boolean) {
    const old = frame();
    const f = document.createElement('iframe');
    f.src = src;
    f.title = old.title;
    f.allow = 'autoplay; fullscreen; picture-in-picture';
    if (!interactive) f.tabIndex = -1;
    old.replaceWith(f);
    player = null;
  }

  function openPlayer() {
    setSound(false);
    swapFrame(playerSrc, true);
    hero.classList.add('player');
    close.hidden = false;
    close.focus();
  }

  function closePlayer() {
    swapFrame(ambientSrc, false);
    hero.classList.remove('player');
    close.hidden = true;
    toggle.focus();
  }

  toggle.addEventListener('click', async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    try {
      if (sound) await mute();
      else await withTimeout(playWithSound(), 6000);
    } catch {
      openPlayer();
    } finally {
      busy = false;
    }
  });

  close.addEventListener('click', closePlayer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !close.hidden) closePlayer();
  });

  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting && sound) mute();
  }).observe(hero);
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, wait(ms).then(() => { throw new Error('timed out'); })]);
}
