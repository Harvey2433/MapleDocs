import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import PersonSVG from '@/assets/icons/ui-kit/person.svg';
import PaletteSVG from '@/assets/icons/ui-kit/settings.svg';
import { Box } from '@/components';
import { useAppearance } from '@/features/appearance';
import { ButtonLogin, ProfileSettings, useAuth } from '@/features/auth';

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const LeftPanelFooter = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openSettings } = useAppearance();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <Box className="maple-sidebar-footer" $direction="row" $align="center">
      {user ? (
        <>
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
