import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import FilesIcon from '@/assets/icons/maple/files.svg';
import LockIcon from '@/assets/icons/maple/lock-keyhole.svg';
import PinIcon from '@/assets/icons/maple/pin.svg';
import UsersIcon from '@/assets/icons/maple/users.svg';
import { Box, StyledLink } from '@/components';
import {
  DocDefaultFilter,
  useDocs,
  useDocsFavorite,
} from '@/docs/doc-management';
import { useLeftPanelStore } from '@/features/left-panel';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

export const LeftPanelTargetFilters = () => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobile } = useResponsiveStore();
  const { closePanel } = useLeftPanelStore();
  const all = useDocs({ page: 1 });
  const mine = useDocs({ page: 1, is_creator_me: true });
  const shared = useDocs({ page: 1, is_creator_me: false });
  const favorites = useDocsFavorite({ page: 1 });

  const target =
    (searchParams.get('target') as DocDefaultFilter) ??
    DocDefaultFilter.ALL_DOCS;
  const queries = [
    {
      icon: <FilesIcon aria-hidden="true" width={20} height={20} />,
      label: t('All docs'),
      target: DocDefaultFilter.ALL_DOCS,
      count: all.data?.count,
    },
    {
      icon: <LockIcon aria-hidden="true" width={20} height={20} />,
      label: t('My docs'),
      target: DocDefaultFilter.MY_DOCS,
      count: mine.data?.count,
    },
    {
      icon: <UsersIcon aria-hidden="true" width={20} height={20} />,
      label: t('Shared with me'),
      target: DocDefaultFilter.SHARED_WITH_ME,
      count: shared.data?.count,
    },
    {
      icon: <PinIcon aria-hidden="true" width={20} height={20} />,
      label: t('Pinned documents'),
      target: DocDefaultFilter.FAVORITES,
      count: favorites.data?.count,
    },
  ];

  const hrefFor = (nextTarget: DocDefaultFilter) => {
    const params = new URLSearchParams(searchParams);
    params.set('target', nextTarget);
    return `${pathname}?${params.toString()}`;
  };
  const onNavigate = () => isMobile && closePanel();

  return (
    <Box className="maple-sidebar-nav">
      <p className="maple-sidebar-label">{t('Workspace')}</p>
      {queries.map((query) => (
        <StyledLink
          key={query.target}
          href={hrefFor(query.target)}
          className="maple-sidebar-item"
          data-active={target === query.target}
          aria-current={target === query.target ? 'page' : undefined}
          onClick={onNavigate}
        >
          {query.icon}
          <span>{query.label}</span>
          {typeof query.count === 'number' && <small>{query.count}</small>}
        </StyledLink>
      ))}
    </Box>
  );
};
