export type MediaKind = 'audio' | 'video' | 'short';

export interface MediaPlayDetail {
  sourceId: string;
  kind: MediaKind;
}

const EVENT_NAME = 'paytune:media-play';

export function emitMediaPlay(sourceId: string, kind: MediaKind): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<MediaPlayDetail>(EVENT_NAME, {
      detail: { sourceId, kind },
    })
  );
}

export function subscribeMediaPlay(
  shouldIgnore: string | ((detail: MediaPlayDetail) => boolean),
  onOtherPlay: (detail: MediaPlayDetail) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<MediaPlayDetail>;
    const detail = customEvent.detail;
    if (!detail) return;

    if (typeof shouldIgnore === 'string') {
      if (detail.sourceId === shouldIgnore) return;
    } else if (shouldIgnore(detail)) {
      return;
    }

    onOtherPlay(detail);
  };

  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
