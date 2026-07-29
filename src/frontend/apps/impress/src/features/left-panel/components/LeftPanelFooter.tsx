import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import PaletteSVG from '@/assets/icons/maple/settings.svg';
import PersonSVG from '@/assets/icons/maple/user.svg';
import { Box } from '@/components';
import { useAppearance } from '@/features/appearance';
import { ButtonLogin, ProfileSettings, useAuth } from '@/features/auth';
import { gotoLogout } from '@/features/auth/utils';

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  const value =
    parts.length === 1
      ? Array.from(parts[0]).slice(0, 2).join('')
      : parts.map((part) => part[0]).join('');
  return value.slice(0, 2).toUpperCase();
};

export const LeftPanelFooter = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openSettings } = useAppearance();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <Box className="maple-sidebar-footer" $direction="row" $align="center">
      {user ? (
        <>
          <details className="maple-sidebar-account">
            <summary title={t('Account')}>
              <span className="maple-sidebar-avatar" aria-hidden="true">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" />
                ) : (
                  initials(user.full_name)
                )}
              </span>
              <span className="maple-sidebar-user">
                <strong>{user.full_name}</strong>
                <small>{user.email}</small>
              </span>
            </summary>
            <div className="maple-account-menu">
              <button type="button" onClick={gotoLogout}>
                {t('Log out')}
              </button>
            </div>
          </details>
          <Button
            aria-label={t('Edit profile')}
            title={t('Edit profile')}
            size="small"
            variant="tertiary"
            color="neutral"
            icon={<PersonSVG width={20} height={20} aria-hidden="true" />}
            onClick={() => setProfileOpen(true)}
          />
          <Button
            aria-label={t('Personalization settings')}
            title={t('Personalization settings')}
            size="small"
            variant="tertiary"
            color="neutral"
            icon={<PaletteSVG width={20} height={20} aria-hidden="true" />}
            onClick={openSettings}
          />
        </>
      ) : (
        <ButtonLogin />
      )}
      {user && profileOpen && (
        <ProfileSettings user={user} onClose={() => setProfileOpen(false)} />
      )}
    </Box>
  );
};
