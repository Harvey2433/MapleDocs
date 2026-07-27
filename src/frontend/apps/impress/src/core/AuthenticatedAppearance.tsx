import { PropsWithChildren } from 'react';

import { AppearanceProvider } from '@/features/appearance';
import { Auth } from '@/features/auth';

/** Keep authentication-owned overlays inside the appearance context. */
export const AuthenticatedAppearance = ({ children }: PropsWithChildren) => (
  <AppearanceProvider>
    <Auth>{children}</Auth>
  </AppearanceProvider>
);
