import Head from 'next/head';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { APIError, errorCauses, fetchAPI } from '@/api';
import EyeSVG from '@/assets/icons/ui-kit/visibility.svg';
import { useConfig } from '@/core';
import { OIDC_LOGIN_URL, getAuthUrl } from '@/features/auth';

const Page = () => {
  const { t } = useTranslation();
  const { data: config } = useConfig();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetchAPI('auth/local/login/', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        throw new APIError(
          'Authentication failed',
          await errorCauses(response),
        );
      }
      window.location.replace(getAuthUrl() || '/');
    } catch (reason) {
      setError(
        reason instanceof APIError
          ? reason.cause?.join(' ') || t('Unable to sign in')
          : t('Unable to sign in'),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="maple-login">
      <Head>
        <title>{`${t('Sign in')} - MapleDocs`}</title>
      </Head>
      <div className="maple-login-shade" aria-hidden="true" />
      <section className="maple-login-shell" aria-labelledby="login-title">
        <div className="maple-login-card">
          <header className="maple-login-brand">
            <h1>MapleDocs</h1>
            <p>{t('Write together, keep every idea in sync.')}</p>
          </header>

          {error && (
            <div className="maple-login-error" role="alert">
              {error}
            </div>
          )}

          {config?.LOCAL_AUTH_ENABLED && (
            <form onSubmit={(event) => void submit(event)}>
              <h2 id="login-title" className="sr-only">
                {t('Sign in')}
              </h2>
              <label>
                <span>{t('Email')}</span>
                <input
                  required
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                <span>{t('Password')}</span>
                <span className="maple-password-field">
                  <input
                    required
                    minLength={8}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? t('Hide password') : t('Show password')
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    <EyeSVG aria-hidden="true" width={20} height={20} />
                  </button>
                </span>
              </label>
              <button
                className="maple-login-submit"
                type="submit"
                disabled={pending}
              >
                {pending ? t('Please wait...') : t('Sign in')}
              </button>
            </form>
          )}

          {config?.OIDC_ENABLED && (
            <button
              className="maple-login-oidc"
              type="button"
              onClick={() => window.location.replace(OIDC_LOGIN_URL)}
            >
              {t('Sign in with the organization account')}
            </button>
          )}
        </div>
        <footer>© {new Date().getFullYear()} MapleDocs</footer>
      </section>
    </main>
  );
};

export default Page;
