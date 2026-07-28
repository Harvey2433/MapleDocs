import {
  Button,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Box, Text } from '@/components';
import { gotoLogout } from '@/features/auth/utils';

import { KEY_AUTH, User } from '../api';

export const ProfileSettings = ({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.full_name);
  const [avatar, setAvatar] = useState<File>();
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      const form = new FormData();
      form.append('full_name', name.trim());
      form.append('short_name', name.trim());
      if (avatar) {
        form.append('avatar', avatar);
      }
      const response = await fetchAPI(`users/${user.id}/`, {
        method: 'PATCH',
        body: form,
        withoutContentType: true,
      });
      if (!response.ok) {
        throw new APIError(
          'Failed to update profile',
          await errorCauses(response),
        );
      }
      queryClient.setQueryData([KEY_AUTH], (await response.json()) as User);
      toast(t('Profile updated'), VariantType.SUCCESS);
      onClose();
    } catch {
      toast(t('Unable to update profile'), VariantType.ERROR);
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size={ModalSize.MEDIUM}
      title={t('Edit profile')}
    >
      <form onSubmit={(event) => void submit(event)}>
        <Box $gap="md">
          <label>
            <Text as="span" $size="s">
              {t('Display name')}
            </Text>
            <input
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            <Text as="span" $size="s">
              {t('Avatar')}
            </Text>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(event) => setAvatar(event.target.files?.[0])}
            />
          </label>
          <Text $size="s" $variation="secondary">
            {user.email}
          </Text>
          <Box $direction="row" $justify="space-between" $gap="sm">
            <Button type="button" variant="tertiary" onClick={gotoLogout}>
              {t('Log out')}
            </Button>
            <Box $direction="row" $gap="sm">
              <Button type="button" variant="secondary" onClick={onClose}>
                {t('Cancel')}
              </Button>
              <Button type="submit" disabled={pending || !name.trim()}>
                {pending ? t('Saving...') : t('Save')}
              </Button>
            </Box>
          </Box>
        </Box>
      </form>
    </Modal>
  );
};
