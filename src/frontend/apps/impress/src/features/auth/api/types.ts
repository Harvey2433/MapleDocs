/**
 * Represents user retrieved from the API.
 * @interface User
 * @property {string} id - The id of the user.
 * @property {string} email - The email of the user.
 * @property {string} name - The name of the user.
 * @property {string} language - The language of the user. e.g. 'en-us', 'fr-fr', 'de-de'.
 */
export interface User {
  id: string;
  is_first_connection: boolean;
  email: string;
  full_name: string;
  short_name: string;
  language?: string;
  avatar_url?: string | null;
  background_image_url?: string | null;
  appearance?: Partial<UserAppearance>;
}

export interface UserAppearance {
  theme_mode: 'system' | 'light' | 'dark';
  accent: string;
  surface_opacity: number;
  material: 'mica' | 'gaussian' | 'acrylic';
  material_strength: number;
  background_source: 'none' | 'builtin' | 'upload' | 'url';
  background_url: string;
  background_refresh_minutes: 0 | 15 | 60 | 360 | 1440;
}

export type UserLight = Pick<User, 'full_name' | 'short_name'>;
