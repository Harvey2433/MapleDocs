import { Button, useModal } from '@gouvfr-lasuite/cunningham-react';
import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';

import SharedSVG from '@/assets/icons/maple/share-2.svg';
import { CardFloatingBar } from '@/components/FloatingBar';
import { Doc } from '@/docs/doc-management/types';
import { useAuth } from '@/features/auth';
import { useFocusStore } from '@/stores/useFocusStore';

const DocShareModal = dynamic(
  () =>
    import('./DocShareModal').then((mod) => ({
      default: mod.DocShareModal,
    })),
  { ssr: false },
);

interface DocShareButtonProps {
  doc: Doc;
  isDisabled?: boolean;
  isHidden?: boolean;
}

export const DocShareButton = ({
  doc,
  isDisabled,
  isHidden,
}: DocShareButtonProps) => {
  const { t } = useTranslation();
  const { addLastFocus, restoreFocus } = useFocusStore();
  const treeContext = useTreeContext<Doc>();
  const modalShare = useModal();
  const { authenticated } = useAuth();

  if (isHidden || !authenticated) {
    return null;
  }

  return (
    <>
      <CardFloatingBar className="--docs--card--share">
        <Button
          color="neutral"
          size="small"
          variant="secondary"
          onClick={(e) => {
            addLastFocus(e.currentTarget);
            modalShare.open();
          }}
          disabled={isDisabled}
          icon={<SharedSVG width={17} height={17} aria-hidden="true" />}
          aria-label={t('Share')}
          data-test="share-button"
        >
          {t('Share')}
        </Button>
      </CardFloatingBar>
      {modalShare.isOpen && (
        <DocShareModal
          onClose={() => {
            modalShare.close();
            restoreFocus();
          }}
          doc={doc}
          isRootDoc={treeContext?.root?.id === doc.id}
        />
      )}
    </>
  );
};
