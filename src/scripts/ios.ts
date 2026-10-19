// iPhone, iPad (which reports itself as a Mac with touch), iPod: all WebKit.
// They refuse sound started from the page on a Vimeo embed (reel.ts, sound.ts).
export function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
