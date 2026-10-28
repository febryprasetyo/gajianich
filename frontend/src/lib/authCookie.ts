// Cookies are shared across ports on the same host; keep production separate.
export const AUTH_COOKIE_NAME = process.env.NODE_ENV === 'production' ? 'gajianich_prod_token' : 'token';
