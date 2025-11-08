const api = {
  base: '/api',
  async get(path) {
    const res = await fetch(this.base + path);
    return res.ok ? res.json() : [];
  },
  async post(path, body) {
    const res = await fetch(this.base + path, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
    return res.json();
  },
  async put(path, body) {
    const res = await fetch(this.base + path, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
    return res.json();
  },
  async del(path) {
    const res = await fetch(this.base + path, { method: 'DELETE'});
    return res.json();
  }
};
