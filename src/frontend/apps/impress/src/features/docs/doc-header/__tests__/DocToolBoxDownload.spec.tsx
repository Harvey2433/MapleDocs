import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('next/router', async () => ({
  ...(await vi.importActual('next/router')),
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/docs/doc-1',
  }),
}));

vi.mock('@gouvfr-lasuite/ui-kit', async () => {
  const actual = await vi.importActual('@gouvfr-lasuite/ui-kit');
  return {
    ...actual,
    DropdownMenu: ({ options, children }: any) => (
      <>
        {children}
        <ul>
          {options
            .filter((option: any) => !option.isHidden)
            .map((option: any) => (
              <li key={option.label}>{option.label}</li>
            ))}
        </ul>
      </>
    ),
  };
});

vi.mock('../hooks/useCopyCurrentEditorToClipboard', () => ({
  useCopyCurrentEditorToClipboard: () => vi.fn(),
}));

describe('DocToolBox - same-format download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders the download command when the API allows it', async () => {
    const { AppWrapper } = await import('@/tests/utils');
    const { DocToolBox } = await import('../components/DocToolBox');
    const doc = {
      nb_accesses: 1,
      abilities: { versions_list: true, destroy: true, download: true },
    };

    render(<DocToolBox doc={doc as any} />, { wrapper: AppWrapper });

    expect(await screen.findByText('Download')).toBeInTheDocument();
  }, 15000);

  test('hides the download command without API permission', async () => {
    const { AppWrapper } = await import('@/tests/utils');
    const { DocToolBox } = await import('../components/DocToolBox');
    const doc = {
      nb_accesses: 1,
      abilities: { versions_list: true, destroy: true },
    };

    render(<DocToolBox doc={doc as any} />, { wrapper: AppWrapper });

    expect(screen.queryByText('Download')).not.toBeInTheDocument();
  }, 15000);
});
