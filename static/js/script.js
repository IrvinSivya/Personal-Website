//Header
document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('nav-links');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('show');
    });
  }

  // Resume button: make it obvious the PDF is downloading
  const resumeLinks = document.querySelectorAll('.resume-link');

  const showToast = (message) => {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    // next frame so the transition runs
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  resumeLinks.forEach((link) => {
    link.addEventListener('click', () => {
      showToast('Downloading resume (PDF)…');
    });
  });

  // Transparent-over-hero header goes solid once you scroll past the top
  const header = document.getElementById('main-header');

  if (header && header.classList.contains('transparent')) {
    const onScroll = () => {
      if (window.scrollY > 40) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
});
