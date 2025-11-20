const severityColors = {
  critical: 'bg-rose-100 text-rose-700 border-rose-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

const BugCard = ({ bug }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-md transition-all hover:shadow-lg">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-lg font-semibold text-slate-800">{bug.title}</h3>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide border ${severityColors[bug.severity?.toLowerCase()] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}
      >
        {bug.severity || 'Unknown'}
      </span>
    </div>
    <p className="text-sm text-slate-600">{bug.description}</p>
  </div>
);

export default BugCard;


