export function isIOS(userAgent = navigator.userAgent) {
  return /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
}

export function getInstallAction({ isIOS: runningOnIOS, prompt }) {
  return runningOnIOS || !prompt ? 'manual' : 'prompt';
}

/**
 * Get a Unique Install ID from localstorage.
 * If not existing, generate a new one and store it.
 */
export function getInstallId() {
  const key = 'installId';
  let installId = localStorage.getItem(key);
  if (!installId) {
    installId = crypto.randomUUID();
    localStorage.setItem(key, installId);
  }
  return installId;
}