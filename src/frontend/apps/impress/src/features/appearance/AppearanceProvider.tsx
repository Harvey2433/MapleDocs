import { useQueryClient } from '@tanstack/react-query';
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { KEY_AUTH, User, UserAppearance, useAuth } from '@/features/auth';
import DefaultWallpaper from '@/features/home/assets/banner.jpg';

import { AppearanceSettings } from './AppearanceSettings';

export const DEFAULT_APPEARANCE: UserAppearance = {
  theme_mode: 'system',
  accent: '#1F5D45',
  surface_opacity: 70,
  material: 'mica',
  material_strength: 70,
  background_source: 'none',
  background_url: '',
  background_refresh_minutes: 0,
};

type AppearanceContextValue = {
  appearance: UserAppearance;
  effectiveTheme: 'light' | 'dark';
  setAppearance: (value: UserAppearance) => void;
  transitionTheme: (
    mode: UserAppearance['theme_mode'],
    origin?: HTMLElement,
  ) => void;
  toggleTheme: (origin?: HTMLElement) => void;
  openSettings: () => void;
  uploadBackground: (file: File) => Promise<void>;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

const getSystemTheme = () =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const updateUser = async (id: string, body: BodyInit, multipart = false) => {
  const response = await fetchAPI(`users/${id}/`, {
    method: 'PATCH',
    body,
    withoutContentType: multipart,
  });
  if (!response.ok) {
    throw new APIError(
      'Failed to update appearance',
      await errorCauses(response),
    );
  }
  return response.json() as Promise<User>;
};

export const AppearanceProvider = ({ children }: PropsWithChildren) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [appearance, setAppearance] = useState<UserAppearance>({
    ...DEFAULT_APPEARANCE,
    ...user?.appearance,
  });
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    typeof window === 'undefined' ? 'light' : getSystemTheme(),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wallpaperRevision, setWallpaperRevision] = useState(0);
  const lastSaved = useRef(JSON.stringify(appearance));

  useEffect(() => {
    const next = { ...DEFAULT_APPEARANCE, ...user?.appearance };
    const serialized = JSON.stringify(next);
    // A successful save writes the server copy back into the cache. Re-applying
    // it here would discard edits made while that request was in flight.
    if (serialized === lastSaved.current) {
      return;
    }
    setAppearance(next);
    lastSaved.current = serialized;
  }, [user?.id, user?.appearance]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => setSystemTheme(getSystemTheme());
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    if (!user || JSON.stringify(appearance) === lastSaved.current) {
      return;
    }
    const timeout = window.setTimeout(async () => {
      try {
        const saved = await updateUser(user.id, JSON.stringify({ appearance }));
        lastSaved.current = JSON.stringify(appearance);
        queryClient.setQueryData([KEY_AUTH], saved);
      } catch {
        // Keep the local draft; the next valid change retries the full object.
      }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [appearance, queryClient, user]);

  useEffect(() => {
    if (!appearance.background_refresh_minutes) {
      return;
    }
    const interval = window.setInterval(
      () => setWallpaperRevision((value) => value + 1),
      appearance.background_refresh_minutes * 60_000,
    );
    return () => window.clearInterval(interval);
  }, [appearance.background_refresh_minutes]);

  const effectiveTheme =
    appearance.theme_mode === 'system' ? systemTheme : appearance.theme_mode;

  useEffect(() => {
    const root = document.documentElement;
    const ratio = appearance.material_strength / 100;
    const material = {
      mica: {
        blur: 10 + ratio * 20,
        saturation: 1.08 + ratio * 0.2,
        chromeOpacity: 0.08 + ratio * 0.08,
      },
      gaussian: {
        blur: 2 + ratio * 34,
        saturation: 1,
        chromeOpacity: 0.04 + ratio * 0.05,
      },
      acrylic: {
        blur: 14 + ratio * 28,
        saturation: 1.2 + ratio * 0.35,
        chromeOpacity: 0.12 + ratio * 0.1,
      },
    }[appearance.material];
    root.dataset.theme = effectiveTheme;
    root.dataset.material = appearance.material;
    root.style.setProperty('--maple-accent', appearance.accent);
    root.style.setProperty(
      '--maple-surface-opacity',
      String(appearance.surface_opacity / 100),
    );
    root.style.setProperty(
      '--maple-material-strength',
      `${material.blur.toFixed(1)}px`,
    );
    root.style.setProperty(
      '--maple-material-saturation',
      material.saturation.toFixed(2),
    );
    root.style.setProperty(
      '--maple-chrome-opacity',
      material.chromeOpacity.toFixed(3),
    );
  }, [appearance, effectiveTheme]);

  const transitionTheme = useCallback(
    (mode: UserAppearance['theme_mode'], origin?: HTMLElement) => {
      const change = () =>
        setAppearance((current) => ({
          ...current,
          theme_mode: mode,
        }));
      const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const documentWithTransition = document as Document & {
        startViewTransition?: (callback: () => void) => {
          ready: Promise<void>;
          finished: Promise<void>;
        };
      };
      if (!documentWithTransition.startViewTransition || reduceMotion) {
        change();
        return;
      }

      const rect = origin?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 28;
      const y = rect ? rect.top + rect.height / 2 : 28;
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );
      origin?.classList.add('is-changing');
      const transition = documentWithTransition.startViewTransition(change);
      void transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 560,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        );
      });
      void transition.finished.finally(() =>
        origin?.classList.remove('is-changing'),
      );
    },
    [],
  );

  const toggleTheme = useCallback(
    (origin?: HTMLElement) => {
      transitionTheme(effectiveTheme === 'dark' ? 'light' : 'dark', origin);
    },
    [effectiveTheme, transitionTheme],
  );

  const uploadBackground = useCallback(
    async (file: File) => {
      if (!user) {
        return;
      }
      const form = new FormData();
      form.append('background_image', file);
      const saved = await updateUser(user.id, form, true);
      queryClient.setQueryData([KEY_AUTH], saved);
      setWallpaperRevision((value) => value + 1);
      setAppearance((current) => ({
        ...current,
        background_source: 'upload',
      }));
    },
    [queryClient, user],
  );

  const rawWallpaper =
    appearance.background_source === 'builtin'
      ? DefaultWallpaper.src
      : appearance.background_source === 'url'
        ? appearance.background_url
        : appearance.background_source === 'upload'
          ? user?.background_image_url || ''
          : '';
  const wallpaper = useMemo(() => {
    if (!rawWallpaper || !wallpaperRevision) {
      return rawWallpaper;
    }
    const separator = rawWallpaper.includes('?') ? '&' : '?';
    return `${rawWallpaper}${separator}maple_refresh=${wallpaperRevision}`;
  }, [rawWallpaper, wallpaperRevision]);

  return (
    <AppearanceContext.Provider
      value={{
        appearance,
        effectiveTheme,
        setAppearance,
        transitionTheme,
        toggleTheme,
        openSettings: () => setSettingsOpen(true),
        uploadBackground,
      }}
    >
      <Wallpaper url={wallpaper} />
      {children}
      {settingsOpen && (
        <AppearanceSettings onClose={() => setSettingsOpen(false)} />
      )}
    </AppearanceContext.Provider>
  );
};

