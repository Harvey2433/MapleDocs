import { Button, Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';

import { ImportConflict, ImportConflictStrategy } from '../api/useImportDoc';

export const ImportConflictModal = ({
  conflict,
  fileName,
  onResolve,
}: {
  conflict: ImportConflict;
  fileName: string;
  onResolve: (strategy: Exclude<ImportConflictStrategy, 'ask'>) => void;
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      isOpen
      hideCloseButton
      closeOnClickOutside={false}
      onClose={() => onResolve('skip')}
      size={ModalSize.MEDIUM}
      aria-label={t('Resolve import conflict')}
      title={t('A document already exists')}
      rightActions={
        <>
          <Button variant="secondary" onClick={() => onResolve('skip')}>
            {t('Skip')}
          </Button>
          <Button variant="secondary" onClick={() => onResolve('keep_both')}>
            {t('Keep both')}
          </Button>
          <Button color="error" onClick={() => onResolve('replace')}>
            {t('Replace')}
          </Button>
        </>
      }
    >
      <Box $gap="sm">
        <Text as="p" $margin="0">
          {conflict.code === 'exact_duplicate'
            ? t('"{{name}}" has already been imported.', { name: fileName })
            : t('A document named "{{name}}" already exists.', {
                name: conflict.existing_document.title || fileName,
              })}
        </Text>
        <Text as="p" $variation="secondary" $margin="0">
          {t(
            'Skip this file, keep a separate copy, or replace the existing document and its latest saved content.',
          )}
        </Text>
      </Box>
    </Modal>
  );
};
