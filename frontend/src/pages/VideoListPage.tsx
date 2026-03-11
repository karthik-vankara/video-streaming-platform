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

  if (loading) return <div className="container" style={{padding:'2rem', textAlign:'center'}}>Loading…</div>;
  if (error) return <div className="container" style={{padding:'2rem', color:'#721c24'}}>{error}</div>;
  if (!data || data.content.length === 0) {
    return (
      <div className="container" style={{textAlign:'center'}}>
        <h1>Video Library</h1>
        <p>No videos yet. <Link to="/upload">Upload one!</Link></p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Video Library</h1>

      <div className="grid">
        {data.content.map((video) => (
          <Link
            key={video.id}
            to={video.status === 'READY' ? `/videos/${video.id}` : '#'}
            className="card"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              cursor: video.status === 'READY' ? 'pointer' : 'default',
              opacity: video.status === 'READY' ? 1 : 0.8,
              display:'flex',
              flexDirection:'column'
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
              <div className="video-card-title">
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
        <div className="pagination">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className={page===0 ? 'btn btn-disabled' : ''}
          >
            Previous
          </button>
          <span style={{ alignSelf: 'center' }}>
            Page {page + 1} of {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= data.totalPages - 1}
            className={page>=data.totalPages-1 ? 'btn btn-disabled' : ''}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
