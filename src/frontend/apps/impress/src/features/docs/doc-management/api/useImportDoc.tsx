import {
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/cunningham-react';
import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { APIError, UseInfiniteQueryResultAPI, fetchAPI } from '@/api';

import { Doc } from '../types';

import { DocsResponse, KEY_LIST_DOC } from './useDocs';

interface ContentType {
  mime: string;
  extensions: string[];
}

export const ContentTypes: {
  Doc: ContentType;
  Docx: ContentType;
  Markdown: ContentType;
  OctetStream: ContentType;
} = {
  Doc: {
    mime: 'application/msword',
    extensions: ['.doc'],
  },
  Docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['.docx'],
  },
  Markdown: {
    mime: 'text/markdown',
    extensions: ['.md'],
  },
  OctetStream: {
    mime: 'application/octet-stream',
    extensions: [],
  },
};

export type ImportConflictStrategy = 'ask' | 'skip' | 'keep_both' | 'replace';
export type ImportedDoc = Doc & {
  import_status: 'created' | 'skipped' | 'replaced';
};
export interface ImportConflict {
  code: 'exact_duplicate' | 'name_conflict';
  detail: string;
  existing_document: Pick<
    Doc,
    'id' | 'title' | 'file_type' | 'source_name' | 'updated_at'
  >;
}

export const importDoc = async ([file, mimeType, strategy = 'ask']: [
  File,
  string,
  ImportConflictStrategy?,
]): Promise<ImportedDoc> => {
  const form = new FormData();

  form.append(
    'file',
    new File([file], file.name, {
      type: mimeType,
      lastModified: file.lastModified,
    }),
  );
  form.append('conflict_strategy', strategy);

  const response = await fetchAPI(`documents/`, {
    method: 'POST',
    body: form,
    withoutContentType: true,
  });

  if (!response.ok) {
    const body = (await response.json()) as ImportConflict &
      Record<string, unknown>;
    throw new APIError<ImportConflict>('Failed to import the doc', {
      status: response.status,
      cause: typeof body.detail === 'string' ? [body.detail] : undefined,
      data: body,
    });
  }

  return response.json() as Promise<ImportedDoc>;
};

type ImportVariables = [File, string, ImportConflictStrategy?];
type UseImportDocOptions = UseMutationOptions<
  ImportedDoc,
  APIError<ImportConflict>,
  ImportVariables
>;

export function useImportDoc(props?: UseImportDocOptions) {
  const { toast } = useToastProvider();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<ImportedDoc, APIError<ImportConflict>, ImportVariables>({
    mutationFn: importDoc,
    ...props,
    onSuccess: (...successProps) => {
      const importedDoc = successProps[0];

      const updateDocsListCache = (isCreatorMe: boolean | undefined) => {
        if (importedDoc.import_status === 'skipped') {
          return;
        }

        queryClient.setQueriesData<UseInfiniteQueryResultAPI<DocsResponse>>(
          {
            queryKey: [
              KEY_LIST_DOC,
              {
                page: 1,
                ordering: undefined,
                is_creator_me: isCreatorMe,
                title: undefined,
                is_favorite: undefined,
              },
            ],
          },
          (oldData) => {
            if (!oldData || oldData?.pages.length === 0) {
              return oldData;
            }

            const alreadyListed = oldData.pages.some((page) =>
              page.results.some((doc) => doc.id === importedDoc.id),
            );

            return {
              ...oldData,
              pages: oldData.pages.map((page, index) => {
                let results = page.results;

                if (importedDoc.import_status === 'replaced') {
                  results = results.map((doc) =>
                    doc.id === importedDoc.id ? importedDoc : doc,
                  );
                }

                if (
                  index === 0 &&
                  (importedDoc.import_status === 'created' || !alreadyListed)
                ) {
                  results = [
                    importedDoc,
                    ...results.filter((doc) => doc.id !== importedDoc.id),
                  ];
                }

                return results === page.results ? page : { ...page, results };
              }),
            };
          },
        );
      };

      updateDocsListCache(undefined);
      updateDocsListCache(true);

      const messages = {
        created:
          'The document "{{documentName}}" has been successfully imported',
        replaced: 'The document "{{documentName}}" has been replaced',
        skipped: 'The document "{{documentName}}" was skipped',
      } as const;
      toast(
        t(messages[importedDoc.import_status], {
          documentName: importedDoc.title || '',
        }),
        VariantType.SUCCESS,
      );

      props?.onSuccess?.(...successProps);
    },
    onError: (...errorProps) => {
      if (errorProps[0].status === 409) {
        props?.onError?.(...errorProps);
        return;
      }
      toast(
        t(`The document "{{documentName}}" import has failed`, {
          documentName: errorProps?.[1][0].name || '',
        }),
        VariantType.ERROR,
      );

      props?.onError?.(...errorProps);
    },
  });
}
