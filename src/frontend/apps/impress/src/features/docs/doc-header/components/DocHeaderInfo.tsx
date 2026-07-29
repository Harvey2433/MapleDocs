import { t } from 'i18next';
import { useEffect, useState } from 'react';

import PublicSVG from '@/assets/icons/ui-kit/public.svg';
import ProtedtedSVG from '@/assets/icons/ui-kit/vpn_lock.svg';
import { Box, Text } from '@/components';
import { useConfig } from '@/core';
import {
  Doc,
  LinkReach,
  Role,
  getDocLinkReach,
  useIsCollaborativeEditable,
  useProviderStore,
  useTrans,
} from '@/docs/doc-management';
import { useDate } from '@/hooks';

interface DocHeaderInfoProps {
  doc: Doc;
}

export const DocHeaderInfo = ({ doc }: DocHeaderInfoProps) => {
  const { transRole } = useTrans();
  const { isEditable } = useIsCollaborativeEditable(doc);
  const { relativeDate, calculateDaysLeft } = useDate();
  const { data: config } = useConfig();
  const { provider } = useProviderStore();
  const [onlineCount, setOnlineCount] = useState(1);

  const relativeOnly = relativeDate(doc.updated_at);

  const trashbinCutoff = config?.TRASHBIN_CUTOFF_DAYS;

  useEffect(() => {
    const awareness = provider?.awareness;
    let updateTimer: ReturnType<typeof setTimeout> | undefined;
    const updateOnlineCount = () => {
      clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        setOnlineCount(Math.max(awareness?.getStates().size || 1, 1));
      }, 0);
    };
    updateOnlineCount();
    awareness?.on('change', updateOnlineCount);
    return () => {
      clearTimeout(updateTimer);
      awareness?.off('change', updateOnlineCount);
    };
  }, [provider]);

  let dateLabel: string;
  let dateValue: string;

  if (trashbinCutoff && doc.deleted_at) {
    const daysLeft = calculateDaysLeft(doc.deleted_at, trashbinCutoff);
    dateLabel = t('Days remaining:');
    dateValue = `${daysLeft} ${t('days', { count: daysLeft })}`;
  } else {
    dateLabel = t('Last update:');
    dateValue = relativeOnly;
  }

  if (!doc.deleted_at) {
    return (
      <Box
        as="dl"
        className="maple-doc-header-info"
        $direction="row"
        $align="center"
        $gap="sm"
        $margin="0"
      >
        <Text as="dt" className="sr-only">
          {t('Collaborators')}
        </Text>
        <Text as="dd" $variation="tertiary" $size="s" $margin="0">
          {t('{{count}} people online', { count: onlineCount })}
        </Text>
        <Text as="dt" className="sr-only">
          {t('Updated at')}
        </Text>
        <Text as="dd" $variation="tertiary" $size="s" $margin="0">
          {t('{{time}} updated', { time: relativeOnly })}
        </Text>
      </Box>
    );
  }

  return (
    <Box as="dl" $direction="row" $align="center" $margin="0">
      <Text as="dt" className="sr-only">
        {t('Role')}
      </Text>
      <Text
        as="dd"
        $variation="tertiary"
        $size="s"
        $weight="bold"
        $theme={isEditable ? 'neutral' : 'warning'}
        $direction="row"
        $margin="0"
      >
        <VisibilityDoc doc={doc} />
        {transRole(isEditable ? doc.user_role || doc.link_role : Role.READER)}
        &nbsp;·&nbsp;
      </Text>
      <Text as="dt" $variation="tertiary" $size="s" $margin="0">
        {dateLabel}
        &nbsp;
      </Text>
      <Text as="dd" $variation="tertiary" $size="s" $margin="0">
        {dateValue}
      </Text>
    </Box>
  );
};

const VisibilityDoc = ({ doc }: { doc: Doc }) => {
  const docIsPublic = getDocLinkReach(doc) === LinkReach.PUBLIC;
  const docIsAuth = getDocLinkReach(doc) === LinkReach.AUTHENTICATED;

  if (docIsPublic) {
    return (
      <>
        <PublicSVG aria-hidden="true" width="16" height="16" />
        &nbsp;{t('Public')}&nbsp;·&nbsp;
      </>
    );
  }

  if (docIsAuth) {
    return (
      <>
        <ProtedtedSVG aria-hidden="true" width="16" height="16" />
        &nbsp;{t('Internal')}&nbsp;·&nbsp;
      </>
    );
  }
};
