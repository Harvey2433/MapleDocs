import { Button, Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import { ChangeEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import { UserAppearance } from '@/features/auth';

import { useAppearance } from './AppearanceProvider';

const accents = [
  '#1F6F54',
  '#1666C5',
  '#9B3A52',
  '#7A4BB3',
  '#B45309',
  '#374151',
];
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (values: number[]) =>
  `#${values.map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

const isValidBackgroundUrl = (value: string) => {
  if (!value) {
    return true;
  }
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

export const AppearanceSettings = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const { appearance, setAppearance, uploadBackground } = useAppearance();
  const [accentDraft, setAccentDraft] = useState(appearance.accent);
  useEffect(() => setAccentDraft(appearance.accent), [appearance.accent]);
  const [urlDraft, setUrlDraft] = useState(appearance.background_url);
  useEffect(
    () => setUrlDraft(appearance.background_url),
    [appearance.background_url],
  );
  const patch = (value: Partial<UserAppearance>) =>
    setAppearance({ ...appearance, ...value });
  const channels = rgb(appearance.accent);
  const setChannel = (index: number, value: string) => {
    const next = [...channels];
    next[index] = Number(value);
    patch({ accent: hex(next) });
  };
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void uploadBackground(file);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size={ModalSize.LARGE}
      title={t('Personalize MapleDocs')}
    >
      <Box className="maple-settings" $gap="lg">
        <fieldset>
          <legend>{t('Mode')}</legend>
          <div className="maple-segments">
            {(['system', 'light', 'dark'] as const).map((mode) => (
              <button
                key={mode}
                data-active={appearance.theme_mode === mode}
                onClick={() => patch({ theme_mode: mode })}
              >
                {t(
                  mode === 'system'
                    ? 'System'
                    : mode === 'light'
                      ? 'Light'
                      : 'Dark',
                )}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('Accent color')}</legend>
          <div className="maple-swatches">
            {accents.map((accent) => (
              <button
                key={accent}
                aria-label={accent}
                data-active={appearance.accent.toUpperCase() === accent}
                style={{ background: accent }}
                onClick={() => patch({ accent })}
              />
            ))}
            <input
              aria-label={t('Color picker')}
              type="color"
              value={appearance.accent}
              onChange={(event) =>
                patch({ accent: event.target.value.toUpperCase() })
              }
            />
          </div>
          <div className="maple-color-inputs">
            <label>
              HEX
              <input
                value={accentDraft}
                pattern="#[0-9A-Fa-f]{6}"
                onChange={(event) => {
                  const value = event.target.value;
                  setAccentDraft(value);
                  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                    patch({ accent: value.toUpperCase() });
                  }
                }}
              />
            </label>
            {['R', 'G', 'B'].map((label, index) => (
              <label key={label}>
                {label}
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={channels[index]}
                  onChange={(event) => setChannel(index, event.target.value)}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('Surface')}</legend>
          <label>
            {t('Transparency')}
            <output>{appearance.surface_opacity}%</output>
            <input
              type="range"
              min="0"
              max="100"
              value={appearance.surface_opacity}
              onChange={(event) =>
                patch({ surface_opacity: Number(event.target.value) })
              }
            />
          </label>
          <div className="maple-segments">
            {(['mica', 'gaussian', 'acrylic'] as const).map((material) => (
              <button
                key={material}
                data-active={appearance.material === material}
                onClick={() => patch({ material })}
              >
                {t(
                  material === 'mica'
                    ? 'Mica'
                    : material === 'gaussian'
                      ? 'Gaussian'
                      : 'Acrylic',
                )}
              </button>
            ))}
          </div>
          <label>
            {t('Blur strength')}
            <output>{appearance.material_strength}%</output>
            <input
              type="range"
              min="0"
              max="100"
              value={appearance.material_strength}
              onChange={(event) =>
                patch({ material_strength: Number(event.target.value) })
              }
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>{t('Background image')}</legend>
          <div className="maple-segments">
            {(['none', 'upload', 'url'] as const).map((source) => (
              <button
                key={source}
                data-active={appearance.background_source === source}
                onClick={() => patch({ background_source: source })}
              >
                {t(
                  source === 'none'
                    ? 'None'
                    : source === 'upload'
                      ? 'Upload'
                      : 'URL',
                )}
              </button>
            ))}
          </div>
          {appearance.background_source === 'upload' && (
            <label className="maple-file">
              {t('Choose JPG, PNG or WebP')}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={upload}
              />
            </label>
          )}
          {appearance.background_source === 'url' && (
            <label>
              {t('Image URL')}
              <input
                type="url"
                value={urlDraft}
                aria-invalid={!isValidBackgroundUrl(urlDraft)}
                placeholder="https://example.com/background.webp"
                onChange={(event) => {
                  const value = event.target.value;
                  setUrlDraft(value);
                  if (isValidBackgroundUrl(value)) {
                    patch({ background_url: value });
                  }
                }}
                onBlur={() => setUrlDraft(appearance.background_url)}
              />
              {!isValidBackgroundUrl(urlDraft) && (
                <Text $size="s" $variation="secondary">
                  {t('Enter a full http(s) address.')}
                </Text>
              )}
            </label>
          )}
          {appearance.background_source === 'url' && (
            <label>
              {t('Refresh interval')}
              <select
                value={appearance.background_refresh_minutes}
                onChange={(event) =>
                  patch({
                    background_refresh_minutes: Number(
                      event.target.value,
                    ) as UserAppearance['background_refresh_minutes'],
                  })
                }
              >
                <option value="0">{t('Never')}</option>
                <option value="15">15 min</option>
                <option value="60">1 h</option>
                <option value="360">6 h</option>
                <option value="1440">24 h</option>
              </select>
            </label>
          )}
        </fieldset>
        <Text $size="s" $variation="secondary">
          {t('Changes are saved to your account automatically.')}
        </Text>
        <Box $direction="row" $justify="flex-end">
          <Button onClick={onClose}>{t('Done')}</Button>
        </Box>
      </Box>
    </Modal>
  );
};
