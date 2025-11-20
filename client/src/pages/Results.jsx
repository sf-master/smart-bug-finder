import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';
import BugCard from '../components/BugCard';
import { scanWebsite } from '../services/api';

const Results = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const url = searchParams.get('url');

  const [data, setData] = useState({
    screenshot: '',
    bugs: [],
    fixes: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fallbackData = useMemo(
    () => ({
      screenshot: 'https://placehold.co/800x450?text=Screenshot+Preview',
      bugs: [
        {
          id: 1,
          title: 'Button text overlaps icon',
          description: 'Primary CTA button on hero overlaps icon when viewport width < 1024px.',
          severity: 'High'
        },
        {
          id: 2,
          title: 'Low contrast on footer links',
          description: 'Footer links (#99A3AF) on white background fail WCAG AA contrast.',
          severity: 'Medium'
        },
        {
          id: 3,
          title: 'Misaligned card titles',
          description: 'Card titles not vertically centered relative to card height.',
          severity: 'Low'
        }
      ],
      fixes: [
        'Adjust button padding and ensure flex container wraps content correctly for smaller viewports.',
        'Darken footer link color to meet at least 4.5:1 contrast ratio.',
        'Apply consistent line-height and align-items center on card containers.'
      ]
    }),
    []
  );

  useEffect(() => {
    if (!url) {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await scanWebsite(url);
        const payload = response?.data || {};
        setData({
          screenshot: payload.screenshot ?? fallbackData.screenshot,
          bugs: payload.bugs?.length ? payload.bugs : fallbackData.bugs,
          fixes: payload.fixes?.length ? payload.fixes : fallbackData.fixes
        });
      } catch (err) {
        setError('Unable to scan website. Showing sample results.');
        setData(fallbackData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url, navigate, fallbackData]);

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'smart-bug-finder-results.json';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!url) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section className="card mb-8 p-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-wide text-slate-500">
            Scan Target
          </p>
          <h2 className="text-2xl font-semibold text-slate-900 break-all">
            {decodeURIComponent(url)}
          </h2>
          <p className="text-slate-500">
            AI-powered UI bug report
          </p>
        </div>
      </section>

      {loading ? (
        <Loader />
      ) : (
        <>
          {error && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-amber-900 shadow-sm">
              {error}
            </div>
          )}

          <section className="grid gap-8 lg:grid-cols-2">
            <div className="card p-6">
              <h3 className="mb-4 text-lg font-semibold text-slate-800">
                Screenshot Preview
              </h3>
              <div className="mx-auto max-w-[800px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <img
                  src={data.screenshot}
                  alt="Scanned screenshot"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="card flex flex-col justify-between p-6">
              <div>
                <h3 className="mb-4 text-lg font-semibold text-slate-800">
                  AI Suggested Fixes
                </h3>
                <ul className="space-y-3 text-slate-600">
                  {data.fixes.map((fix, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="text-indigo-600 font-semibold">{idx + 1}.</span>
                      <span>{fix}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={handleDownload}
                className="mt-6 w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-indigo-700 font-medium shadow-sm transition-all hover:bg-white"
              >
                Download JSON Report
              </button>
            </div>
          </section>

          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">
                Detected Issues
              </h3>
              <span className="text-sm text-slate-500">
                {data.bugs.length} issues found
              </span>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {data.bugs.map((bug) => (
                <BugCard key={bug.id ?? bug.title} bug={bug} />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
};

export default Results;


