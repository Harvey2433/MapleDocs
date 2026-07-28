import { baseApiUrl } from '@/api';

export const LOGIN_URL = '/login/';
export const OIDC_LOGIN_URL = `${baseApiUrl()}authenticate/`;
export const LOGOUT_URL = `${baseApiUrl()}auth/local/logout/`;
export const PATH_AUTH_SESSION_STORAGE = 'docs-path-auth';
export const SILENT_LOGIN_RETRY = 'silent-login-retry';
