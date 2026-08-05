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
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
      }

      const formData = new FormData(form);

      try {
        const response = await fetch('https://formspree.io/f/mqalbqpl', {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: formData
        });

        if (response.ok) {
          status.innerHTML = '<p class="success">Thanks for reaching out! We will get back to you shortly.</p>';
          form.reset();
        } else {
          const data = await response.json();
          if (data && data.errors) {
            status.innerHTML = `<p class="error">${data.errors.map(e => e.message).join(', ')}</p>`;
          } else {
            status.innerHTML = '<p class="error">Oops! There was a problem submitting your form.</p>';
          }
        }
      } catch (error) {
        status.innerHTML = '<p class="error">Network error. Please try again later.</p>';
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Message';
        }
      }
    });
  }

  /* ============================
     HAMBURGER & MOBILE MENU
  ============================ */
  const hamburger = document.querySelector('.hamburger');
  const nav = document.querySelector('.main-nav');

  if (hamburger && nav) {
    const toggleMenu = () => {
      const isOpen = hamburger.classList.toggle('open');
      nav.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };

    hamburger.addEventListener('click', toggleMenu);

    // Keyboard navigation support for hamburger
    hamburger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleMenu();
      }
    });
  }

  /* ============================
     SMOOTH SCROLL & AUTO-SELECT
  ============================ */
  // Handles internal anchors for navigation links, hero buttons, and pricing CTAs
  const internalLinks = document.querySelectorAll('a[href^="#"]');
  const serviceSelect = document.getElementById('service-type');

  internalLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');

      if (targetId && targetId !== '#') {
        const targetElement = document.querySelector(targetId);

        if (targetElement) {
          e.preventDefault();

          // Smooth scroll to target
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

          // Auto-select service in contact form if coming from a specific context
          if (serviceSelect && targetId === '#contact') {
            const parentCard = link.closest('.pricing-card, .service-card, .hero-split');
            if (parentCard) {
              const cardText = parentCard.textContent.toLowerCase();
              if (cardText.includes('hospitality') || cardText.includes('ops')) {
                serviceSelect.value = 'hospitality';
              } else if (cardText.includes('web') || cardText.includes('ai') || cardText.includes('digital')) {
                serviceSelect.value = 'webdev';
              }
            }
          }

          // Close mobile menu if open
          if (nav && nav.classList.contains('open')) {
            nav.classList.remove('open');
            if (hamburger && hamburger.classList.contains('open')) {
              hamburger.classList.remove('open');
              hamburger.setAttribute('aria-expanded', 'false');
            }
          }
        }
      }
    });
  });

});