const Wallpaper = ({ url }: { url: string }) => {
  const [current, setCurrent] = useState(url);
  const [previous, setPrevious] = useState('');
  const [visible, setVisible] = useState(true);
  const currentRef = useRef(url);

  useEffect(() => {
    if (url === currentRef.current) {
      return;
    }

    let cancelled = false;
    let firstFrame = 0;
    let secondFrame = 0;
    let cleanupTimeout = 0;
    let preload: HTMLImageElement | undefined;
    const reveal = () => {
      if (cancelled) {
        return;
      }
      setPrevious(currentRef.current);
      currentRef.current = url;
      setCurrent(url);
      setVisible(false);
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => setVisible(true));
      });
      cleanupTimeout = window.setTimeout(() => setPrevious(''), 700);
    };

    if (url) {
      preload = new Image();
      preload.addEventListener('load', reveal, { once: true });
      preload.src = url;
    } else {
      reveal();
    }

    return () => {
      cancelled = true;
      preload?.removeEventListener('load', reveal);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.clearTimeout(cleanupTimeout);
    };
  }, [url]);
  return (
    <div className="maple-wallpaper" aria-hidden="true">
      {previous && <div style={{ backgroundImage: `url("${previous}")` }} />}
      <div
        className={visible ? 'is-visible' : ''}
        style={{ backgroundImage: current ? `url("${current}")` : 'none' }}
      />
    </div>
  );
};

export const useAppearance = () => {
  const value = useContext(AppearanceContext);
  if (!value) {
    throw new Error('useAppearance must be used within AppearanceProvider');
  }
  return value;
};
