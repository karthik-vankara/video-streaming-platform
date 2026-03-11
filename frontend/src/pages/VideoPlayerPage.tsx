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

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>;
  if (error) return <div style={{ padding: '2rem', color: '#721c24' }}>{error}</div>;
  if (!video) return <div style={{ padding: '2rem' }}>Video not found.</div>;

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1rem' }}>
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
                style={{
                  padding: '0.5rem 1.5rem',
                  background: '#dc3545',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: retrying ? 'not-allowed' : 'pointer',
                }}
              >
                {retrying ? 'Retrying…' : 'Retry Processing'}
              </button>
            </>
          )}
        </div>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h1 style={{ margin: 0 }}>{video.title}</h1>
          <StatusBadge status={video.status} />
        </div>
        {video.description && <p style={{ color: '#555' }}>{video.description}</p>}
        <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.5rem' }}>
          Uploaded {new Date(video.createdAt).toLocaleString()}
          {video.fileSize && <> · {(video.fileSize / 1_048_576).toFixed(1)} MB</>}
        </div>
        {video.streams && video.streams.length > 0 && (
          <div style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
            <strong>Available streams:</strong>{' '}
            {video.streams.map((s) => s.resolution).join(', ')}
          </div>
        )}
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <Link to="/videos">← Back to Video Library</Link>
      </div>
    </div>
  );
}
