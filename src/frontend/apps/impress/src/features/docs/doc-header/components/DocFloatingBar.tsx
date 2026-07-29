import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import MoonIcon from '@/assets/icons/maple/moon.svg';
import PanelIcon from '@/assets/icons/maple/panel-left-close.svg';
import SunIcon from '@/assets/icons/maple/sun.svg';
import { StyledLink } from '@/components';
import { useConfig } from '@/core';
import {
  getEmojiAndTitle,
  useDocStore,
  useProviderStore,
  useTrans,
} from '@/docs/doc-management';
import { useAppearance } from '@/features/appearance';
import { User, useAuth } from '@/features/auth';
import { CommentSideBarButton } from '@/features/docs/doc-comments/components/CommentSideBar';
import {
  KEY_LIST_DOC_ACCESSES,
  useDocAccesses,
} from '@/features/docs/doc-share/api';
import { DocShareButton } from '@/features/docs/doc-share/components/DocShareButton';
import { useLeftPanelStore } from '@/features/left-panel';

import { DocToolBox } from './DocToolBox';

const initials = (value: string) => {
  const parts = value.trim().split(/\s+/);
  const result =
    parts.length === 1
      ? Array.from(parts[0]).slice(0, 2).join('')
      : parts.map((part) => part[0]).join('');
  return result.slice(0, 2).toUpperCase();
};

type PresencePerson = Pick<
  User,
  'id' | 'email' | 'full_name' | 'short_name' | 'avatar_url'
>;

type AwarenessProfile = {
  id: string;
  email: string;
  name: string;
  shortName: string;
  avatarUrl: string | null;
};

export const DocFloatingBar = () => {
  const { t } = useTranslation();
  const { currentDoc } = useDocStore();
  const { user } = useAuth();
  const { untitledDocument } = useTrans();
  const { effectiveTheme, toggleTheme } = useAppearance();
  const { data: config } = useConfig();
  const { provider } = useProviderStore();
  const { isPanelOpen, togglePanel } = useLeftPanelStore();
  const [people, setPeople] = useState<PresencePerson[]>(user ? [user] : []);
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

  useEffect(() => {
    const awareness = provider?.awareness;
    const updatePeople = () => {
      const accessUsers = [
        ...(user ? [user] : []),
        ...(accesses?.map((access) => access.user) || []),
      ];
      const online = new Map<string, PresencePerson>();
      awareness?.getStates().forEach((state) => {
        const profile = state.mapleUser as AwarenessProfile | undefined;
        if (profile?.id && profile.name) {
          online.set(profile.id, {
            id: profile.id,
            email: profile.email,
            full_name: profile.name,
            short_name: profile.shortName,
            avatar_url: profile.avatarUrl,
          });
          return;
        }
        const presence = state.user as { name?: unknown } | undefined;
        const name =
          typeof presence?.name === 'string' ? presence.name.trim() : '';
        if (name) {
          const normalized = name.toLocaleLowerCase();
          const match = accessUsers.find((candidate) =>
            [candidate.full_name, candidate.short_name, candidate.email]
              .filter(Boolean)
              .some((value) => value.toLocaleLowerCase() === normalized),
          );
          online.set(
            match?.id || `presence-${normalized}`,
            match || {
              id: `presence-${normalized}`,
              email: '',
              full_name: name,
              short_name: name,
              avatar_url: null,
            },
          );
        }
      });
      setPeople(online.size ? Array.from(online.values()) : user ? [user] : []);
    };
    if (awareness && user) {
      awareness.setLocalStateField('mapleUser', {
        id: user.id,
        email: user.email,
        name: user.full_name,
        shortName: user.short_name,
        avatarUrl: user.avatar_url || null,
      } satisfies AwarenessProfile);
    }
    updatePeople();
    awareness?.on('change', updatePeople);
    return () => awareness?.off('change', updatePeople);
  }, [accesses, provider, user]);

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
          <PanelIcon aria-hidden="true" width={20} height={20} />
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
          onClick={(event) => toggleTheme(event.currentTarget)}
        >
          {effectiveTheme === 'dark' ? (
            <SunIcon aria-hidden="true" width={19} height={19} />
          ) : (
            <MoonIcon aria-hidden="true" width={19} height={19} />
          )}
        </button>
        {config?.COMMENTS_ENABLED && currentDoc?.abilities.comment && (
          <CommentSideBarButton />
        )}
        {!isDeletedDoc && currentDoc && <DocShareButton doc={currentDoc} />}
        {!isDeletedDoc && currentDoc && <DocToolBox doc={currentDoc} />}
      </div>
    </header>
  );
};
