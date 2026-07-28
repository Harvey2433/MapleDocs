import { safeLocalStorage, safeSessionStorage } from '@/utils/storages';

import {
  LOGIN_URL,
  LOGOUT_URL,
  OIDC_LOGIN_URL,
  PATH_AUTH_SESSION_STORAGE,
  SILENT_LOGIN_RETRY,
} from './conf';

/**
 * Get the stored auth URL from session storage (per-tab)
 */
export const getAuthUrl = () => {
  const path_auth = safeSessionStorage.getItem(PATH_AUTH_SESSION_STORAGE);
  if (path_auth) {
    safeSessionStorage.removeItem(PATH_AUTH_SESSION_STORAGE);
    return path_auth;
  }
};

/**
 * Store the current path in session storage (per-tab) if it's not the root,
 * so we can redirect the user to this path after login.
 * Using sessionStorage ensures each tab independently tracks its own URL.
 */
export const setAuthUrl = () => {
  if (window.location.pathname !== '/') {
    safeSessionStorage.setItem(PATH_AUTH_SESSION_STORAGE, window.location.href);
  }
};

export const gotoLogin = (withRedirect = true) => {
  if (withRedirect) {
    setAuthUrl();
  }

  window.location.replace(LOGIN_URL);
};

export const gotoSilentLogin = () => {
  // Already tried silent login, dont try again
  if (!hasTrySilent()) {
    const params = new URLSearchParams({
      silent: 'true',
      next: window.location.href,
    });

    safeLocalStorage.setItem(SILENT_LOGIN_RETRY, 'true');

    const REDIRECT = `${OIDC_LOGIN_URL}?${params.toString()}`;
    window.location.replace(REDIRECT);
  }
};

export const hasTrySilent = () => {
  return !!safeLocalStorage.getItem(SILENT_LOGIN_RETRY);
};

export const resetSilent = () => {
  safeLocalStorage.removeItem(SILENT_LOGIN_RETRY);
};

export const gotoLogout = () => {
  const csrfToken = document.cookie
    .split(';')
    .find((cookie) => cookie.trim().startsWith('csrftoken='))
    ?.split('=')[1];
  void fetch(LOGOUT_URL, {
    method: 'POST',
    credentials: 'include',
    headers: csrfToken ? { 'X-CSRFToken': csrfToken } : undefined,
  }).finally(() => window.location.replace(LOGIN_URL));
};
