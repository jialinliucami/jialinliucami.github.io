(() => {
  const album = document.querySelector('#cats');
  if (!album) return;
  const track = album.querySelector('.cat-track');
  const slides = [...track.querySelectorAll('.cat-slide')];
  const status = album.querySelector('#cat-status');
  const images = slides.map(slide => slide.querySelector('img'));
  const englishDescriptions = images.map(image => image.alt);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let scrollTimer;

  function localize() {
    const chinese = document.documentElement.lang === 'zh-CN';
    track.setAttribute('aria-label', chinese ? '猫咪相册，可左右滑动或用方向键翻页' : 'Cat photos. Swipe or use the arrow keys.');
    images.forEach((image, i) => {
      image.alt = chinese ? image.dataset.altZh : englishDescriptions[i];
    });
  }

  function show(index) {
    current = (index + slides.length) % slides.length;
    track.scrollTo({ left: current * track.clientWidth, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    status.textContent = (current + 1) + ' / ' + slides.length;
  }

  album.querySelectorAll('[data-cat-step]').forEach(button => {
    button.addEventListener('click', () => show(current + Number(button.dataset.catStep)));
  });
  track.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    show(current + (event.key === 'ArrowLeft' ? -1 : 1));
  });
  track.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      current = Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
      status.textContent = (current + 1) + ' / ' + slides.length;
    }, 100);
  }, { passive: true });
  new MutationObserver(localize).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  localize();
  album.querySelector('.cat-nav').hidden = false;
})();
