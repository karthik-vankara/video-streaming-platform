import { Routes, Route, Link } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import VideoListPage from './pages/VideoListPage';
import VideoPlayerPage from './pages/VideoPlayerPage';

function HomePage() {
  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '4rem 2rem',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1 style={{ 
        fontSize: '3.5rem',
        marginBottom: '1rem',
        background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }}>
        Video Streaming Platform
      </h1>
      <p style={{ 
        fontSize: '1.25rem', 
        color: 'rgba(255,255,255,0.9)', 
        marginBottom: '2.5rem',
        lineHeight: 1.6
      }}>
        Upload, process, and stream your videos with adaptive HLS playback.
        Multi-resolution transcoding powered by FFmpeg.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link 
          to="/upload" 
          className="btn btn-primary"
          style={{ fontSize: '1.125rem', padding: '1rem 2.5rem' }}
        >
          🎬 Upload Video
        </Link>
        <Link 
          to="/videos"
          className="btn"
          style={{ 
            fontSize: '1.125rem', 
            padding: '1rem 2.5rem',
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)',
            color: '#fff',
            border: '2px solid rgba(255,255,255,0.3)'
          }}
        >
          📺 Browse Library
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div>
      <nav style={{ 
        padding: '1rem 2rem',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <Link 
          to="/" 
          style={{ 
            fontWeight: 800,
            fontSize: '1.5rem',
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          🎥 VideoStream
        </Link>
        <div style={{ display: 'flex', gap: '1.5rem', marginLeft: 'auto' }}>
          <Link 
            to="/upload" 
            style={{ 
              fontWeight: 600,
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              transition: 'all 0.3s ease'
            }}
          >
            Upload
          </Link>
          <Link 
            to="/videos"
            style={{ 
              fontWeight: 600,
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              transition: 'all 0.3s ease'
            }}
          >
            Videos
          </Link>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/videos" element={<VideoListPage />} />
        <Route path="/videos/:id" element={<VideoPlayerPage />} />
      </Routes>
    </div>
  );
}
