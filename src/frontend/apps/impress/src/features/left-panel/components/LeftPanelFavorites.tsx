import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { Box, StyledLink } from '@/components';
import { DocDefaultFilter, useDocs, useTrans } from '@/docs/doc-management';
import { useDocsTrashbin } from '@/features/docs/docs-grid/api';
import { useLeftPanelStore } from '@/features/left-panel';
import { useResponsiveStore } from '@/stores';

export const LeftPanelFavorites = () => {
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();
  const { isMobile } = useResponsiveStore();
  const { closePanel } = useLeftPanelStore();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data } = useDocs({ page: 1, ordering: '-updated_at' });
  const trash = useDocsTrashbin({ page: 1 });
  const docs = data?.results.slice(0, 3) ?? [];

  const trashParams = new URLSearchParams(searchParams);
  trashParams.set('target', DocDefaultFilter.TRASHBIN);

  return (
    <Box as="section" className="maple-sidebar-recent">
      <p className="maple-sidebar-label">{t('Recent documents')}</p>
      {docs.map((doc) => (
        <StyledLink
          key={doc.id}
          href={`/docs/${doc.id}`}
          className="maple-sidebar-item"
          onClick={() => isMobile && closePanel()}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            description
          </span>
          <span>{doc.title || untitledDocument}</span>
        </StyledLink>
      ))}
      <StyledLink
        href={`${pathname}?${trashParams.toString()}`}
        className="maple-sidebar-item maple-trash-link"
        data-active={searchParams.get('target') === DocDefaultFilter.TRASHBIN}
        onClick={() => isMobile && closePanel()}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          delete
        </span>
        <span>{t('Trashbin')}</span>
        {typeof trash.data?.count === 'number' && (
          <small>{trash.data.count}</small>
        )}
      </StyledLink>
    </Box>
  );
};
