import { Button } from '@gouvfr-lasuite/cunningham-react';
import { DropdownMenu, DropdownMenuItem } from '@gouvfr-lasuite/ui-kit';
import dynamic from 'next/dynamic';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { baseApiUrl } from '@/api';
import MoreSVG from '@/assets/icons/maple/ellipsis.svg';
import { MapleDialog } from '@/components';
import {
  Doc,
  KEY_LIST_DOC,
  useTrans,
  useUpdateDoc,
} from '@/docs/doc-management';
import { useFocusStore } from '@/stores';

const DocShareModal = dynamic(
  () =>
    import('@/docs/doc-share/components/DocShareModal').then((mod) => ({
      default: mod.DocShareModal,
    })),
  { ssr: false },
);

const ModalRemoveDoc = dynamic(
  () =>
    import('@/docs/doc-management/components/ModalRemoveDoc').then((mod) => ({
      default: mod.ModalRemoveDoc,
    })),
  { ssr: false },
);

interface DocsGridActionsProps {
  doc: Doc;
}

export const DocsGridActions = ({ doc }: DocsGridActionsProps) => {
  const { t } = useTranslation();
  const { restoreFocus, addLastFocus } = useFocusStore();
  const [openDropdown, setOpenDropdown] = useState(false);
  const [isModalRemoveOpen, setIsModalRemoveOpen] = useState(false);
  const [isModalShareOpen, setIsModalShareOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(doc.title || '');
  const { untitledDocument } = useTrans();
  const { mutate: updateDoc, isPending: isRenamePending } = useUpdateDoc({
    listInvalidQueries: [KEY_LIST_DOC],
    onSuccess: () => setIsRenameOpen(false),
  });
  const downloadSource = () => {
    const anchor = document.createElement('a');
    anchor.href = `${baseApiUrl()}documents/${doc.id}/download/`;
    anchor.download =
      doc.source_name ||
      `${doc.title || 'document'}.${doc.file_type === 'markdown' ? 'md' : doc.file_type}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };
  const submitRename = (event: FormEvent) => {
    event.preventDefault();
    const title = renameValue.trim().replace(/(\r\n|\n|\r)/gm, '');
    if (title !== (doc.title || '')) {
      updateDoc({ id: doc.id, title });
    } else {
      setIsRenameOpen(false);
    }
  };

  const options: DropdownMenuItem[] = [
    {
      label: t('Rename'),
      callback: () => {
        setRenameValue(doc.title || '');
        setIsRenameOpen(true);
      },
      isHidden: !doc.abilities.partial_update,
      testId: `docs-grid-actions-rename-${doc.id}`,
    },
    {
      label: t('Share'),
      callback: () => {
        setIsModalShareOpen(true);
      },
      testId: `docs-grid-actions-share-${doc.id}`,
    },
    {
      label: t('Download source file'),
      callback: downloadSource,
      isHidden: !doc.abilities.download,
      testId: `docs-grid-actions-download-${doc.id}`,
    },
    {
      label: t('Move to trash'),
      callback: () => {
        setIsModalRemoveOpen(true);
      },
      isHidden: !doc.abilities.destroy,
      testId: `docs-grid-actions-remove-${doc.id}`,
    },
  ];

  return (
    <>
      <DropdownMenu
        options={options}
        isOpen={openDropdown}
        shouldCloseOnInteractOutside={() => true}
        onOpenChange={setOpenDropdown}
      >
        <Button
          data-testid={`docs-grid-actions-button-${doc.id}`}
          aria-label={t(
            'Open the menu of actions for the document: {{title}}',
            {
              title: doc.title || untitledDocument,
            },
          )}
          size="small"
          icon={<MoreSVG width={19} height={19} aria-hidden="true" />}
          color="neutral"
          variant="tertiary"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpenDropdown((o) => !o);
            addLastFocus(e.currentTarget);
          }}
        />
      </DropdownMenu>

      {isModalRemoveOpen && (
        <ModalRemoveDoc
          onClose={() => {
            setIsModalRemoveOpen(false);
            restoreFocus();
          }}
          doc={doc}
        />
      )}
      {isModalShareOpen && (
        <DocShareModal
          doc={doc}
          onClose={() => {
            setIsModalShareOpen(false);
            restoreFocus();
          }}
        />
      )}
      {isRenameOpen && (
        <MapleDialog
          className="maple-rename-dialog"
          title={t('Rename')}
          onClose={() => {
            setIsRenameOpen(false);
            restoreFocus();
          }}
        >
          <form className="maple-rename-form" onSubmit={submitRename}>
            <label>
              <span>{t('Name')}</span>
              <input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
              />
            </label>
            <div>
              <button type="button" onClick={() => setIsRenameOpen(false)}>
                {t('Cancel')}
              </button>
              <button type="submit" disabled={isRenamePending}>
                {t('Rename')}
              </button>
            </div>
          </form>
        </MapleDialog>
      )}
    </>
  );
};
