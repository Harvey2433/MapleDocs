import {
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { APIError, errorCauses, fetchAPI } from '@/api';
import UploadSVG from '@/assets/icons/maple/upload.svg';
import { MapleDialog } from '@/components';

import { KEY_AUTH, User } from '../api';

const initials = (value: string) => {
  const parts = value.trim().split(/\s+/);
  const result =
    parts.length === 1
      ? Array.from(parts[0]).slice(0, 2).join('')
      : parts.map((part) => part[0]).join('');
  return result.slice(0, 2).toUpperCase();
};

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
  const [preview, setPreview] = useState(user.avatar_url || '');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!avatar) {
      return;
    }
    const url = URL.createObjectURL(avatar);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

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
    <MapleDialog
      className="maple-profile-dialog"
      onClose={onClose}
      title={t('Profile')}
    >
      <form
        className="maple-profile-form"
        onSubmit={(event) => void submit(event)}
      >
        <div className="maple-profile-preview">
          <span className="maple-profile-avatar-large">
            {preview ? (
              <img src={preview} alt="" />
            ) : (
              initials(name || user.email)
            )}
          </span>
          <label className="maple-secondary-button">
            <UploadSVG width={18} height={18} aria-hidden="true" />
            {t('Change avatar')}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(event) => setAvatar(event.target.files?.[0])}
            />
          </label>
        </div>
        <label>
          <span>{t('Display name')}</span>
          <input
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          <span>{t('Account')}</span>
          <input value={user.email} disabled />
        </label>
        <div className="maple-profile-actions">
          <button
            className="maple-secondary-button"
            type="button"
            onClick={onClose}
          >
            {t('Cancel')}
          </button>
          <button
            className="maple-primary-button"
            type="submit"
            disabled={pending || !name.trim()}
          >
            {pending ? t('Saving...') : t('Save profile')}
          </button>
        </div>
      </form>
    </MapleDialog>
  );
};
