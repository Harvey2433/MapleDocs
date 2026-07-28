import { Tooltip, useModal } from '@gouvfr-lasuite/cunningham-react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components';
import { Doc } from '@/docs/doc-management';
import { useAuth } from '@/features/auth';
import { useFocusStore } from '@/stores';

const DocShareModal = dynamic(
  () =>
    import('@/docs/doc-share/components/DocShareModal').then((mod) => ({
      default: mod.DocShareModal,
    })),
  { ssr: false },
);

type Props = {
  doc: Doc;
  disabled: boolean;
};
export const DocsGridItemSharedButton = ({ doc, disabled }: Props) => {
  const { t } = useTranslation();
  const sharedCount = doc.nb_accesses_direct;
  const shareModal = useModal();
  const { addLastFocus, restoreFocus } = useFocusStore();
  const { user } = useAuth();
  const userInitials = (user?.full_name || user?.email || 'M')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <Tooltip
        content={
          <Text $textAlign="center">
            {t('Shared with {{count}} users', { count: sharedCount })}
          </Text>
        }
        placement="top"
        className="--docs--doc-tooltip-grid-item-shared-button"
      >
        <button
          type="button"
          className="--docs--doc-grid-item-shared-button"
          aria-label={t('Open the sharing settings for the document')}
          data-testid={`docs-grid-item-shared-button-${doc.id}`}
          style={{
            padding: `0 var(--c--globals--spacings--xxxs) 0 var(--c--globals--spacings--xxxs)`,
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            addLastFocus(event.currentTarget);
            shareModal.open();
          }}
          disabled={disabled}
        >
          <span className="maple-mini-avatar">{userInitials}</span>
          {sharedCount > 1 && (
            <span className="maple-mini-avatar maple-mini-avatar-alt">
              +{sharedCount - 1}
            </span>
          )}
        </button>
      </Tooltip>
      {shareModal.isOpen && (
        <DocShareModal
          doc={doc}
          onClose={() => {
            shareModal.close();
            restoreFocus();
          }}
        />
      )}
    </>
  );
};
