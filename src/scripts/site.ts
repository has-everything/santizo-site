// Runs on every page: theme toggle, Los Angeles clock, scroll reveal.

const THEME_KEY = 'santizo-theme';
const root = document.documentElement;

// ---------- Theme (initial theme is set inline in <head> to avoid a flash) ----------

const toggles = document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]');
const isNight = () => root.dataset.theme === 'night';
const label = () => toggles.forEach((b) => (b.textContent = isNight() ? 'Light mode' : 'Dark mode'));

label();
toggles.forEach((b) =>
  b.addEventListener('click', () => {
    const next = isNight() ? 'day' : 'night';
    if (next === 'night') root.dataset.theme = 'night';
    else delete root.dataset.theme;
    label();
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  }),
);

// ---------- Clock ----------

let fmt: Intl.DateTimeFormat | null = null;
try {
  fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: false });
} catch {}

function tick() {
  if (!fmt) return;
  const s = fmt.format(new Date());
  document.querySelectorAll('[data-clock]').forEach((el) => (el.textContent = s));
}
tick();
setInterval(tick, 20000);

// ---------- Scroll reveal: .rv elements rise into place as they enter ----------

if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  root.classList.add('rv-on');
  const io = new IntersectionObserver(
    (entries) => {
      let n = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.style.transitionDelay = `${n++ * 0.12}s`;
        el.classList.add('in');
        io.unobserve(el);
        setTimeout(() => (el.style.transitionDelay = ''), 1800);
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0 },
  );
  document.querySelectorAll('.rv').forEach((el) => io.observe(el));
}
