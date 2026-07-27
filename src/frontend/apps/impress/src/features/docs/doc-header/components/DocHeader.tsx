import { useTranslation } from 'react-i18next';

import { Box, HorizontalSeparator } from '@/components';
import { Doc, useIsCollaborativeEditable } from '@/docs/doc-management';

import { AlertNetwork } from './AlertNetwork';
import { AlertRestore } from './AlertRestore';
import { DocHeaderInfo } from './DocHeaderInfo';
import { DocTitle } from './DocTitle';

interface DocHeaderProps {
  doc: Doc;
}

export const DocHeader = ({ doc }: DocHeaderProps) => {
  const { t } = useTranslation();
  const { isEditable } = useIsCollaborativeEditable(doc);
  const isDeletedDoc = !!doc.deleted_at;

  return (
    <>
      <Box
        $width="100%"
        aria-label={t('It is the card information about the document.')}
        className="--docs--doc-header"
        $minHeight="125px"
      >
        <Box
          $gap="base"
          $padding={{
            bottom: isDeletedDoc || !isEditable ? 'base' : undefined,
          }}
        >
          {isDeletedDoc && <AlertRestore doc={doc} />}
          {!isEditable && <AlertNetwork />}
        </Box>
        <Box $gap="sm">
          <DocTitle doc={doc} />
          <DocHeaderInfo doc={doc} />
        </Box>
        <HorizontalSeparator $margin={{ top: '24px' }} />
      </Box>
    </>
  );
};
