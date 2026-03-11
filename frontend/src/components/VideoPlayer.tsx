import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  src: string;
}

export default function VideoPlayer({ src }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error — unable to load video.');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError('Unable to play this video.');
              hls.destroy();
              break;
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      const handleError = () => setError('Unable to play this video.');
      video.addEventListener('error', handleError);
      return () => video.removeEventListener('error', handleError);
    } else {
      setError('HLS playback is not supported in this browser.');
    }
  }, [src]);

  if (error) {
    return (
      <div style={{ padding: '2rem', background: '#f8d7da', color: '#721c24', borderRadius: 4, textAlign: 'center' }}>
        {error}
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      controls
      style={{ width: '100%', maxHeight: '70vh', background: '#000', borderRadius: 4 }}
    />
  );
}
