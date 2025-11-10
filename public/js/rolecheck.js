// backend/public/js/rolecheck.js

(async function initRole() {
  try {
    // ✅ Fetch current logged-in user from backend session
    const res = await fetch('/api/session', { credentials: 'include' });
    const user = await res.json();

    // 🚫 If not logged in, send to login page
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    // 🧾 Store user info globally (optional)
    window.currentUser = user;

    // 🧠 Hide create/add/new buttons for non-admins
    if (user.Role !== 'Admin') {
      const addButtons = Array.from(document.querySelectorAll('.btn'));
      addButtons.forEach(btn => {
        const txt = (btn.textContent || '').toLowerCase();
        if (txt.includes('create') || txt.includes('add') || txt.includes('new')) {
          btn.style.display = 'none';
        }
      });
    }

    // 🔐 Hide admin panel link for non-admins
    const nav = document.querySelector('.nav');
    if (nav && user.Role !== 'Admin') {
      const adminLink = Array.from(nav.querySelectorAll('a'))
        .find(a => a.href && a.href.includes('admin.html'));
      if (adminLink) adminLink.style.display = 'none';
    }

    // ✅ Optionally show user name in navbar (if you want)
    const userLabel = document.querySelector('#userLabel');
    if (userLabel) {
      userLabel.textContent = `${user.Name} (${user.Role})`;
    }

    } catch (err) {
    console.error('Role check failed:', err);
    window.location.href = 'login.html';
  }
})();

// Redirect Admin to admin.html, normal users to user.html
if (window.location.pathname.includes('admin.html') && window.currentUser?.Role !== 'Admin') {
  window.location.href = 'index.html';
}
if (window.location.pathname.includes('index.html') && window.currentUser?.Role === 'Admin') {
  window.location.href = 'admin.html';
}

