import {
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import { t } from 'i18next';
import { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';

import { APIError } from '@/api';
import { useConfig } from '@/core';

import {
  ContentTypes,
  ImportConflict,
  ImportConflictStrategy,
  useImportDoc,
} from '../api/useImportDoc';
import { ImportConflictModal } from '../components/ImportConflictModal';
import { Doc } from '../types';

interface UseImportProps {
  onDragOver?: (isDragOver: boolean) => void;
  onImportSuccess?: (doc: Doc) => void;
}

interface AcceptedMap {
  [mime: string]: string[];
}

const isImportConflict = (value: unknown): value is ImportConflict => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const conflict = value as Partial<ImportConflict>;
  return (
    (conflict.code === 'exact_duplicate' ||
      conflict.code === 'name_conflict') &&
    !!conflict.existing_document
  );
};

export const useImport = ({ onDragOver, onImportSuccess }: UseImportProps) => {
  const { toast } = useToastProvider();
  const { data: config } = useConfig();

  const MAX_FILE_SIZE = useMemo(() => {
    const maxSizeInBytes = config?.CONVERSION_FILE_MAX_SIZE ?? 10 * 1024 * 1024; // Default to 10MB

    const units = ['bytes', 'KB', 'MB', 'GB'];
    let size = maxSizeInBytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }

    return {
      bytes: maxSizeInBytes,
      text: `${Math.round(size * 10) / 10}${units[unitIndex]}`,
    };
  }, [config?.CONVERSION_FILE_MAX_SIZE]);

  const ACCEPT = useMemo((): AcceptedMap => {
    const allowedExtensions = config?.CONVERSION_FILE_EXTENSIONS_ALLOWED?.map(
      (ext: string) => ext.toLowerCase(),
    ) ?? ['.doc', '.docx', '.md'];

    return Object.values(ContentTypes).reduce(
      (acc: AcceptedMap, contentType) => {
        const matchedExtensions = contentType.extensions.filter((ext: string) =>
          allowedExtensions.includes(ext),
        );

        if (matchedExtensions.length > 0) {
          acc[contentType.mime] = matchedExtensions;
        }

        return acc;
      },
      {},
    );
  }, [config?.CONVERSION_FILE_EXTENSIONS_ALLOWED]);

  const toastInvalidFileType = useCallback(
    (fileName: string) => {
      const allowedExtensions = Object.values(ACCEPT).flat().join(', ');
      toast(
        t(
          allowedExtensions
            ? `The document "{{documentName}}" import has failed (only {{allowedExtensions}} files are allowed)`
            : `The document "{{documentName}}" import has failed`,
          {
            documentName: fileName,
            allowedExtensions,
          },
        ),
        VariantType.ERROR,
      );
    },
    [ACCEPT, toast],
  );

  const { mutateAsync: importDoc, isPending: isMutationPending } =
    useImportDoc();
  const [isBatchPending, setIsBatchPending] = useState(false);
  const [pendingConflict, setPendingConflict] = useState<{
    file: File;
    conflict: ImportConflict;
    resolve: (strategy: Exclude<ImportConflictStrategy, 'ask'>) => void;
  }>();

  const requestConflictStrategy = useCallback(
    (file: File, conflict: ImportConflict) =>
      new Promise<Exclude<ImportConflictStrategy, 'ask'>>((resolve) => {
        setPendingConflict({ file, conflict, resolve });
      }),
    [],
  );

  const importFiles = useCallback(
    async (files: File[]) => {
      setIsBatchPending(true);
      try {
        for (const file of files) {
          const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
          const contentType = Object.values(ContentTypes).find((item) =>
            item.extensions.includes(extension),
          );
          try {
            const doc = await importDoc([
              file,
              file.type || contentType?.mime || 'application/octet-stream',
              'ask',
            ]);
            onImportSuccess?.(doc);
          } catch (error) {
            const conflict =
              error instanceof APIError ? (error.data as unknown) : undefined;
            if (
              error instanceof APIError &&
              error.status === 409 &&
              isImportConflict(conflict)
            ) {
              const strategy = await requestConflictStrategy(file, conflict);
              setPendingConflict(undefined);
              const doc = await importDoc([
                file,
                file.type || contentType?.mime || 'application/octet-stream',
                strategy,
              ]);
              onImportSuccess?.(doc);
            }
          }
        }
      } finally {
        setIsBatchPending(false);
      }
    },
    [importDoc, onImportSuccess, requestConflictStrategy],
  );

  const { getRootProps, getInputProps, open } = useDropzone({
    accept: ACCEPT,
    maxSize: MAX_FILE_SIZE.bytes,
    onDrop(acceptedFiles) {
      onDragOver?.(false);
      const allowedExtensions = Object.values(ACCEPT).flat();
      const validFiles = acceptedFiles.filter((file) => {
        const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
        if (!allowedExtensions.includes(ext)) {
          toastInvalidFileType(file.name);
          return false;
        }
        return true;
      });
      void importFiles(validFiles);
    },
    onDragEnter: () => {
      onDragOver?.(true);
    },
    onDragLeave: () => {
      onDragOver?.(false);
    },
    onDropRejected(fileRejections) {
      fileRejections.forEach((rejection) => {
        const isFileTooLarge = rejection.errors.some(
          (error) => error.code === 'file-too-large',
        );

        if (isFileTooLarge) {
          toast(
            t(
              'The document "{{documentName}}" is too large. Maximum file size is {{maxFileSize}}.',
              {
                documentName: rejection.file.name,
                maxFileSize: MAX_FILE_SIZE.text,
              },
            ),
            VariantType.ERROR,
          );
        } else {
          toastInvalidFileType(rejection.file.name);
        }
      });
    },
    noClick: true,
    noKeyboard: true,
  });
  return {
    getRootProps,
    getInputProps,
    open,
    isEnabled: config?.CONVERSION_UPLOAD_ENABLED || false,
    isPending: isMutationPending || isBatchPending,
    conflictModal: pendingConflict ? (
      <ImportConflictModal
        conflict={pendingConflict.conflict}
        fileName={pendingConflict.file.name}
        onResolve={pendingConflict.resolve}
      />
    ) : null,
  };
};
