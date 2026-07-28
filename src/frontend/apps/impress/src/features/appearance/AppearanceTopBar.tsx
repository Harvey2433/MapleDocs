import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

import PaletteSVG from '@/assets/icons/ui-kit/palette.svg';

import { useAppearance } from './AppearanceProvider';

export const AppearanceTopBar = () => {
  const { pathname } = useRouter();
  const { t } = useTranslation();
  const { effectiveTheme, toggleTheme, openSettings } = useAppearance();
  if (pathname === '/' || pathname.startsWith('/docs/')) {
    return null;
  }
  return (
    <div className="maple-top-actions">
      <Button
        aria-label={t('Personalization settings')}
        title={t('Personalization settings')}
        size="small"
        variant="tertiary"
        color="neutral"
        icon={<PaletteSVG aria-hidden="true" width={22} height={22} />}
        onClick={openSettings}
      />
      <Button
        aria-label={t('Switch color mode')}
        title={t('Switch color mode')}
        size="small"
        variant="tertiary"
        color="neutral"
        icon={
          <span className="material-symbols-outlined" aria-hidden="true">
            {effectiveTheme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        }
        onClick={toggleTheme}
      />
    </div>
  );
};
