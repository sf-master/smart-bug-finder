import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const UrlInput = () => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please enter a valid URL.');
      return;
    }
    setError('');
    const encoded = encodeURIComponent(url.trim());
    navigate(`/results?url=${encoded}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="url" className="block text-sm font-medium text-slate-600 mb-2">
          Website URL
        </label>
        <input
          id="url"
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          required
        />
        {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
      </div>
      <button
        type="submit"
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-white font-medium shadow-md transition-all hover:bg-indigo-500 hover:shadow-lg"
      >
        Scan Now
      </button>
    </form>
  );
};

export default UrlInput;


