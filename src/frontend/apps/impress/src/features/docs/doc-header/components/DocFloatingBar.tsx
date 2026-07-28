import { useTranslation } from 'react-i18next';

import { StyledLink } from '@/components';
import { getEmojiAndTitle, useDocStore, useTrans } from '@/docs/doc-management';
import { useAppearance } from '@/features/appearance';
import { useAuth } from '@/features/auth';
import {
  KEY_LIST_DOC_ACCESSES,
  useDocAccesses,
} from '@/features/docs/doc-share/api';
import { DocShareButton } from '@/features/docs/doc-share/components/DocShareButton';
import { useLeftPanelStore } from '@/features/left-panel';
import { RightPanelCollapseButton } from '@/features/right-panel/components/RightPanelCollapseButton';

import { DocToolBox } from './DocToolBox';

const initials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const DocFloatingBar = () => {
  const { t } = useTranslation();
  const { currentDoc } = useDocStore();
  const { user } = useAuth();
  const { untitledDocument } = useTrans();
  const { effectiveTheme, toggleTheme } = useAppearance();
  const { isPanelOpen, togglePanel } = useLeftPanelStore();
  const isDeletedDoc = !!currentDoc?.deleted_at;
  const { data: accesses } = useDocAccesses(
    { docId: currentDoc?.id || '' },
    {
      enabled: !!currentDoc?.id && !!currentDoc.abilities.accesses_view,
      queryKey: [KEY_LIST_DOC_ACCESSES, currentDoc?.id],
    },
  );
  const title = currentDoc
    ? getEmojiAndTitle(currentDoc.title || '').titleWithoutEmoji ||
      untitledDocument
    : untitledDocument;
  const people = accesses?.map((access) => access.user) || (user ? [user] : []);

  return (
    <header className="maple-doc-topbar" data-testid="floating-bar">
      {!isPanelOpen && (
        <button
          className="maple-icon-button maple-sidebar-restore"
          type="button"
          aria-label={t('Open left panel')}
          title={t('Open left panel')}
          onClick={togglePanel}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            dock_to_right
          </span>
        </button>
      )}
      <nav className="maple-doc-breadcrumb" aria-label={t('Breadcrumb')}>
        <StyledLink href="/">{t('All docs')}</StyledLink>
        <span aria-hidden="true">/</span>
        <strong>{title}</strong>
      </nav>
      <div className="maple-doc-presence" aria-label={t('Collaborators')}>
        {people.slice(0, 3).map((person, index) => (
          <span
            key={person.id || `${person.email}-${index}`}
            className={`maple-mini-avatar maple-presence-${index + 1}`}
            title={person.full_name || person.email}
          >
            {person.avatar_url ? (
              <img src={person.avatar_url} alt="" />
            ) : (
              initials(person.full_name || person.email || 'M')
            )}
          </span>
        ))}
        {people.length > 3 && (
          <span className="maple-presence-more">+{people.length - 3}</span>
        )}
      </div>
      <div className="maple-doc-top-actions">
        <button
          className="maple-icon-button maple-theme-toggle"
          type="button"
          aria-label={t('Switch color mode')}
          title={t('Switch color mode')}
          onClick={toggleTheme}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {effectiveTheme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
        <RightPanelCollapseButton />
        {!isDeletedDoc && currentDoc && <DocShareButton doc={currentDoc} />}
        {!isDeletedDoc && currentDoc && <DocToolBox doc={currentDoc} />}
      </div>
    </header>
  );
};
