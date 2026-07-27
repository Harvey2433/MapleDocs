import { Button } from '@gouvfr-lasuite/cunningham-react';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Text } from '@/components';
import { useConfig } from '@/core';
import { OIDC_LOGIN_URL, getAuthUrl } from '@/features/auth';

const Page = () => {
  const { t } = useTranslation();
  const { data: config } = useConfig();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetchAPI(
        register ? 'auth/local/register/' : 'auth/local/login/',
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            ...(register ? { full_name: name } : {}),
          }),
        },
      );
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
      <section>
        <Text as="h1" $size="h3" $margin="0">
          MapleDocs
        </Text>
        <Text as="h2" $size="h5" $margin="0">
          {register ? t('Create an account') : t('Sign in')}
        </Text>
        {config?.LOCAL_AUTH_ENABLED && (
          <form onSubmit={(event) => void submit(event)}>
            {register && (
              <label>
                {t('Display name')}
                <input
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            )}
            <label>
              {t('Email')}
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              {t('Password')}
              <input
                required
                minLength={8}
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && (
              <Text role="alert" $theme="danger" $size="s">
                {error}
              </Text>
            )}
            <Button type="submit" fullWidth disabled={pending}>
              {pending
                ? t('Please wait...')
                : register
                  ? t('Create account')
                  : t('Sign in')}
            </Button>
          </form>
        )}
        {config?.LOCAL_AUTH_ENABLED &&
          config.LOCAL_AUTH_REGISTRATION_ENABLED && (
            <Button
              variant="tertiary"
              onClick={() => {
                setRegister((value) => !value);
                setError('');
              }}
            >
              {register
                ? t('I already have an account')
                : t('Create an account')}
            </Button>
          )}
        {config?.OIDC_ENABLED && (
          <Button
            variant="secondary"
            fullWidth
            onClick={() => window.location.replace(OIDC_LOGIN_URL)}
          >
            {t('Sign in with the organization account')}
          </Button>
        )}
      </section>
    </main>
  );
};

export default Page;
