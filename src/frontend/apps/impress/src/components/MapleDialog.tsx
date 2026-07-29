import { PropsWithChildren, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import XSVG from '@/assets/icons/maple/x.svg';

type MapleDialogProps = PropsWithChildren<{
  className?: string;
  onClose: () => void;
  title: string;
}>;

export const MapleDialog = ({
  children,
  className = '',
  onClose,
  title,
}: MapleDialogProps) => {
  const { t } = useTranslation();
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="maple-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className={`maple-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="maple-dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button
            className="maple-icon-button"
            type="button"
            autoFocus
            aria-label={t('Close')}
            title={t('Close')}
            onClick={onClose}
          >
            <XSVG aria-hidden="true" />
          </button>
        </header>
        <div className="maple-dialog-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
};
