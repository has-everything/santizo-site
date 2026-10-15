// Photos page viewer. Clicking a photo in [data-gallery] opens it full screen
// in the <dialog data-lightbox>. Arrow keys or ← → buttons step through,
// swiping works on phones, Esc or Close shuts it. Without JavaScript each
// photo is a plain link to the image file.

const gallery = document.querySelector<HTMLElement>('[data-gallery]');
const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox]');
if (gallery && dialog) setup(gallery, dialog);

function setup(gallery: HTMLElement, dialog: HTMLDialogElement) {
  const links = [...gallery.querySelectorAll<HTMLAnchorElement>('a')];
  const big = dialog.querySelector('img')!;
  const count = dialog.querySelector('.count')!;
  const pad = (n: number) => String(n).padStart(2, '0');
  let index = 0;

  function show(n: number) {
    index = (n + links.length) % links.length;
    const link = links[index];
    big.src = link.href;
    big.alt = link.querySelector('img')!.alt;
    count.textContent = `${pad(index + 1)} / ${pad(links.length)}`;
  }

  links.forEach((link, n) =>
    link.addEventListener('click', (e) => {
      e.preventDefault();
      show(n);
      dialog.showModal();
    }),
  );

  dialog.querySelector('[data-prev]')!.addEventListener('click', () => show(index - 1));
  dialog.querySelector('[data-next]')!.addEventListener('click', () => show(index + 1));
  dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });

  // Swipe left or right to step through
  let startX: number | null = null;
  dialog.addEventListener('pointerdown', (e) => (startX = e.clientX));
  dialog.addEventListener('pointercancel', () => (startX = null));
  dialog.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
  });
}
