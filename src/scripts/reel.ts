// Home showreel, when the hero plays a direct video file (reel.file in
// src/data/site.ts). "Play reel" restarts it from the top with sound and the
// button becomes "Stop". Stop, the end of the reel, or scrolling the hero out of
// view returns it to the silent loop. The video is part of the page, so the
// click itself unlocks sound in every browser, iPhones included, and no Vimeo
// controls are involved. With a Vimeo loop instead of a file, nothing here
// runs and the button stays a plain link to the reel on Vimeo.

const hero = document.querySelector<HTMLElement>('[data-reel]');
const video = hero?.querySelector('video');
if (hero && video) setup(hero, video);

function setup(hero: HTMLElement, video: HTMLVideoElement) {
  const toggle = hero.querySelector<HTMLAnchorElement>('[data-reel-toggle]')!;
  const label = toggle.querySelector('span')!;
  let playing = false;

  toggle.setAttribute('role', 'button');
  toggle.setAttribute('aria-pressed', 'false');

  function set(on: boolean) {
    playing = on;
    hero.classList.toggle('playing', on);
    label.textContent = on ? 'Stop' : 'Play reel';
    toggle.setAttribute('aria-pressed', String(on));
  }

  function play() {
    set(true);
    video.loop = false;
    video.currentTime = 0;
    video.muted = false;
    video.volume = 1;
    video.play().catch(stop);
  }

  function stop() {
    set(false);
    video.muted = true;
    video.loop = true;
    video.play().catch(() => {});
  }

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    if (playing) stop();
    else play();
  });
  video.addEventListener('ended', () => playing && stop());
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting && playing) stop();
  }).observe(hero);
}
