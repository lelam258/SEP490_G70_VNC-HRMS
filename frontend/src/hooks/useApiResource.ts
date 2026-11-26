import { useEffect, useState } from 'react';
import { axiosClient } from '../services/axiosClient';
import { useAuthStore } from '../store/useAuthStore';

export default function useApiResource<T>(path: string, params: Record<string, unknown> = {}, timeoutMs = 25_000) {
  const actor = useAuthStore(state => state.session?.user);
  const serialized = JSON.stringify(params);
  const [revision, setRevision] = useState(0);
  const key = `${actor?.id}|${actor?.role}|${path}|${serialized}|${revision}|${timeoutMs}`;
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: '' });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    // Also bound interceptor/proxy waits so an unresolved request cannot leave the page loading forever.
    const timer = window.setTimeout(() => {
      setState({ key, error: 'Tải dữ liệu quá thời gian chờ. Bấm Tải lại để thử lại.' });
      controller.abort();
    }, timeoutMs + 1000);
    axiosClient.get<T>(path, { params: JSON.parse(serialized), signal: controller.signal, timeout: timeoutMs })
      .then(result => { if (!controller.signal.aborted) setState({ key, data: result.data }); })
      .catch(cause => { if (!controller.signal.aborted) setState({ key, error: cause instanceof Error ? cause.message : 'Không tải được dữ liệu.' }); })
      .finally(() => window.clearTimeout(timer));
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [path, serialized, key, timeoutMs]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : undefined,
    loading: !!path && state.key !== key, reload: () => setRevision(value => value + 1) };
}
