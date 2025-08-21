document.addEventListener("DOMContentLoaded", () => {
  // Mobile menu toggle
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });

    // Close mobile menu when link is clicked
    navMenu.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        navMenu.classList.remove('active');
      }
    });
  }

  // Search functionality (logs to console for now)
  const searchInput = document.querySelector('.search-input');

  if (searchInput) {
    searchInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        const query = this.value.trim();
        if (query) {
          console.log('Searching for:', query);
          // Redirect or trigger search here
          // Example: window.location.href = `/search?q=${encodeURIComponent(query)}`
        }
      }
    });
  }
});
