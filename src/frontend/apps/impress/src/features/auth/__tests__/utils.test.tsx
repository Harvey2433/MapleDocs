import fetchMock from 'fetch-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SILENT_LOGIN_RETRY } from '../conf';
import { gotoLogout, gotoSilentLogin } from '../utils';

// Add mock on window.location.replace
const mockReplace = vi.fn();
Object.defineProperty(window, 'location', {
  value: {
    ...window.location,
    replace: mockReplace,
    href: 'http://test.jest/',
  },
  writable: true,
  configurable: true,
});

const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

describe('utils', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  afterEach(() => {
    vi.clearAllMocks();
    fetchMock.hardReset();
    mockReplace.mockClear();
    setItemSpy.mockClear();
    localStorage.clear();
  });

  it('checks logout redirects to logout URL', async () => {
    fetchMock.post('http://test.jest/api/v1.0/auth/local/logout/', 204);
    gotoLogout();

    await vi.waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login/');
    });
    expect(fetchMock.callHistory.called()).toBe(true);
  });

  it('checks the gotoSilentLogin', async () => {
    gotoSilentLogin();

    expect(mockReplace).toHaveBeenCalledWith(
      'http://test.jest/api/v1.0/authenticate/?silent=true&next=http%3A%2F%2Ftest.jest%2F',
    );
    expect(setItemSpy).toHaveBeenCalledWith(SILENT_LOGIN_RETRY, 'true');
  });
});
