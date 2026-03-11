import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createVideo, uploadFileToR2, completeUpload } from '../services/api';

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
const MAX_FILE_SIZE = 524_288_000; // 500 MB

export default function UploadPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (selected) {
      if (!ALLOWED_TYPES.includes(selected.type)) {
        setErrorMessage('Unsupported file type. Accepted: MP4, MOV, AVI, WebM.');
        setFile(null);
        return;
      }
      if (selected.size > MAX_FILE_SIZE) {
        setErrorMessage('File size exceeds maximum of 500 MB.');
        setFile(null);
        return;
      }
      setErrorMessage('');
    }
    setFile(selected);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus('uploading');
    setUploadProgress(0);
    setErrorMessage('');

    try {
      const video = await createVideo({
        title: title.trim(),
        description: description.trim() || undefined,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
      });

      await uploadFileToR2(video.uploadUrl!, file, setUploadProgress);
      await completeUpload(video.id);

      setStatus('success');
      setTimeout(() => navigate('/videos'), 1500);
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
  }

  const isSubmitting = status === 'uploading';

  return (
    <div className="container" style={{ maxWidth: 600 }}>
      <h1>Upload Video</h1>

      {status === 'success' && (
        <div className="alert alert-success">
          Upload complete! Redirecting to video list…
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-error">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="title" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
            Title *
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={255}
            disabled={isSubmitting}
            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="description" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            rows={4}
            disabled={isSubmitting}
            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="video-file" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
            Video File *
          </label>
          <input
            id="video-file"
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
            onChange={handleFileChange}
            disabled={isSubmitting}
          />
          <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 4 }}>
            Accepted formats: MP4, MOV, AVI, WebM. Max size: 500 MB.
          </div>
        </div>

        {uploadProgress !== null && status === 'uploading' && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ background: '#e9ecef', borderRadius: 4, overflow: 'hidden', height: 24 }}>
              <div
                style={{
                  width: `${uploadProgress}%`,
                  background: '#007bff',
                  height: '100%',
                  transition: 'width 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '0.8rem',
                }}
              >
                {uploadProgress}%
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !title.trim() || !file}
          className={`btn btn-primary ${isSubmitting || !title.trim() || !file ? 'btn-disabled' : ''}`}
        >
          {isSubmitting ? 'Uploading…' : 'Upload'}
        </button>
      </form>
    </div>
  );
}
