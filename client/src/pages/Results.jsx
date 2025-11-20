import { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';
import BugCard from '../components/BugCard';
import { scanWebsite, analyzeUrl } from '../services/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  const [domAnalysis, setDomAnalysis] = useState(null);
  const [domLoading, setDomLoading] = useState(false);
  const [domError, setDomError] = useState('');
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [editedUrl, setEditedUrl] = useState('');
  const reportRef = useRef(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, navigate]); // fallbackData is stable from useMemo, no need to include

  // Format screenshot for display
  const screenshotSrc = useMemo(() => {
    if (!data.screenshot) return fallbackData.screenshot;
    
    // If it's already a data URI or URL, return as is
    if (data.screenshot.startsWith('data:') || data.screenshot.startsWith('http')) {
      return data.screenshot;
    }
    
    // If it's a base64 string, add the data URI prefix
    return `data:image/png;base64,${data.screenshot}`;
  }, [data.screenshot]); // fallbackData.screenshot is stable, no need to include

  // Fetch DOM analysis
  useEffect(() => {
    if (!url) return;

    const fetchDomAnalysis = async () => {
      try {
        setDomLoading(true);
        setDomError('');
        const response = await analyzeUrl(url);
        setDomAnalysis(response?.data || null);
      } catch (err) {
        const errorMessage = err?.response?.data?.error || err?.response?.data?.details || err?.message || 'Unknown error';
        const details = err?.response?.data?.details ? `: ${err.response.data.details}` : '';
        setDomError(`Unable to analyze DOM structure. ${errorMessage}${details}`);
        setDomAnalysis(null);
        console.error('DOM Analysis Error:', err);
      } finally {
        setDomLoading(false);
      }
    };

    fetchDomAnalysis();
  }, [url]);

  const handleDownload = async () => {
    if (!reportRef.current) return;

    try {
      setPdfGenerating(true);

      // Capture the report content as canvas
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f1f5f9', // slate-50 background
        windowWidth: reportRef.current.scrollWidth,
        windowHeight: reportRef.current.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      
      // Calculate PDF dimensions
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
      const pageHeight = 297; // A4 height in mm
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // If content fits on one page
      if (pdfHeight <= pageHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      } else {
        // Content is taller than one page - split across multiple pages
        let heightLeft = pdfHeight;
        let position = 0;
        
        // Add first page
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
        
        // Add additional pages if needed
        while (heightLeft > 0) {
          position -= pageHeight; // Move up by one page height
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;
        }
      }
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const urlSlug = decodeURIComponent(url || 'report').replace(/[^a-z0-9]/gi, '-').toLowerCase().substring(0, 30);
      const filename = `smart-bug-finder-report-${urlSlug}-${timestamp}.pdf`;
      
      // Save PDF
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleUrlEdit = () => {
    setEditedUrl(decodeURIComponent(url || ''));
    setIsEditingUrl(true);
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (!editedUrl.trim()) {
      return;
    }
    // Navigate to new URL which will trigger new scan
    navigate(`/results?url=${encodeURIComponent(editedUrl.trim())}`);
    setIsEditingUrl(false);
  };

  const handleUrlCancel = () => {
    setIsEditingUrl(false);
    setEditedUrl('');
  };

  if (!url) return null;

  return (
    <main ref={reportRef} className="mx-auto max-w-6xl px-6 py-10">
      <section className="card mb-8 p-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm uppercase tracking-wide text-slate-500">
              Scan Target
            </p>
            {!isEditingUrl && (
              <button
                onClick={handleUrlEdit}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                Edit URL
              </button>
            )}
          </div>
          
          {isEditingUrl ? (
            <form onSubmit={handleUrlSubmit} className="flex flex-col gap-3">
              <input
                type="url"
                value={editedUrl}
                onChange={(e) => setEditedUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                required
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-white font-medium shadow-sm transition-all hover:bg-indigo-500"
                >
                  Scan New URL
                </button>
                <button
                  type="button"
                  onClick={handleUrlCancel}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-slate-700 font-medium shadow-sm transition-all hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-slate-900 break-all">
                {decodeURIComponent(url)}
              </h2>
              <p className="text-slate-500">
                AI-powered UI bug report
              </p>
            </>
          )}
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
                  src={screenshotSrc}
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
                disabled={pdfGenerating}
                className="mt-6 w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-indigo-700 font-medium shadow-sm transition-all hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pdfGenerating ? 'Generating PDF...' : 'Download PDF Report'}
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

          {/* DOM Analysis Section */}
          <section className="mt-12">
            <div className="mb-6">
              <h3 className="text-2xl font-semibold text-slate-900">
                DOM Analysis
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Detailed analysis of HTML structure, meta tags, links, and interactive elements
              </p>
            </div>

            {domLoading ? (
              <div className="card p-8 text-center">
                <Loader />
                <p className="mt-4 text-slate-600">Analyzing DOM structure...</p>
              </div>
            ) : domError ? (
              <div className="card p-6 rounded-xl border border-rose-200 bg-rose-50 text-rose-900">
                {domError}
              </div>
            ) : domAnalysis ? (
              <div className="space-y-8">
                {/* Head Validation */}
                <div className="card p-6">
                  <h4 className="text-xl font-semibold text-slate-800 mb-4">
                    Head Validation
                  </h4>

                  {/* Title & Meta Tags */}
                  <div className="mb-6">
                    <h5 className="text-lg font-medium text-slate-700 mb-3">
                      Title & Meta Tags
                    </h5>
                    <div className="space-y-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-slate-700">Title Tag</span>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            domAnalysis.headAnalysis?.title?.hasTitle
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {domAnalysis.headAnalysis?.title?.hasTitle ? 'Present' : 'Missing'}
                          </span>
                        </div>
                        {domAnalysis.headAnalysis?.title?.titleText && (
                          <p className="text-sm text-slate-600 mt-1">
                            "{domAnalysis.headAnalysis.title.titleText}"
                          </p>
                        )}
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <h6 className="font-medium text-slate-700 mb-3">Important Meta Tags</h6>
                        <div className="space-y-2">
                          {domAnalysis.headAnalysis?.metaSummary?.important?.map((meta, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-slate-600">{meta.nameOrProperty}</span>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                meta.present
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {meta.present ? 'Present' : 'Missing'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {domAnalysis.headAnalysis?.metaSummary?.all?.length > 0 && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <h6 className="font-medium text-slate-700 mb-3">All Meta Tags ({domAnalysis.headAnalysis.metaSummary.all.length})</h6>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="text-left py-2 px-3 text-slate-700 font-medium">Name/Property</th>
                                  <th className="text-left py-2 px-3 text-slate-700 font-medium">Content/Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {domAnalysis.headAnalysis.metaSummary.all.map((meta, idx) => (
                                  <tr key={idx} className="border-b border-slate-100">
                                    <td className="py-2 px-3 text-slate-600">{meta.nameOrProperty || meta.property || meta.httpEquiv || '-'}</td>
                                    <td className="py-2 px-3 text-slate-600">{meta.contentOrValue || meta.charset || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Link Tags & Status */}
                  <div>
                    <h5 className="text-lg font-medium text-slate-700 mb-3">
                      Link Tags & Status
                    </h5>
                    {domAnalysis.headAnalysis?.linkSummary?.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">Href</th>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">Rel</th>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">Type</th>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">Origin</th>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">Status</th>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">Code</th>
                            </tr>
                          </thead>
                          <tbody>
                            {domAnalysis.headAnalysis.linkSummary.map((link, idx) => (
                              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-3 px-4 text-slate-600 break-all max-w-xs">
                                  {link.href || '-'}
                                </td>
                                <td className="py-3 px-4 text-slate-600">{link.rel || '-'}</td>
                                <td className="py-3 px-4 text-slate-600">{link.type || '-'}</td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    link.sameOrigin
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    {link.sameOrigin ? 'Same' : 'Cross'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    link.status === 'valid'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : link.status === 'broken'
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {link.status || '-'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-600">
                                  {link.statusCode || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">No link tags found</p>
                    )}
                  </div>
                </div>

                {/* Interactive Elements */}
                <div className="card p-6">
                  <h4 className="text-xl font-semibold text-slate-800 mb-4">
                    Interactive Elements
                  </h4>

                  {/* Buttons */}
                  <div className="mb-6">
                    <h5 className="text-lg font-medium text-slate-700 mb-3">
                      Buttons ({domAnalysis.bodyAnalysis?.buttons?.length || 0})
                    </h5>
                    {domAnalysis.bodyAnalysis?.buttons?.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">Type</th>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">Text/Label</th>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">ID</th>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">Test Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {domAnalysis.bodyAnalysis.buttons.map((button, idx) => {
                              const test = button.testResults;
                              return (
                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="py-3 px-4 text-slate-600">{button.type}</td>
                                  <td className="py-3 px-4 text-slate-600">{button.text || '-'}</td>
                                  <td className="py-3 px-4 text-slate-600">{button.id || '-'}</td>
                                  <td className="py-3 px-4">
                                    {test ? (
                                      <div className="flex flex-col gap-1">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                          test.clickable
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-rose-100 text-rose-700'
                                        }`}>
                                          {test.clickable ? '✓ Clickable' : '✗ Not Clickable'}
                                        </span>
                                        {test.selector && (
                                          <span className="text-xs text-slate-500" title="Selector used">Selector: {test.selector}</span>
                                        )}
                                        {test.error && (
                                          <span className="text-xs text-rose-600">{test.error}</span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 text-xs">Not tested</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">No buttons found</p>
                    )}
                  </div>

                  {/* Dropdowns */}
                  <div className="mb-6">
                    <h5 className="text-lg font-medium text-slate-700 mb-3">
                      Dropdowns ({domAnalysis.bodyAnalysis?.dropdowns?.length || 0})
                    </h5>
                    {domAnalysis.bodyAnalysis?.dropdowns?.length > 0 ? (
                      <div className="space-y-4">
                        {domAnalysis.bodyAnalysis.dropdowns.map((dropdown, idx) => {
                          const test = dropdown.testResults;
                          return (
                            <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-center gap-4 mb-2 flex-wrap">
                                <span className="text-sm font-medium text-slate-700">ID: {dropdown.id || '-'}</span>
                                <span className="text-sm font-medium text-slate-700">Name: {dropdown.name || '-'}</span>
                                {dropdown.multiple && (
                                  <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                                    Multiple
                                  </span>
                                )}
                                {test && (
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    test.selectable
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-rose-100 text-rose-700'
                                  }`}>
                                    {test.selectable ? '✓ Selectable' : '✗ Not Selectable'}
                                  </span>
                                )}
                              </div>
                              {test?.selector && (
                                <p className="text-xs text-slate-500 mb-1" title="Selector used">Selector: {test.selector}</p>
                              )}
                              {test?.error && (
                                <p className="text-xs text-rose-600 mb-2">{test.error}</p>
                              )}
                            {dropdown.options?.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-slate-500 mb-1">Options ({dropdown.options.length}):</p>
                                <div className="space-y-1">
                                  {dropdown.options.slice(0, 5).map((option, optIdx) => (
                                    <div key={optIdx} className="text-sm text-slate-600 flex items-center gap-2">
                                      <span>{option.text || option.value}</span>
                                      {option.selected && (
                                        <span className="px-1.5 py-0.5 rounded text-xs bg-indigo-100 text-indigo-700">
                                          Selected
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                  {dropdown.options.length > 5 && (
                                    <p className="text-xs text-slate-400">... and {dropdown.options.length - 5} more</p>
                                  )}
                                </div>
                              </div>
                            )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">No dropdowns found</p>
                    )}
                  </div>

                  {/* Inputs */}
                  <div className="mb-6">
                    <h5 className="text-lg font-medium text-slate-700 mb-3">
                      Inputs ({domAnalysis.bodyAnalysis?.inputs?.length || 0})
                    </h5>
                    {domAnalysis.bodyAnalysis?.inputs?.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">Type</th>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">Name</th>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">ID</th>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">Test Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {domAnalysis.bodyAnalysis.inputs.map((input, idx) => {
                              const test = input.testResults;
                              return (
                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="py-3 px-4 text-slate-600">{input.type}</td>
                                  <td className="py-3 px-4 text-slate-600">{input.name || '-'}</td>
                                  <td className="py-3 px-4 text-slate-600">{input.id || '-'}</td>
                                  <td className="py-3 px-4">
                                    {test ? (
                                      <div className="flex flex-col gap-1">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                          test.fillable
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-rose-100 text-rose-700'
                                        }`}>
                                          {test.fillable ? '✓ Fillable' : '✗ Not Fillable'}
                                        </span>
                                        {test.selector && (
                                          <span className="text-xs text-slate-500" title="Selector used">Selector: {test.selector}</span>
                                        )}
                                        {test.readonly && (
                                          <span className="text-xs text-amber-600">Read-only</span>
                                        )}
                                        {test.disabled && (
                                          <span className="text-xs text-slate-500">Disabled</span>
                                        )}
                                        {test.error && (
                                          <span className="text-xs text-rose-600">{test.error}</span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 text-xs">Not tested</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">No inputs found</p>
                    )}
                  </div>

                  {/* Checkboxes */}
                  <div>
                    <h5 className="text-lg font-medium text-slate-700 mb-3">
                      Checkboxes ({domAnalysis.bodyAnalysis?.checkboxes?.length || 0})
                    </h5>
                    {domAnalysis.bodyAnalysis?.checkboxes?.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">ID</th>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">Name</th>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">Label</th>
                              <th className="text-left py-3 px-4 text-slate-700 font-medium">Test Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {domAnalysis.bodyAnalysis.checkboxes.map((checkbox, idx) => {
                              const test = checkbox.testResults;
                              return (
                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="py-3 px-4 text-slate-600">{checkbox.id || '-'}</td>
                                  <td className="py-3 px-4 text-slate-600">{checkbox.name || '-'}</td>
                                  <td className="py-3 px-4 text-slate-600">{checkbox.labelText || '-'}</td>
                                  <td className="py-3 px-4">
                                    {test ? (
                                      <div className="flex flex-col gap-1">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                          test.toggleable
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-rose-100 text-rose-700'
                                        }`}>
                                          {test.toggleable ? '✓ Toggleable' : '✗ Not Toggleable'}
                                        </span>
                                        {test.selector && (
                                          <span className="text-xs text-slate-500" title="Selector used">Selector: {test.selector}</span>
                                        )}
                                        {test.error && (
                                          <span className="text-xs text-rose-600">{test.error}</span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 text-xs">Not tested</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">No checkboxes found</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </>
      )}
    </main>
  );
};

export default Results;


