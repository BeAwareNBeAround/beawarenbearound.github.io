import { useEffect, useRef } from 'react';
import { t } from '@lingui/core/macro';

const SCROLL_LOCK_CLASS = 'dialog-open';

export const InfoPanel = ({ className, summary, children }) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const unlockBodyScroll = () => document.body.classList.remove(SCROLL_LOCK_CLASS);
    dialog.addEventListener('close', unlockBodyScroll);
    return () => {
      dialog.removeEventListener('close', unlockBodyScroll);
      document.body.classList.remove(SCROLL_LOCK_CLASS);
    };
  }, []);

  const openDialog = () => {
    document.body.classList.add(SCROLL_LOCK_CLASS);
    dialogRef.current?.showModal();
  };

  const closeDialog = () => dialogRef.current?.close();

  const handleBackdropPointerDown = (event) => {
    if (event.target === event.currentTarget) {
      closeDialog();
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={openDialog}>{summary}</button>
      <dialog ref={dialogRef} className="info-dialog" aria-label={summary} onPointerDown={handleBackdropPointerDown}>
        <div className="info-dialog-header">
          <div className="info-dialog-title">{summary}</div>
          <button type="button" className="info-dialog-close" aria-label={t({ id: 'dialog.close', message: 'Close' })} onClick={closeDialog}>✕</button>
        </div>
        <div className="info-dialog-body">{children}</div>
      </dialog>
    </>
  );
};
