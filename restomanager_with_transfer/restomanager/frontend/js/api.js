// =============================================================================
//  RestoManager – Shared API client (sau chuẩn hoá)
//  Envelope server:
//     thành công: { success:true,  data, message?, meta? }
//     thất bại:   { success:false, message, error:{ code, details? } }
// =============================================================================
(function () {
  // Khi chạy qua Nginx (cùng origin), API ở /api. Khi mở file:// → fallback localhost:3000.
  const ORIGIN_API   = '/api';
  const FALLBACK_API = 'http://localhost:3000/api';
  const API_BASE = (location.protocol === 'http:' || location.protocol === 'https:')
    ? ORIGIN_API
    : FALLBACK_API;

  const TOKEN_KEY = 'rm_token';
  const USER_KEY  = 'rm_user';

  function getToken()  { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken(){ localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
  function getUser()   { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (_) { return null; } }
  function setUser(u)  { localStorage.setItem(USER_KEY, JSON.stringify(u)); }

  /**
   * request(path, opts)
   *  - opts.method, body, query, headers, isForm
   *  - opts.full = true → trả nguyên envelope { data, meta, message }
   *    mặc định false → trả thẳng `data` (giữ tương thích cũ).
   */
  async function request(path, { method = 'GET', body, query, headers, isForm, full = false } = {}) {
    let url = API_BASE + path;
    if (query) {
      const qs = new URLSearchParams(
        Object.entries(query).filter(([_, v]) => v !== undefined && v !== null && v !== '')
      ).toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }
    const opts = { method, headers: { ...(headers || {}) } };
    const tok = getToken();
    if (tok) opts.headers['Authorization'] = 'Bearer ' + tok;

    if (body !== undefined) {
      if (isForm) {
        opts.body = body; // FormData – không set Content-Type
      } else {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
    }
    let res, text, json;
    try {
      res = await fetch(url, opts);
      text = await res.text();
    } catch (netErr) {
      const e = new Error('Không thể kết nối tới server');
      e.code = 'NETWORK_ERROR';
      throw e;
    }
    try { json = text ? JSON.parse(text) : {}; }
    catch (_) { json = { success: false, message: text || `HTTP ${res.status}` }; }

    if (!res.ok || json.success === false) {
      const msg  = (json && json.message) || `HTTP ${res.status}`;
      const err  = new Error(msg);
      err.status  = res.status;
      err.code    = (json && json.error && json.error.code) || 'HTTP_' + res.status;
      err.details = json && json.error && json.error.details;
      // Tự logout khi token hỏng (giúp UI dễ xử lý)
      if (err.status === 401 && (err.code === 'INVALID_TOKEN' || err.code === 'TOKEN_EXPIRED')) {
        clearToken();
      }
      throw err;
    }
    return full ? { data: json.data, meta: json.meta || null, message: json.message || '' }
                : json.data;
  }

  const Api = {
    base: API_BASE,
    request,
    getToken, setToken, clearToken, getUser, setUser,

    // ─── Auth ───
    login:   (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
    me:      () => request('/auth/me'),
    logout:  () => request('/auth/logout', { method: 'POST' }).catch(() => {}),

    // ─── Users ───
    listUsers:   (q)         => request('/users', { query: q }),
    listUsersFull:(q)        => request('/users', { query: q, full: true }),
    createUser:  (data)      => request('/users', { method: 'POST', body: data }),
    updateUser:  (id, data)  => request('/users/' + id, { method: 'PUT', body: data }),
    resetPwd:    (id, password) => request('/users/' + id + '/password', { method: 'PUT', body: { password } }),
    deleteUser:  (id)        => request('/users/' + id, { method: 'DELETE' }),

    // ─── Menu ───
    listCategories: ()       => request('/menu/categories'),
    listMenu:       (q)      => request('/menu', { query: q }),
    listMenuFull:   (q)      => request('/menu', { query: q, full: true }),
    getMenuItem:    (id)     => request('/menu/' + id),
    createMenuItem: (formData) => request('/menu', { method: 'POST', body: formData, isForm: true }),
    updateMenuItem: (id, formData) => request('/menu/' + id, { method: 'PUT', body: formData, isForm: true }),
    deleteMenuItem: (id)     => request('/menu/' + id, { method: 'DELETE' }),

    // ─── Tables ───
    listTables:  (q)         => request('/tables', { query: q }),
    listTablesFull:(q)       => request('/tables', { query: q, full: true }),
    createTable: (data)      => request('/tables', { method: 'POST', body: data }),
    updateTable: (id, data)  => request('/tables/' + id, { method: 'PUT', body: data }),
    deleteTable: (id)        => request('/tables/' + id, { method: 'DELETE' }),

    // ─── Orders ───
    listOrders:  (q)         => request('/orders', { query: q }),
    listOrdersFull:(q)       => request('/orders', { query: q, full: true }),
    createOrder: (data)      => request('/orders', { method: 'POST', body: data }),
    getOrder:    (id)        => request('/orders/' + id),
    getOpenOrderForTable: (tableId) => request('/orders/by-table/' + tableId),
    addOrderItems: (id, items) => request('/orders/' + id + '/items', { method: 'POST', body: { items } }),
    updateOrderItem: (orderId, itemId, payload) =>
      request('/orders/' + orderId + '/items/' + itemId, { method: 'PUT', body: payload }),
    removeOrderItem: (orderId, itemId) =>
      request('/orders/' + orderId + '/items/' + itemId, { method: 'DELETE' }),
    transferTable: (orderId, toTableId) =>
      request('/orders/' + orderId + '/transfer', { method: 'POST', body: { to_table_id: toTableId } }),
    updateOrderStatus: (id, status) => request('/orders/' + id + '/status', { method: 'PUT', body: { status } }),
    cancelOrder: (id)        => request('/orders/' + id, { method: 'DELETE' }),
    checkout:    (id, payload) => request('/orders/' + id + '/checkout', { method: 'POST', body: payload }),

    // ─── Invoices ───
    listInvoices:  (q)       => request('/invoices', { query: q }),
    listInvoicesFull:(q)     => request('/invoices', { query: q, full: true }),
    getInvoice:    (id)      => request('/invoices/' + id),

    // ─── Files ───
    uploadFile: (file, prefix) => {
      const fd = new FormData();
      fd.append('file', file);
      if (prefix) fd.append('prefix', prefix);
      return request('/files/upload', { method: 'POST', body: fd, isForm: true });
    },

    // ─── Stats ───
    statsOverview: (q) => request('/stats/overview', { query: q }),
    statsDaily:    (q) => request('/stats/daily', { query: q }),

    // ─── Logs ───
    listLogs:     (q) => request('/logs', { query: q }),
    listLogsFull: (q) => request('/logs', { query: q, full: true }),
  };

  window.Api = Api;
})();
