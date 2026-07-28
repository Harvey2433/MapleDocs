import { Tooltip } from '@gouvfr-lasuite/cunningham-react';
import { useSearchParams } from 'next/navigation';
import { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, StyledLink, Text } from '@/components';
import { useConfig } from '@/core';
import { useCunninghamTheme } from '@/cunningham';
import { Doc, LinkReach, SimpleDocItem, useTrans } from '@/docs/doc-management';
import { useLeftPanelStore } from '@/features/left-panel';
import { useDate } from '@/hooks';
import { useResponsiveStore } from '@/stores';

import { DocsGridActions } from './DocsGridActions';
import { DocsGridItemSharedButton } from './DocsGridItemSharedButton';
import { DocsGridTrashbinActions } from './DocsGridTrashbinActions';

type DocsGridItemProps = {
  doc: Doc;
  dragMode?: boolean;
};

export const DocsGridItem = ({ doc, dragMode = false }: DocsGridItemProps) => {
  const searchParams = useSearchParams();
  const target = searchParams.get('target');
  const isInTrashbin = target === 'trashbin';
  const { untitledDocument } = useTrans();

  const { t } = useTranslation();
  const { isDesktop, isLargeScreen } = useResponsiveStore();
  const dateToDisplay = useDateToDisplay(doc, isInTrashbin);
  const { openPanel } = useLeftPanelStore();

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      (e.target as HTMLAnchorElement).click();
    }
  };

  /**
   * When coming from the index page, we want the left panel to be open by default
   */
  const handleClick = () => {
    if (isLargeScreen) {
      openPanel();
    }
  };

  return (
    <Box
      role="listitem"
      className="--docs--doc-grid-item"
      data-dragging={dragMode}
      aria-label={t('Open document: {{title}}', {
        title: doc.title || untitledDocument,
      })}
    >
      <StyledLink
        className="maple-doc-name"
        href={`/docs/${doc.id}`}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
      >
        <DocsGridItemTitle doc={doc} withTooltip={!dragMode} />
      </StyledLink>
      <div className="maple-doc-collaborators">
        {isDesktop && (
          <DocsGridItemSharedButton doc={doc} disabled={isInTrashbin} />
        )}
      </div>
      <StyledLink
        className="maple-doc-date"
        href={`/docs/${doc.id}`}
        tabIndex={-1}
        aria-label={t('{{title}}, updated {{date}}', {
          title: doc.title || untitledDocument,
          date: dateToDisplay,
        })}
      >
        <DocsGridItemDate
          doc={doc}
          isDesktop={isDesktop}
          isInTrashbin={isInTrashbin}
        />
      </StyledLink>
      <div className="maple-doc-actions">
        {isInTrashbin ? (
          <DocsGridTrashbinActions doc={doc} />
        ) : (
          <DocsGridActions doc={doc} />
        )}
      </div>
    </Box>
  );
};

export const DocsGridItemTitle = ({
  doc,
  withTooltip,
}: {
  doc: Doc;
  withTooltip: boolean;
}) => {
  const { t } = useTranslation();
  const { isDesktop } = useResponsiveStore();
  const { spacingsTokens } = useCunninghamTheme();
  const isPublic = doc.link_reach === LinkReach.PUBLIC;
  const isAuthenticated = doc.link_reach === LinkReach.AUTHENTICATED;
  const isShared = isPublic || isAuthenticated;

  return (
    <Box
      data-testid={`docs-grid-name-${doc.id}`}
      $direction="row"
      $align="center"
      $gap={spacingsTokens.xs}
      $padding={{ right: isDesktop ? 'md' : '3xs' }}
      $maxWidth="100%"
    >
      <SimpleDocItem isPinned={doc.is_favorite} doc={doc} />
      {isShared && (
        <Box
          $padding={{ top: !isDesktop ? '4xs' : undefined }}
          $css={
            !isDesktop
              ? css`
                  align-self: flex-start;
                `
              : undefined
          }
        >
          {withTooltip ? (
            <Tooltip
              content={
                <Text $textAlign="center">
                  {isPublic
                    ? t('Accessible to anyone')
                    : t('Accessible to authenticated users')}
                </Text>
              }
              placement="top"
            >
              <Box>
                <IconPublic isPublic={isPublic} />
              </Box>
            </Tooltip>
          ) : (
            <IconPublic isPublic={isPublic} />
          )}
        </Box>
      )}
    </Box>
  );
};

const IconPublic = ({ isPublic }: { isPublic: boolean }) => {
  const { t } = useTranslation();

  return (
    <>
      <Icon
        $layer="background"
        $theme="neutral"
        $variation="primary"
        $size="sm"
        iconName={isPublic ? 'public' : 'vpn_lock'}
      />
      <span className="sr-only">
        {isPublic
          ? t('Accessible to anyone')
          : t('Accessible to authenticated users')}
      </span>
    </>
  );
};

const useDateToDisplay = (doc: Doc, isInTrashbin: boolean) => {
  const { data: config } = useConfig();
  const { t } = useTranslation();
  const { relativeDate, calculateDaysLeft } = useDate();

  let dateToDisplay = relativeDate(doc.updated_at);

  if (isInTrashbin && config?.TRASHBIN_CUTOFF_DAYS && doc.deleted_at) {
    const daysLeft = calculateDaysLeft(
      doc.deleted_at,
      config.TRASHBIN_CUTOFF_DAYS,
    );

    dateToDisplay = `${daysLeft} ${t('days', { count: daysLeft })}`;
  }

  return dateToDisplay;
};

export const DocsGridItemDate = ({
  doc,
  isDesktop,
  isInTrashbin,
}: {
  doc: Doc;
  isDesktop: boolean;
  isInTrashbin: boolean;
}) => {
  const dateToDisplay = useDateToDisplay(doc, isInTrashbin);

  if (!isDesktop) {
    return null;
  }

  return (
    <Text
      $size="xs"
      $layer="background"
      $theme="neutral"
      $variation="primary"
      $shrink="0"
    >
      {dateToDisplay}
    </Text>
  );
};
