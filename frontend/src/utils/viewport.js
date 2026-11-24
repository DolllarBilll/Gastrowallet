export function resetViewportZoom() {
  if (typeof document === 'undefined') return;

  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }

  const baseContent = 'width=device-width, initial-scale=1.0';
  const existingMeta = document.querySelector('meta[name="viewport"]');

  const lockedMeta = document.createElement('meta');
  lockedMeta.name = 'viewport';
  lockedMeta.content = `${baseContent}, maximum-scale=1.0`;

  if (existingMeta && existingMeta.parentNode) {
    existingMeta.parentNode.replaceChild(lockedMeta, existingMeta);
  } else {
    document.head.appendChild(lockedMeta);
  }

  setTimeout(() => {
    const unlockedMeta = document.createElement('meta');
    unlockedMeta.name = 'viewport';
    unlockedMeta.content = baseContent;

    if (lockedMeta.parentNode) {
      lockedMeta.parentNode.replaceChild(unlockedMeta, lockedMeta);
    }
  }, 150);
}