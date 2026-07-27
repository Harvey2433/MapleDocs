import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import LogoutSVG from '@/assets/icons/ui-kit/logout.svg';
import PaletteSVG from '@/assets/icons/ui-kit/palette.svg';
import PersonSVG from '@/assets/icons/ui-kit/person.svg';
import { Box, SeparatedSection, Text } from '@/components';
import { Waffle } from '@/components/Waffle';
import { useAppearance } from '@/features/appearance';
import { ButtonLogin, ProfileSettings } from '@/features/auth';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { gotoLogout } from '@/features/auth/utils';
import { HelpMenu } from '@/features/help';

export const LeftPanelFooter = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openSettings } = useAppearance();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <SeparatedSection showSeparator="top" $margin={{ top: 'auto' }}>
      <Box
        $padding={{ horizontal: 'sm' }}
        $justify="space-between"
        $direction="row"
      >
        <Box $direction="row" $align="center" $gap="0.2rem">
          {user && (
            <>
              <Button
                aria-label={t('Edit profile')}
                title={t('Edit profile')}
                size="small"
                variant="tertiary"
                color="neutral"
                icon={
                  user.avatar_url ? (
                    <img
                      className="maple-profile-avatar"
                      src={user.avatar_url}
                      alt=""
                    />
                  ) : (
                    <PersonSVG width={22} height={22} aria-hidden="true" />
                  )
                }
                onClick={() => setProfileOpen(true)}
              />
              <Box className="maple-profile-copy">
                <Text $size="s" $weight="600">
                  {user.full_name}
                </Text>
                <Text $size="xs" $variation="secondary">
                  {user.email}
                </Text>
              </Box>
              <Button
                aria-label={t('Personalization settings')}
                title={t('Personalization settings')}
                size="small"
                variant="tertiary"
                color="neutral"
                icon={<PaletteSVG width={22} height={22} aria-hidden="true" />}
                onClick={openSettings}
              />
              <Button
                aria-label={t('Log out')}
                title={t('Log out')}
                size="small"
                variant="tertiary"
                color="neutral"
                icon={<LogoutSVG width={22} height={22} aria-hidden="true" />}
                onClick={gotoLogout}
              />
            </>
          )}
          <Waffle />
          <ButtonLogin />
        </Box>
        <HelpMenu />
      </Box>
      {user && profileOpen && (
        <ProfileSettings user={user} onClose={() => setProfileOpen(false)} />
      )}
    </SeparatedSection>
  );
};
