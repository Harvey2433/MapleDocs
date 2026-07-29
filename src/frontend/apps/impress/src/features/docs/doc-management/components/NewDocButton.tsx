import { Button, Loader } from '@gouvfr-lasuite/cunningham-react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

import UploadIcon from '@/assets/icons/maple/file-up.svg';
import PlusIcon from '@/assets/icons/maple/plus.svg';
import { Box, Text } from '@/components';

import { useImport } from '../hooks/useImport';

interface NewDocButtonProps {
  onClose?: () => void;
}

export const NewDocButton = ({ onClose }: NewDocButtonProps) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { getInputProps, open, isPending, isEnabled, conflictModal } =
    useImport({
      onImportSuccess: (doc) => {
        onClose?.();
        void router.push(`/docs/${doc.id}/`);
      },
    });

  return (
    <>
      <Box className="maple-create-actions" $direction="row" $gap="2xs">
        <Button
          href="/docs/new"
          data-testid="new-doc-button"
          color="brand"
          size="small"
          onClick={(event) => {
            if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
              event.preventDefault();
              void router.push('/docs/new');
            }
            onClose?.();
          }}
          icon={<PlusIcon aria-hidden="true" width={20} height={20} />}
        >
          <Text $withThemeInherited $size="s" $weight="500">
            {t('New')}
          </Text>
        </Button>
        {isEnabled && (
          <Button
            data-testid="import-doc-button"
            color="brand"
            variant="secondary"
            size="small"
            disabled={isPending}
            onClick={open}
            icon={
              isPending ? (
                <Loader size="small" />
              ) : (
                <UploadIcon aria-hidden="true" width={20} height={20} />
              )
            }
          >
            <Text $size="s" $weight="500">
              {t('Import')}
            </Text>
          </Button>
        )}
      </Box>
      <input {...getInputProps()} />
      {conflictModal}
    </>
  );
};
