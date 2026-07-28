import { Loader } from '@gouvfr-lasuite/cunningham-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Box, Text } from '@/components';
import { useConfig } from '@/core';
import { Doc } from '@/docs/doc-management';
import { useAppearance } from '@/features/appearance';

type OfficeState = 'loading' | 'saved' | 'saving' | 'error';

interface OnlyOfficeEditor {
  destroyEditor: () => void;
}

interface OnlyOfficeWindow extends Window {
  DocsAPI?: {
    DocEditor: new (
      id: string,
      config: Record<string, unknown>,
    ) => OnlyOfficeEditor;
  };
}

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-onlyoffice-src="${src}"]`,
    );
    if (existing) {
      if ((window as OnlyOfficeWindow).DocsAPI) {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(src)), {
          once: true,
        });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.onlyofficeSrc = src;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error(src)), {
      once: true,
    });
    document.head.appendChild(script);
  });

export const OfficeEditor = ({ doc }: { doc: Doc }) => {
  const { effectiveTheme } = useAppearance();
  const { t } = useTranslation();
  const { data: appConfig } = useConfig();
  const editorRef = useRef<OnlyOfficeEditor | undefined>(undefined);
  const [state, setState] = useState<OfficeState>('loading');

  useEffect(() => {
    let cancelled = false;
    const serverUrl = appConfig?.ONLYOFFICE_DOCUMENT_SERVER_URL?.replace(
      /\/$/,
      '',
    );
    if (!serverUrl) {
      setState('error');
      return;
    }

    const mountEditor = async () => {
      try {
        await loadScript(`${serverUrl}/web-apps/apps/api/documents/api.js`);
        const response = await fetchAPI(
          `documents/${doc.id}/office-config/?theme=${effectiveTheme}`,
        );
        if (!response.ok) {
          throw new APIError(
            'Failed to load the office editor configuration',
            await errorCauses(response),
          );
        }
        const config = (await response.json()) as Record<string, unknown>;
        if (cancelled) {
          return;
        }
        const DocsAPI = (window as OnlyOfficeWindow).DocsAPI;
        if (!DocsAPI) {
          throw new Error('ONLYOFFICE API is unavailable');
        }
        config.events = {
          onDocumentReady: () => setState('saved'),
          onDocumentStateChange: (event: { data: boolean }) =>
            setState(event.data ? 'saving' : 'saved'),
          onError: () => setState('error'),
        };
        editorRef.current = new DocsAPI.DocEditor(
          'mapledocs-office-editor',
          config,
        );
      } catch {
        if (!cancelled) {
          setState('error');
        }
      }
    };

    void mountEditor();
    return () => {
      cancelled = true;
      editorRef.current?.destroyEditor();
      editorRef.current = undefined;
    };
  }, [appConfig?.ONLYOFFICE_DOCUMENT_SERVER_URL, doc.id, effectiveTheme]);

  return (
    <Box $height="100%" $width="100%" $position="relative">
      <Box
        $direction="row"
        $align="center"
        $gap="2xs"
        $position="absolute"
        $css="right: 16px; top: 10px; z-index: 2;"
      >
        {state === 'saving' && <Loader size="small" />}
        <Text
          $size="s"
          $theme={state === 'error' ? 'error' : 'neutral'}
          $variation="tertiary"
        >
          {state === 'loading' && t('Loading editor...')}
          {state === 'saving' && t('Saving...')}
          {state === 'saved' && t('Saved')}
          {state === 'error' && t('Unable to load or save this document')}
        </Text>
      </Box>
      <div
        id="mapledocs-office-editor"
        style={{ height: '100%', width: '100%' }}
      />
    </Box>
  );
};
