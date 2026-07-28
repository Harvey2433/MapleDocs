import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

import { useLeftPanelStore } from '../stores';

import { LeftPanelContent } from './LeftPanelContent';
import { LeftPanelFooter } from './LeftPanelFooter';
import { LeftPanelHeader } from './LeftPanelHeader';

export const LeftPanel = ({ isResizable }: { isResizable?: boolean }) => {
  const { t } = useTranslation();
  const { isMobile } = useResponsiveStore();
  const { isPanelOpen, closePanel } = useLeftPanelStore();

  return (
    <>
      {isMobile && (
        <Box
          $css={css`
            position: fixed;
            inset: 0;
            z-index: 999;
            background-color: rgba(0, 0, 0, 0.3);
            transition: opacity 0.2s ease-in-out;
            opacity: ${isPanelOpen ? 1 : 0};
            pointer-events: ${isPanelOpen ? 'auto' : 'none'};
          `}
          onClick={closePanel}
        />
      )}
      <Box
        as="nav"
        className="--docs--left-panel"
        data-testid="left-panel"
        aria-label={t('Left panel')}
        $width={isResizable ? '100%' : '252px'}
        $css={css`
          height: 100dvh;
          overflow: hidden;
          background-color: var(--c--contextuals--background--surface--primary);
          box-shadow: 10px 0px 10px 0px rgba(0, 0, 0, 0.05);
          transition:
            transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
            width 280ms cubic-bezier(0.22, 1, 0.36, 1);

          ${
            !isResizable
              ? css`
                  border-right: 1px solid
                    var(--c--contextuals--border--surface--primary);
                `
              : ''
          }

          ${
            !isResizable && !isMobile
              ? css`
                  ${
                    !isPanelOpen
                      ? css`
                          transform: translateX(-100%);
                          width: 0;
                          border-right: 0;
                        `
                      : ''
                  }
                `
              : ''
          }

          ${
            isMobile
              ? css`
                  position: fixed;
                  z-index: 1000;
                  top: 0;
                  left: 0;
                  ${
                    !isPanelOpen
                      ? css`
                          transform: translateX(-100%);
                          width: 0;
                        `
                      : ''
                  }
                `
              : ''
          }
        `}
      >
        <Box
          $css={css`
            flex: 0 0 auto;
          `}
        >
          <LeftPanelHeader />
        </Box>
        <LeftPanelContent />
        <LeftPanelFooter />
      </Box>
    </>
  );
};
