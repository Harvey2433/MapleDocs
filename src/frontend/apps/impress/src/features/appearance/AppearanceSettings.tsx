import { ChangeEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MapleDialog } from '@/components';
import { useConfig } from '@/core';
import { UserAppearance } from '@/features/auth';

import { useAppearance } from './AppearanceProvider';

const accents = ['#1F5D45', '#356F9F', '#A34857', '#9A671E', '#525C66'];
const rgb = (value: string) =>
  [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16));
const hex = (values: number[]) =>
  `#${values.map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

const isValidBackgroundUrl = (value: string) => {
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      /\.(?:jpe?g|png|webp)(?:[?#].*)?$/i.test(url.href)
    );
  } catch {
    return false;
  }
};

export const AppearanceSettings = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const { data: config } = useConfig();
  const { appearance, setAppearance, uploadBackground } = useAppearance();
  const [accentDraft, setAccentDraft] = useState(appearance.accent);
  const [urlDraft, setUrlDraft] = useState(appearance.background_url);
  const [uploadState, setUploadState] = useState<
    'idle' | 'uploading' | 'error'
  >('idle');
  useEffect(() => setAccentDraft(appearance.accent), [appearance.accent]);
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
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setUploadState('uploading');
    try {
      await uploadBackground(file);
      setUploadState('idle');
    } catch {
      setUploadState('error');
    }
  };

  return (
    <MapleDialog
      className="maple-appearance-dialog"
      onClose={onClose}
      title={t('Personalization settings')}
    >
      <section className="maple-settings-group">
        <h3>
          <span className="material-symbols-outlined" aria-hidden="true">
            monitor
          </span>
          {t('Display mode')}
        </h3>
        <div className="maple-setting-options maple-mode-options">
          {(['system', 'light', 'dark'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              data-active={appearance.theme_mode === mode}
              onClick={() => patch({ theme_mode: mode })}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {mode === 'system'
                  ? 'monitor'
                  : mode === 'light'
                    ? 'light_mode'
                    : 'dark_mode'}
              </span>
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
      </section>

      <section className="maple-settings-group">
        <h3>
          <span className="material-symbols-outlined" aria-hidden="true">
            palette
          </span>
          {t('Theme color')}
        </h3>
        <div className="maple-color-row">
          <div className="maple-swatches">
            {accents.map((accent) => (
              <button
                key={accent}
                type="button"
                aria-label={accent}
                data-active={appearance.accent.toUpperCase() === accent}
                style={{ background: accent }}
                onClick={() => patch({ accent })}
              />
            ))}
          </div>
          <input
            className="maple-native-color"
            aria-label={t('Color picker')}
            type="color"
            value={appearance.accent}
            onChange={(event) =>
              patch({ accent: event.target.value.toUpperCase() })
            }
          />
          <label className="maple-hex-input">
            <span>HEX</span>
            <input
              value={accentDraft}
              maxLength={7}
              onChange={(event) => {
                const value = event.target.value;
                setAccentDraft(value);
                if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                  patch({ accent: value.toUpperCase() });
                }
              }}
            />
          </label>
          <div className="maple-rgb-inputs">
            {['R', 'G', 'B'].map((label, index) => (
              <label key={label}>
                <span>{label}</span>
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
        </div>
      </section>

      <section className="maple-settings-group">
        <h3>
          <span className="material-symbols-outlined" aria-hidden="true">
            image
          </span>
          {t('Global background')}
        </h3>
        <div className="maple-setting-options maple-wallpaper-options">
          <button
            type="button"
            data-active={appearance.background_source === 'none'}
            onClick={() => patch({ background_source: 'none' })}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
            {t('No background')}
          </button>
          <button
            type="button"
            data-active={appearance.background_source === 'builtin'}
            onClick={() => patch({ background_source: 'builtin' })}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              image
            </span>
            {t('Collaboration illustration')}
          </button>
          <label data-active={appearance.background_source === 'upload'}>
            <span className="material-symbols-outlined" aria-hidden="true">
              upload
            </span>
            {uploadState === 'uploading' ? t('Uploading...') : t('Local image')}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(event) => void upload(event)}
            />
          </label>
        </div>
        {uploadState === 'error' && (
          <p className="maple-setting-error">{t('Unable to upload image')}</p>
        )}
        <div className="maple-url-row">
          <input
            type="url"
            value={urlDraft}
            aria-invalid={!!urlDraft && !isValidBackgroundUrl(urlDraft)}
            placeholder="https://example.com/background.webp"
            aria-label={t('Image URL')}
            onChange={(event) => setUrlDraft(event.target.value)}
          />
          <button
            className="maple-secondary-button"
            type="button"
            disabled={!isValidBackgroundUrl(urlDraft)}
            onClick={() =>
              patch({ background_source: 'url', background_url: urlDraft })
            }
          >
            {t('Apply URL')}
          </button>
        </div>
        <label className="maple-interval-row">
          <span>{t('URL refresh interval')}</span>
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
            <option value="15">{t('Every 15 minutes')}</option>
            <option value="60">{t('Every hour')}</option>
            <option value="360">{t('Every 6 hours')}</option>
            <option value="1440">{t('Every 24 hours')}</option>
          </select>
        </label>
      </section>

      <section className="maple-settings-group">
        <h3>{t('Interface material')}</h3>
        <div className="maple-setting-options maple-material-options">
          {(['mica', 'gaussian', 'acrylic'] as const).map((material) => (
            <button
              key={material}
              type="button"
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
        <label className="maple-range-row">
          <input
            type="range"
            min="0"
            max="100"
            value={appearance.material_strength}
            onChange={(event) =>
              patch({ material_strength: Number(event.target.value) })
            }
          />
          <output>{appearance.material_strength}%</output>
        </label>
      </section>

      <section className="maple-settings-group">
        <h3>{t('Interface opacity')}</h3>
        <label className="maple-range-row">
          <input
            type="range"
            min="25"
            max="95"
            value={appearance.surface_opacity}
            onChange={(event) =>
              patch({ surface_opacity: Number(event.target.value) })
            }
          />
          <output>{appearance.surface_opacity}%</output>
        </label>
      </section>

      {!config?.COMMENTS_ENABLED && (
        <p className="maple-setting-note">
          <span className="material-symbols-outlined" aria-hidden="true">
            lock
          </span>
          {t('Comments are disabled by the administrator.')}
        </p>
      )}
    </MapleDialog>
  );
};
