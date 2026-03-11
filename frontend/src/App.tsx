import { Routes, Route, Link } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import VideoListPage from './pages/VideoListPage';
import VideoPlayerPage from './pages/VideoPlayerPage';

function HomePage() {
  return (
    <div style={{ textAlign: 'center', marginTop: '3rem' }}>
      <h1>Video Streaming Platform</h1>
      <nav style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <Link to="/upload">Upload Video</Link>
        <Link to="/videos">Browse Videos</Link>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <div>
      <nav style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #ddd', display: 'flex', gap: '1rem' }}>
        <Link to="/" style={{ fontWeight: 700, textDecoration: 'none' }}>VideoStream</Link>
        <Link to="/upload">Upload</Link>
        <Link to="/videos">Videos</Link>
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
