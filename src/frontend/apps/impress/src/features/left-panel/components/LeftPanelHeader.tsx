import { useTranslation } from 'react-i18next';

import PanelLeftCloseIcon from '@/assets/icons/maple/panel-left-close.svg';
import { Box, StyledLink } from '@/components';
import { NewDocButton } from '@/docs/doc-management/components/NewDocButton';
import { useAuth } from '@/features/auth';
import { useResponsiveStore } from '@/stores';

import { useLeftPanelStore } from '../stores';

export const LeftPanelHeader = () => {
  const { t } = useTranslation();
  const { isMobile } = useResponsiveStore();
  const { closePanel, togglePanel } = useLeftPanelStore();

  return (
    <Box $width="100%" className="--docs--left-panel-header">
      <Box className="maple-sidebar-brand" $direction="row" $align="center">
        <StyledLink href="/" data-testid="header-logo-link">
          MapleDocs
        </StyledLink>
        <button
          className="maple-icon-button"
          type="button"
          onClick={isMobile ? closePanel : togglePanel}
          aria-label={t('Close left panel')}
          title={t('Close left panel')}
        >
          <PanelLeftCloseIcon aria-hidden="true" width={19} height={19} />
        </button>
      </Box>
      <LeftPanelHeaderActions />
    </Box>
  );
};
export const LeftPanelHeaderActions = () => {
  const { authenticated } = useAuth();
  const { closePanel } = useLeftPanelStore();
  const { isMobile } = useResponsiveStore();

  return (
    <Box className="maple-sidebar-actions" $width="100%">
      {authenticated && (
        <NewDocButton onClose={() => isMobile && closePanel()} />
      )}
    </Box>
  );
};
