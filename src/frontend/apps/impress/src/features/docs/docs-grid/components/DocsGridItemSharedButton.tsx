import { Tooltip, useModal } from '@gouvfr-lasuite/cunningham-react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components';
import { Doc } from '@/docs/doc-management';
import { KEY_LIST_DOC_ACCESSES, useDocAccesses } from '@/docs/doc-share/api';
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
  const { data: accesses } = useDocAccesses(
    { docId: doc.id },
    {
      enabled: doc.abilities.accesses_view && sharedCount > 0,
      queryKey: [KEY_LIST_DOC_ACCESSES, { docId: doc.id }],
      staleTime: 60_000,
    },
  );
  const members = Array.isArray(accesses)
    ? accesses.map((access) => access.user)
    : sharedCount > 0 && user
      ? [user]
      : [];
  const visibleMembers = members.slice(
    0,
    Math.min(sharedCount, members.length > 3 ? 2 : 3),
  );
  const hiddenCount = Math.max(sharedCount - visibleMembers.length, 0);
  const initials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return (
      parts.length === 1
        ? Array.from(parts[0]).slice(0, 2).join('')
        : parts.map((part) => part[0]).join('')
    )
      .slice(0, 2)
      .toUpperCase();
  };

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
          {visibleMembers.map((member, index) => {
            const name = member.full_name || member.email || 'M';
            return (
              <span
                key={member.id}
                className={`maple-mini-avatar maple-presence-${(index % 3) + 1}`}
                title={name}
                style={
                  member.avatar_url
                    ? { backgroundImage: `url(${member.avatar_url})` }
                    : undefined
                }
              >
                {member.avatar_url ? '' : initials(name)}
              </span>
            );
          })}
          {hiddenCount > 0 && (
            <span className="maple-mini-avatar maple-mini-avatar-alt">
              +{hiddenCount}
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
