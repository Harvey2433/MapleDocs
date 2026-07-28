import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InView } from 'react-intersection-observer';

import { Box, Text } from '@/components';
import { useInfiniteDocs } from '@/docs/doc-management/api/useDocs';
import { useInfiniteDocsFavorite } from '@/docs/doc-management/api/useDocsFavorite';
import { useImport } from '@/docs/doc-management/hooks/useImport';
import { DocDefaultFilter } from '@/docs/doc-management/types';

import { useInfiniteDocsTrashbin } from '../api';

import { DocGridContentList } from './DocGridContentList';
import { DocsGridLoader } from './DocsGridLoader';

type DocsGridProps = {
  target?: DocDefaultFilter;
};

type SortMode = 'updated' | 'title';

export const DocsGrid = ({
  target = DocDefaultFilter.ALL_DOCS,
}: DocsGridProps) => {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('updated');
  const {
    getRootProps,
    isPending: isImportPending,
    isEnabled: isImportEnabled,
    conflictModal,
  } = useImport({ onDragOver: setIsDragOver });
  const withUpload =
    (target === DocDefaultFilter.ALL_DOCS ||
      target === DocDefaultFilter.MY_DOCS) &&
    isImportEnabled;
  const {
    data,
    isFetching,
    isRefetching,
    isLoading,
    fetchNextPage,
    hasNextPage,
  } = useDocsQuery(target);

  const docs = useMemo(() => {
    const seen = new Set<string>();
    const result = (data?.pages.flatMap((page) => page.results) ?? []).filter(
      (doc) => {
        if (seen.has(doc.id)) {
          return false;
        }
        seen.add(doc.id);
        return true;
      },
    );
    return result.sort((left, right) =>
      sortMode === 'title'
        ? (left.title || '').localeCompare(right.title || '')
        : Date.parse(right.updated_at) - Date.parse(left.updated_at),
    );
  }, [data?.pages, sortMode]);

  const loading = isFetching || isLoading;
  const summary = {
    [DocDefaultFilter.ALL_DOCS]: t(
      'View, organize and share team documents in one place.',
    ),
    [DocDefaultFilter.MY_DOCS]: t('Documents you created and manage.'),
    [DocDefaultFilter.SHARED_WITH_ME]: t('Documents shared with you.'),
    [DocDefaultFilter.FAVORITES]: t('Documents you pinned for quick access.'),
    [DocDefaultFilter.TRASHBIN]: t('Deleted documents awaiting removal.'),
  }[target];

  return (
    <>
      <Box
        className={`--docs--doc-grid${isDragOver ? ' is-drag-over' : ''}`}
        $position="relative"
        $width="100%"
        $minHeight="0"
        {...(withUpload ? getRootProps({ tabIndex: -1 }) : {})}
      >
        <DocsGridLoader
          isLoading={isRefetching || loading || isImportPending}
        />
        <div className="maple-list-wrap" data-testid="docs-grid">
          <div className="maple-list-summary">
            <p>{summary}</p>
            <select
              value={sortMode}
              aria-label={t('Sort documents')}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
            >
              <option value="updated">{t('Recently updated')}</option>
              <option value="title">{t('Name')}</option>
            </select>
          </div>
          <div className="maple-doc-table" aria-label={t('Documents grid')}>
            <div className="maple-doc-table-head" aria-hidden="true">
              <span>{t('Name')}</span>
              <span>{t('Collaborators')}</span>
              <span>
                {target === DocDefaultFilter.TRASHBIN
                  ? t('Days remaining')
                  : t('Updated at')}
              </span>
              <span />
            </div>
            {!docs.length && !loading ? (
              <div className="maple-doc-empty">
                <Text $size="sm">{t('No documents found')}</Text>
              </div>
            ) : (
              <div role="list">
                <DocGridContentList docs={docs} />
              </div>
            )}
            {hasNextPage && !loading && (
              <InView
                as="div"
                onChange={(visible) => visible && void fetchNextPage()}
              >
                <Button
                  className="maple-load-more"
                  onClick={() => void fetchNextPage()}
                  color="brand"
                  variant="tertiary"
                >
                  {t('More docs')}
                </Button>
              </InView>
            )}
          </div>
        </div>
      </Box>
      {conflictModal}
    </>
  );
};

const useDocsQuery = (target: DocDefaultFilter) => {
  const trashbinQuery = useInfiniteDocsTrashbin(
    { page: 1 },
    { enabled: target === DocDefaultFilter.TRASHBIN },
  );
  const favoritesQuery = useInfiniteDocsFavorite(
    { page: 1 },
    { enabled: target === DocDefaultFilter.FAVORITES },
  );
  const docsQuery = useInfiniteDocs(
    {
      page: 1,
      ...(target !== DocDefaultFilter.ALL_DOCS && {
        is_creator_me: target === DocDefaultFilter.MY_DOCS,
      }),
    },
    {
      enabled:
        target !== DocDefaultFilter.TRASHBIN &&
        target !== DocDefaultFilter.FAVORITES,
    },
  );

  if (target === DocDefaultFilter.TRASHBIN) {
    return trashbinQuery;
  }
  if (target === DocDefaultFilter.FAVORITES) {
    return favoritesQuery;
  }
  return docsQuery;
};
