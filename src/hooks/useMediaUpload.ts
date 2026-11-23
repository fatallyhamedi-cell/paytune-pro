import { useRef, useState, useCallback } from 'react';
import { uploadWithProgress, UploadProgressInfo } from '../services/mediaUploadEngine';

export type UploadLifecycleStatus = 'idle' | 'validating' | 'uploading' | 'processing' | 'success' | 'error' | 'cancelled';

export function useMediaUpload<T = any>() {
  const [status, setStatus] = useState<UploadLifecycleStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [loadedBytes, setLoadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('cancelled');
  }, []);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('idle');
    setProgress(0);
    setLoadedBytes(0);
    setTotalBytes(0);
    setError(null);
    setResult(null);
  }, []);

  const executeUpload = useCallback(
    async ({
      url,
      formData,
      method = 'POST',
    }: {
      url: string;
      formData: FormData;
      method?: 'POST' | 'PUT';
    }): Promise<T> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setStatus('uploading');
      setProgress(0);
      setError(null);

      try {
        const res = await uploadWithProgress<T>({
          url,
          formData,
          method,
          signal: controller.signal,
          onProgress: (info: UploadProgressInfo) => {
            setProgress(info.percent);
            setLoadedBytes(info.loadedBytes);
            setTotalBytes(info.totalBytes);
            if (info.percent >= 100) {
              setStatus('processing');
            }
          },
        });
        setResult(res);
        setProgress(100);
        setStatus('success');
        abortControllerRef.current = null;
        return res;
      } catch (err: any) {
        abortControllerRef.current = null;
        if (err?.name === 'AbortError') {
          setStatus('cancelled');
          throw err;
        }
        const message = err?.message || 'Upload failed';
        setError(message);
        setStatus('error');
        throw err;
      }
    },
    []
  );

  return {
    status,
    setStatus,
    progress,
    loadedBytes,
    totalBytes,
    error,
    setError,
    result,
    upload: executeUpload,
    cancel,
    reset,
  };
}
