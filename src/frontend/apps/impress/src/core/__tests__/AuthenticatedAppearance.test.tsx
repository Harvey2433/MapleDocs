import { render, screen } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { AuthenticatedAppearance } from '../AuthenticatedAppearance';

vi.mock('@/features/appearance', () => ({
  AppearanceProvider: ({ children }: PropsWithChildren) => (
    <section data-testid="appearance-provider">{children}</section>
  ),
}));

vi.mock('@/features/auth', () => ({
  Auth: ({ children }: PropsWithChildren) => (
    <>
      {children}
      <div data-testid="auth-owned-overlay" />
    </>
  ),
}));

describe('AuthenticatedAppearance', () => {
  test('keeps authentication-owned overlays inside the appearance provider', () => {
    render(
      <AuthenticatedAppearance>
        <div data-testid="page" />
      </AuthenticatedAppearance>,
    );

    const appearanceProvider = screen.getByTestId('appearance-provider');
    expect(appearanceProvider).toContainElement(screen.getByTestId('page'));
    expect(appearanceProvider).toContainElement(
      screen.getByTestId('auth-owned-overlay'),
    );
  });
});
