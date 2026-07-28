import { useTranslation } from 'react-i18next';

import { DocDefaultFilter, useTrans } from '@/docs/doc-management';
import { NewDocButton } from '@/docs/doc-management/components/NewDocButton';
import { useAppearance } from '@/features/appearance';
import { DocSearchButtonModal } from '@/features/docs/doc-search/components/DocSearchButtonModal';
import { useLeftPanelStore } from '@/features/left-panel';

export const DocsTopBar = ({ target }: { target: DocDefaultFilter }) => {
  const { t } = useTranslation();
  const { transFilter } = useTrans();
  const { effectiveTheme, toggleTheme } = useAppearance();
  const { isPanelOpen, togglePanel } = useLeftPanelStore();

  return (
    <header className="maple-workspace-topbar">
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
      <h1>{transFilter(target)}</h1>
      <div className="maple-workspace-actions">
        <DocSearchButtonModal className="maple-doc-search-trigger">
          <span>{t('Search docs')}</span>
        </DocSearchButtonModal>
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
        <NewDocButton />
      </div>
    </header>
  );
};
