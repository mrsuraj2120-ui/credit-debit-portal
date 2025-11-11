// backend/public/js/rolecheck.js

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // ✅ Fetch current logged-in user from backend session (same as index.html)
    const res = await fetch('/api/session', { credentials: 'include' });
    const user = await res.json();

    // 🚫 If not logged in, send to login page
    if (!user || !user.Role) {
      window.location.href = 'login.html';
      return;
    }

    // 🧾 Store user info globally
    window.currentUser = user;

    // ✅ Sidebar role update (AFTER DOM is ready)
    const roleEl = document.getElementById('adminRole');
    if (roleEl) {
      roleEl.textContent = user.Role || 'User';
    }

    // 🧑‍💻 Optional: emoji-based header update like dashboard
    const emojiEl = document.getElementById('userEmoji');
    const nameEl = document.getElementById('userNameHeader');
    if (emojiEl && nameEl) {
      let emoji = '🙂';
      if (user.Role && user.Role.toLowerCase().includes('admin')) emoji = '👑';
      else if (user.Role && user.Role.toLowerCase().includes('manager')) emoji = '🧑‍💼';
      emojiEl.textContent = emoji;
      nameEl.textContent = user.Name || user.Email || 'User';
    }

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

    // 🔐 Hide admin-only links for non-admins
    const nav = document.querySelector('.nav');
    if (nav && user.Role !== 'Admin') {
      const adminLink = Array.from(nav.querySelectorAll('a'))
        .find(a => a.href && a.href.includes('admin.html'));
      if (adminLink) adminLink.style.display = 'none';
    }

    // ✅ Show user label (if used elsewhere)
    const userLabel = document.querySelector('#userLabel');
    if (userLabel) {
      userLabel.textContent = `${user.Name} (${user.Role})`;
    }

  } catch (err) {
    console.error('Role check failed:', err);
    window.location.href = 'login.html';
  }

  // 🧩 Redirect rules (run after fetch)
  if (window.location.pathname.includes('admin.html') && window.currentUser?.Role !== 'Admin') {
    window.location.href = 'index.html';
  }
  if (window.location.pathname.includes('index.html') && window.currentUser?.Role === 'Admin') {
    window.location.href = 'admin.html';
  }
});
