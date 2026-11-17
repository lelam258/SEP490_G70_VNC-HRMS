import Alert from '../ui/Alert';

export default function ResourceState({ loading, error, reload }: { loading: boolean; error?: string; reload: () => void }) {
  if (error) return <Alert>{error}<button type="button" className="button" onClick={reload}>Tải lại</button></Alert>;
  return loading ? <p className="directory-loading" role="status">Đang tải dữ liệu…</p> : null;
}
