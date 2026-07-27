import { Button, Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

import PlusSVG from '@/assets/icons/ui-kit/add.svg';
import PaletteSVG from '@/assets/icons/ui-kit/palette.svg';
import UploadSVG from '@/assets/icons/ui-kit/upload_file.svg';
import { Box, Text } from '@/components';
import { useImport } from '@/docs/doc-management/hooks/useImport';
import { useAppearance } from '@/features/appearance';

import { useOnboardingDone } from '../api/useOnboardingDone';

export const FirstConnection = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { openSettings } = useAppearance();
  const { mutate: onboardingDone, isPending } = useOnboardingDone();
  const finish = (action: () => void) =>
    onboardingDone(undefined, { onSuccess: action });
  const {
    getInputProps,
    open,
    isPending: importing,
    conflictModal,
  } = useImport({
    onImportSuccess: (doc) =>
      finish(() => void router.push(`/docs/${doc.id}/`)),
  });

  return (
    <>
      <Modal
        isOpen
        hideCloseButton
        closeOnClickOutside={false}
        onClose={() => undefined}
        size={ModalSize.MEDIUM}
        title={t('Welcome to MapleDocs')}
        aria-label={t('First use')}
      >
        <Box $gap="md" className="maple-first-use">
          <Text $size="s" $variation="secondary">
            {t('Choose where to start')}
          </Text>
          <Button
            fullWidth
            icon={<PlusSVG width={22} height={22} aria-hidden="true" />}
            disabled={isPending}
            onClick={() => finish(() => void router.push('/docs/new'))}
          >
            {t('New document')}
          </Button>
          <Button
            fullWidth
            variant="secondary"
            icon={<UploadSVG width={22} height={22} aria-hidden="true" />}
            disabled={isPending || importing}
            onClick={open}
          >
            {t('Import DOC, DOCX or Markdown')}
          </Button>
          <Button
            fullWidth
            variant="tertiary"
            icon={<PaletteSVG width={22} height={22} aria-hidden="true" />}
            disabled={isPending}
            onClick={() => finish(openSettings)}
          >
            {t('Personalize interface')}
          </Button>
          <input {...getInputProps()} />
        </Box>
      </Modal>
      {conflictModal}
    </>
  );
};
