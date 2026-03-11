import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getVideo, retryVideo } from '../services/api';
import type { Video } from '../types/video';
import VideoPlayer from '../components/VideoPlayer';
import StatusBadge from '../components/StatusBadge';

export default function VideoPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getVideo(id)
      .then(setVideo)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load video'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRetry() {
    if (!id) return;
    setRetrying(true);
    try {
      const updated = await retryVideo(id);
      setVideo(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetrying(false);
    }
  }

  if (loading) return <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>;
  if (error) return <div className="container" style={{ padding: '2rem', color: '#721c24' }}>{error}</div>;
  if (!video) return <div className="container" style={{ padding: '2rem' }}>Video not found.</div>;

  return (
    <div className="container">
      {video.status === 'READY' && video.masterPlaylistUrl ? (
        <VideoPlayer src={video.masterPlaylistUrl} />
      ) : (
        <div
          style={{
            height: 400,
            background: '#f0f0f0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
            gap: '1rem',
          }}
        >
          {video.status === 'PROCESSING' && <p>This video is being processed. Check back soon.</p>}
          {video.status === 'UPLOADING' && <p>This video is still uploading.</p>}
          {video.status === 'UPLOADED' && <p>This video is queued for processing.</p>}
          {video.status === 'FAILED' && (
            <>
              <p style={{ color: '#721c24' }}>Processing failed.</p>
              <button
                onClick={handleRetry}
                disabled={retrying}
                className={`btn btn-danger ${retrying ? 'btn-disabled' : ''}`}
              >
                {retrying ? 'Retrying…' : 'Retry Processing'}
              </button>
            </>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0 }}>{video.title}</h2>
          <StatusBadge status={video.status} />
        </div>
        {video.description && <p style={{ color: '#64748b', marginTop: '0.75rem' }}>{video.description}</p>}
        <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <span>📅 {new Date(video.createdAt).toLocaleString()}</span>
          {video.fileSize && <span>💾 {(video.fileSize / 1_048_576).toFixed(1)} MB</span>}
        </div>
        {video.streams && video.streams.length > 0 && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.875rem' }}>
            <strong>Available resolutions:</strong>{' '}
            <span style={{ color: '#6366f1', fontWeight: 600 }}>
              {video.streams.map((s) => s.resolution).join(', ')}
            </span>
          </div>
        )}
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <Link to="/videos">← Back to Video Library</Link>
      </div>
    </div>
  );
}
