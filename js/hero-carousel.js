// Hero hosting carousel — rotates through every slide inside #hostCarousel.
// Adding a future host is just adding another .hero-pick-slide in the HTML;
// this script reads the slide count at runtime, so nothing here needs
// updating as the lineup grows.
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var track = document.getElementById('hostCarousel');
    var dotsWrap = document.getElementById('hostCarouselDots');
    if (!track || !dotsWrap) return;

    var slides = track.querySelectorAll('.hero-pick-slide');
    if (slides.length < 2) return; // nothing to rotate

    var index = 0;
    var AUTO_MS = 6000;
    var timer = null;

    slides.forEach(function (_, i) {
      var dot = document.createElement('button');
      dot.className = 'hero-pick-dot' + (i === 0 ? ' is-active' : '');
      dot.setAttribute('aria-label', 'Show host ' + (i + 1) + ' of ' + slides.length);
      dot.addEventListener('click', function () {
        goTo(i);
        restart();
      });
      dotsWrap.appendChild(dot);
    });
    var dots = dotsWrap.querySelectorAll('.hero-pick-dot');

    function goTo(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(-' + (index * 100) + '%)';
      dots.forEach(function (d, di) {
        d.classList.toggle('is-active', di === index);
      });
    }

    function next() { goTo(index + 1); }

    function start() {
      timer = setInterval(next, AUTO_MS);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }
    function restart() {
      stop();
      start();
    }

    var wrap = track.closest('.hero-pick');
    if (wrap) {
      wrap.addEventListener('mouseenter', stop);
      wrap.addEventListener('mouseleave', start);
      wrap.addEventListener('focusin', stop);
      wrap.addEventListener('focusout', start);
    }

    start();
  });
})();
