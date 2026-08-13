// Mobile nav toggle
document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
      var isOpen = links.classList.contains('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      toggle.textContent = isOpen ? '✕' : '☰';
    });
  }

  // Article category filter (works on articles.html)
  var pills = document.querySelectorAll('.filter-pill');
  var cards = document.querySelectorAll('[data-category]');
  if (pills.length && cards.length) {
    pills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        pills.forEach(function (p) { p.classList.remove('active'); });
        pill.classList.add('active');
        var cat = pill.getAttribute('data-filter');
        cards.forEach(function (card) {
          var show = cat === 'all' || card.getAttribute('data-category') === cat;
          card.style.display = show ? '' : 'none';
        });
      });
    });
  }

  // Newsletter form (static site — no backend, so just confirm visually)
  var newsletterForm = document.querySelector('.newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = newsletterForm.querySelector('button');
      if (btn) {
        btn.textContent = 'Subscribed ✓';
        btn.disabled = true;
      }
    });
  }

  // Contact form (static site — no backend by default)
  var contactForm = document.querySelector('.simple-form[data-contact]');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = document.getElementById('form-note');
      if (note) {
        note.textContent = 'This form needs a backend (e.g. Cloudflare Pages Functions or a service like Formspree) to actually send messages — see the README.';
        note.style.display = 'block';
      }
    });
  }
});
