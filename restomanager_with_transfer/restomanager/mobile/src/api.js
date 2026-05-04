// =============================================================================
//  API client — port từ frontend/js/api.js sang React Native (AsyncStorage).
//  Envelope chuẩn:
//     ok:    { success:true,  data, message?, meta? }
//     err:   { success:false, message, error:{ code, details? } }
// =============================================================================
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  base:  'rm_api_base',
  token: 'rm_token',
  user:  'rm_user',
};

let _cache = { base: null, token: null, user: null };

export async function loadConfig() {
  const [b, t, u] = await Promise.all([
    AsyncStorage.getItem(KEYS.base),
    AsyncStorage.getItem(KEYS.token),
    AsyncStorage.getItem(KEYS.user),
  ]);
  _cache.base  = b || null;
  _cache.token = t || null;
  _cache.user  = u ? JSON.parse(u) : null;
  return { ..._cache };
}
export const getApiBase = () => _cache.base;
export async function setApiBase(url) {
  _cache.base = url;
  if (url) await AsyncStorage.setItem(KEYS.base, url);
  else await AsyncStorage.removeItem(KEYS.base);
}
export const getToken = () => _cache.token;
export async function setToken(tok) {
  _cache.token = tok;
  if (tok) await AsyncStorage.setItem(KEYS.token, tok);
  else await AsyncStorage.removeItem(KEYS.token);
}
export const getUser = () => _cache.user;
export async function setUser(u) {
  _cache.user = u;
  if (u) await AsyncStorage.setItem(KEYS.user, JSON.stringify(u));
  else await AsyncStorage.removeItem(KEYS.user);
}
export async function clearAuth() {
  _cache.token = null; _cache.user = null;
  await AsyncStorage.multiRemove([KEYS.token, KEYS.user]);
}

async function request(path, { method='GET', body, query, isForm } = {}) {
  if (!_cache.base) {
    const e = new Error('Chưa cấu hình API. Vào Cài đặt để nhập URL.');
    e.code = 'NO_BASE'; throw e;
  }
  let url = _cache.base.replace(/\/+$/, '') + path;
  if (query) {
    const qs = Object.entries(query)
      .filter(([_,v]) => v !== undefined && v !== null && v !== '')
      .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  const opts = { method, headers: {} };
  if (_cache.token) opts.headers['Authorization'] = 'Bearer ' + _cache.token;
  if (body !== undefined) {
    if (isForm) opts.body = body;
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  }
  let res, text, json;
  try {
    res = await fetch(url, opts);
    text = await res.text();
  } catch (netErr) {
    const e = new Error('Không kết nối được server. Kiểm tra URL & cùng mạng Wi-Fi.');
    e.code = 'NETWORK_ERROR'; throw e;
  }
  try { json = text ? JSON.parse(text) : {}; }
  catch { json = { success:false, message: text || `HTTP ${res.status}` }; }

  if (!res.ok || json.success === false) {
    const err = new Error((json && json.message) || `HTTP ${res.status}`);
    err.status  = res.status;
    err.code    = (json && json.error && json.error.code) || 'HTTP_' + res.status;
    err.details = json && json.error && json.error.details;
    if (err.status === 401 && (err.code === 'INVALID_TOKEN' || err.code === 'TOKEN_EXPIRED')) {
      await clearAuth();
    }
    throw err;
  }
  return json.data;
}

export const Api = {
  request,
  // Auth
  login:  (username, password) => request('/auth/login', { method:'POST', body:{username, password} }),
  me:     () => request('/auth/me'),
  logout: () => request('/auth/logout', { method:'POST' }).catch(()=>{}),
  // Users
  listUsers: () => request('/users'),
  // Menu
  listCategories: () => request('/menu/categories'),
  listMenu: (q) => request('/menu', { query: q }),
  // Tables
  listTables: (q) => request('/tables', { query: q }),
  // Orders
  listOrders: (q) => request('/orders', { query: q }),
  getOrder: (id) => request('/orders/' + id),
  getOpenOrderForTable: (tableId) => request('/orders/by-table/' + tableId),
  createOrder: (data) => request('/orders', { method:'POST', body: data }),
  addOrderItems: (id, items) => request('/orders/' + id + '/items', { method:'POST', body:{ items } }),
  updateOrderItem: (orderId, itemId, payload) =>
    request('/orders/' + orderId + '/items/' + itemId, { method:'PUT', body: payload }),
  removeOrderItem: (orderId, itemId) =>
    request('/orders/' + orderId + '/items/' + itemId, { method:'DELETE' }),
  cancelOrder: (id) => request('/orders/' + id, { method:'DELETE' }),
  checkout: (id, payload) => request('/orders/' + id + '/checkout', { method:'POST', body: payload }),
  // Invoices
  listInvoices: (q) => request('/invoices', { query: q }),
  getInvoice: (id) => request('/invoices/' + id),
  // Stats
  statsOverview: (q) => request('/stats/overview', { query: q }),
  // Health
  health: () => request('/health'),
};
