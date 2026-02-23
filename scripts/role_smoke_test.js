(async () => {
  const base = 'http://localhost:3000';
  const fetch = global.fetch || (await import('node-fetch')).default;
  const log = (...args) => console.log(...args);

  async function post(path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  }

  async function get(path, token) {
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(base + path, { method: 'GET', headers });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch(e) { json = text; }
    return { status: res.status, json };
  }

  try {
    log('Logging in as admin...');
    const admin = await post('/api/auth/login', { username: 'admin', password: 'admin123' });
    if (!admin.json || !admin.json.token) { log('Admin login failed', admin); return; }
    const adminToken = admin.json.token;
    log('Admin token obtained (truncated):', adminToken.slice(0,20) + '...');

    log('Creating manager1 via admin...');
    const createManager = await post('/api/admin/users', { username: 'manager1', email: 'manager1@example.com', name: 'Manager One', password: 'manager123', role: 'manager' }, adminToken);
    log('createManager:', createManager.status, createManager.json);

    log('Logging in as manager1...');
    const managerLogin = await post('/api/auth/login', { username: 'manager1', password: 'manager123' });
    const managerToken = managerLogin.json && managerLogin.json.token;
    log('Manager login status:', managerLogin.status, managerToken ? 'token ok' : managerLogin.json);

    log('Creating geomar1 via admin...');
    const createGeo = await post('/api/admin/users', { username: 'geomar1', email: 'geomar1@example.com', name: 'GeoMar User', password: 'geomar123', role: 'geomar' }, adminToken);
    log('createGeo:', createGeo.status, createGeo.json);

    log('Logging in as geomar1...');
    const geomarLogin = await post('/api/auth/login', { username: 'geomar1', password: 'geomar123' });
    const geomarToken = geomarLogin.json && geomarLogin.json.token;
    log('GeoMar login status:', geomarLogin.status, geomarToken ? 'token ok' : geomarLogin.json);

    log('Logging in as driver (motorista1)...');
    const driverLogin = await post('/api/auth/login', { username: 'motorista1', password: 'driver123' });
    const driverToken = driverLogin.json && driverLogin.json.token;
    log('Driver login status:', driverLogin.status, driverToken ? 'token ok' : driverLogin.json);

    log('\n--- GET /api/admin/users as admin');
    const adminGet = await get('/api/admin/users', adminToken);
    log('status:', adminGet.status, 'bodySummary:', adminGet.json && (adminGet.json.users ? (adminGet.json.users.length + ' users') : adminGet.json));

    log('\n--- GET /api/admin/users as manager');
    const managerGet = await get('/api/admin/users', managerToken);
    log('status:', managerGet.status, 'bodySummary:', managerGet.json && (managerGet.json.users ? (managerGet.json.users.length + ' users') : managerGet.json));

    log('\n--- GET /api/admin/users as geomar');
    const geomarGet = await get('/api/admin/users', geomarToken);
    log('status:', geomarGet.status, 'bodySummary:', geomarGet.json && (geomarGet.json.users ? (geomarGet.json.users.length + ' users') : geomarGet.json));

    log('\n--- GET /api/admin/users as driver (expect 403)');
    const driverGet = await get('/api/admin/users', driverToken);
    log('status:', driverGet.status, 'body:', driverGet.json);

  } catch (err) {
    console.error('Error during tests:', err);
  }
})();
