//Header
document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('nav-links');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('show');
    });
  }

  // Resume button: confirm the download and show the file name first
  const resumeLinks = document.querySelectorAll('.resume-link');
  const RESUME_FILE = 'Irvin_Sivya_Resume_Portfolio.pdf';

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

  const startDownload = (href) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = RESUME_FILE;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Downloading ' + RESUME_FILE);
  };

  const openDownloadModal = (href) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="dl-title">' +
        '<h3 class="modal-title" id="dl-title">Download resume?</h3>' +
        '<div class="modal-file">' +
          '<span class="modal-file-badge">PDF</span>' +
          '<span class="modal-file-name">' + RESUME_FILE + '</span>' +
        '</div>' +
        '<p class="modal-text">This will download the PDF to your device.</p>' +
        '<div class="modal-actions">' +
          '<button type="button" class="modal-btn cancel">Cancel</button>' +
          '<button type="button" class="modal-btn confirm">Download</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    const close = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 250);
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };

    overlay.querySelector('.cancel').addEventListener('click', close);
    overlay.querySelector('.confirm').addEventListener('click', () => {
      startDownload(href);
      close();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', onKey);
  };

  resumeLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openDownloadModal(link.getAttribute('href'));
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
