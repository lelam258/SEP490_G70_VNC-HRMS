import { useEffect, useState } from 'react';
import { axiosClient } from '../services/axiosClient';
import { useAuthStore } from '../store/useAuthStore';

export default function useApiResource<T>(path: string, params: Record<string, unknown> = {}) {
  const actor = useAuthStore(state => state.session?.user);
  const serialized = JSON.stringify(params);
  const [revision, setRevision] = useState(0);
  const key = `${actor?.id}|${actor?.role}|${path}|${serialized}|${revision}`;
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: '' });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    axiosClient.get<T>(path, { params: JSON.parse(serialized), signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setState({ key, data: result.data }); })
      .catch(cause => { if (!controller.signal.aborted) setState({ key, error: cause instanceof Error ? cause.message : 'Không tải được dữ liệu.' }); });
    return () => controller.abort();
  }, [path, serialized, key]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : undefined,
    loading: !!path && state.key !== key, reload: () => setRevision(value => value + 1) };
}
