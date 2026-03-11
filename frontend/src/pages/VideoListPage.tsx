import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listVideos } from '../services/api';
import type { Video, PagedResponse } from '../types/video';
import StatusBadge from '../components/StatusBadge';

export default function VideoListPage() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PagedResponse<Video> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    listVideos(page, pageSize)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load videos'))
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>;
  if (error) return <div style={{ padding: '2rem', color: '#721c24' }}>{error}</div>;
  if (!data || data.content.length === 0) {
    return (
      <div style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem', textAlign: 'center' }}>
        <h1>Video Library</h1>
        <p>No videos yet. <Link to="/upload">Upload one!</Link></p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Video Library</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
        {data.content.map((video) => (
          <Link
            key={video.id}
            to={video.status === 'READY' ? `/videos/${video.id}` : '#'}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid #ddd',
              borderRadius: 8,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              cursor: video.status === 'READY' ? 'pointer' : 'default',
              opacity: video.status === 'READY' ? 1 : 0.8,
            }}
          >
            <div
              style={{
                height: 150,
                background: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ color: '#999', fontSize: '0.9rem' }}>No thumbnail</span>
              )}
            </div>
            <div style={{ padding: '0.75rem' }}>
              <div style={{ fontWeight: 600, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {video.title}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusBadge status={video.status} />
                <span style={{ fontSize: '0.75rem', color: '#888' }}>
                  {new Date(video.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{ padding: '0.5rem 1rem' }}
          >
            Previous
          </button>
          <span style={{ alignSelf: 'center' }}>
            Page {page + 1} of {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= data.totalPages - 1}
            style={{ padding: '0.5rem 1rem' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
