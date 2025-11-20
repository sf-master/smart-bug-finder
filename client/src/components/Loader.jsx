const Loader = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
    <p className="text-lg font-medium text-slate-700">
      Scanning... Please wait
    </p>
  </div>
);

export default Loader;


