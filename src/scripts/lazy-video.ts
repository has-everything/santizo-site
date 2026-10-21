// Tile clips served from this site (Media with a `video`, lazy). The video has
// preload="none" and its poster is a lazy <img> behind it, so neither loads
// until needed. Each clip downloads and plays as it comes within a screen of
// view, like the Vimeo tiles' loading="lazy", and pauses once it is a screen
// away, so off-screen tiles stop decoding. If the browser won't autoplay (iOS
// Low Power Mode), the poster stays.
const near = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const video = e.target as HTMLVideoElement;
      if (e.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }
  },
  { rootMargin: '100% 0px' },
);

document.querySelectorAll<HTMLVideoElement>('video[data-lazy-video]').forEach((v) => near.observe(v));
