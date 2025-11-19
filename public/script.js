document.addEventListener('DOMContentLoaded', () => {

  /* ============================
     CONTACT FORM (Formspree)
  ============================ */
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');

  if (form && status) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const formData = new FormData(form);

      try {
        const response = await fetch('https://formspree.io/f/mqalbqpl', {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: formData
        });

        if (response.ok) {
          status.innerHTML = '<p class="success">Thanks for your message! We will get back to you soon.</p>';
          form.reset();
        } else {
          const data = await response.json();
          if (data.errors) {
            status.innerHTML = `<p class="error">${data.errors.map(e => e.message).join(', ')}</p>`;
          } else {
            status.innerHTML = '<p class="error">Oops! There was a problem submitting your form.</p>';
          }
        }
      } catch (error) {
        status.innerHTML = '<p class="error">Network error. Please try again later.</p>';
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  /* ============================
     HAMBURGER MENU
  ============================ */
  const hamburger = document.querySelector('.hamburger');
  const nav = document.querySelector('.main-nav');

  if (hamburger && nav) {
    const toggleMenu = () => {
      hamburger.classList.toggle('open');
      nav.classList.toggle('open');
    };

    hamburger.addEventListener('click', toggleMenu);

    // Keyboard support
    hamburger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleMenu();
      }
    });
  }

  /* ============================
     SMOOTH SCROLL FOR NAV LINKS
  ============================ */
  const navLinks = document.querySelectorAll('.main-nav a');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId.startsWith('#')) {
        e.preventDefault();
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Close mobile menu after click
        if (nav.classList.contains('open')) {
          nav.classList.remove('open');
          if (hamburger.classList.contains('open')) hamburger.classList.remove('open');
        }
      }
    });
  });

});
