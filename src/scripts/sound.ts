// Sound on / Sound off over a project video (VideoPlayer with `sound`). The
// video's Vimeo settings autoplay it muted, and the embed hides Vimeo's own
// controls (controls=0), so this button is the only way to hear it.
//
// Sound on unmutes the video where it is, or plays it again from the top if it
// has finished. Sound off mutes it and lets it keep playing. The label follows
// what the player reports after every play, pause, end and volume change, so it
// stays right if the browser refuses sound.
//
// iPhones and iPads refuse sound started from the page on a Vimeo embed (as on
// the home reel), so there the button stays hidden and the player gets Vimeo's
// own controls back: its Unmute button, tapped inside the player, works.
import type Player from '@vimeo/player';
import { isIOS } from './ios';

document.querySelectorAll<HTMLElement>('[data-sound]').forEach(setup);

function setup(box: HTMLElement) {
  const iframe = box.querySelector('iframe')!;
  const toggle = box.querySelector<HTMLButtonElement>('[data-sound-toggle]')!;
  const label = toggle.querySelector('span')!;
  if (isIOS()) {
    iframe.src = iframe.src.replace('&controls=0', '');
    return;
  }
  let on = false;
  let player: Promise<Player> | undefined;
  const quiet = (p: Promise<unknown>) => p.catch(() => {});

  function set(next: boolean) {
    on = next;
    box.classList.toggle('sound-on', on);
    label.textContent = on ? 'Sound off' : 'Sound on';
    toggle.setAttribute('aria-pressed', String(on));
  }

  // Loaded on first click only
  const get = () =>
    (player ??= import('@vimeo/player').then(({ default: VimeoPlayer }) => {
      const p = new VimeoPlayer(iframe);
      const sync = () =>
        Promise.all([p.getPaused(), p.getMuted(), p.getVolume()])
          .then(([paused, muted, volume]) => set(!paused && !muted && volume > 0), () => {});
      for (const e of ['play', 'pause', 'ended', 'volumechange']) p.on(e, sync);
      return p;
    }));

  toggle.addEventListener('click', () => {
    const next = !on;
    set(next); // right away; the player's events correct it if it disagrees
    get().then((p) => {
      if (!next) return quiet(p.setMuted(true));
      quiet(p.setMuted(false));
      quiet(p.setVolume(1));
      Promise.all([p.getEnded(), p.getPaused()]).then(([ended, paused]) => {
        if (ended) quiet(p.setCurrentTime(0));
        if (ended || paused) quiet(p.play());
      }, () => {});
    }, () => set(false));
  });

  toggle.hidden = false;
  box.querySelector<HTMLElement>('.shade')!.hidden = false;
}
