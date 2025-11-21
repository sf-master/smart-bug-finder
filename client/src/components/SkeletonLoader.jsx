const SkeletonLoader = () => {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 animate-pulse">
      {/* Scan Target Section Skeleton */}
      <section className="card mb-8 p-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="h-4 w-20 rounded bg-slate-200" />
          </div>
          <div className="h-8 w-2/3 rounded bg-slate-300" />
          <div className="h-4 w-1/4 rounded bg-slate-200" />
        </div>
      </section>

      {/* Screenshot and Fixes Section Skeleton */}
      <section className="grid gap-8 lg:grid-cols-2">
        <div className="card p-6">
          <div className="h-6 w-1/2 rounded bg-slate-200 mb-4" />
          <div className="mx-auto max-w-[800px] h-96 rounded-2xl bg-slate-300" />
        </div>

        <div className="card flex flex-col justify-between p-6">
          <div>
            <div className="h-6 w-1/2 rounded bg-slate-200 mb-4" />
            <ul className="space-y-3">
              <li className="h-4 w-full rounded bg-slate-200" />
              <li className="h-4 w-full rounded bg-slate-200" />
              <li className="h-4 w-3/4 rounded bg-slate-200" />
            </ul>
          </div>
          <div className="h-12 w-full rounded-xl bg-slate-300 mt-6" />
        </div>
      </section>

      {/* AI Detected Issues Section Skeleton */}
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-6 w-1/3 rounded bg-slate-200" />
          <div className="h-4 w-1/6 rounded bg-slate-200" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="h-5 w-3/4 rounded bg-slate-200 mb-2" />
              <div className="h-4 w-full rounded bg-slate-200 mb-1" />
              <div className="h-4 w-5/6 rounded bg-slate-200" />
              <div className="h-4 w-1/3 rounded bg-slate-200 mt-4" />
            </div>
          ))}
        </div>
      </section>

      {/* DOM Analysis Section Skeleton */}
      <section className="mt-12">
        <div className="mb-6">
          <div className="h-7 w-1/4 rounded bg-slate-200" />
          <div className="h-4 w-1/2 rounded bg-slate-200 mt-2" />
        </div>

        <div className="space-y-8">
          {/* Head Validation Skeleton */}
          <div className="card p-6">
            <div className="h-6 w-1/3 rounded bg-slate-200 mb-4" />
            <div className="h-5 w-full rounded bg-slate-200 mb-3" />
            <div className="h-5 w-full rounded bg-slate-200 mb-3" />
            <div className="h-5 w-full rounded bg-slate-200" />
          </div>

          {/* Interactive Elements Skeleton */}
          <div className="card p-6">
            <div className="h-6 w-1/3 rounded bg-slate-200 mb-4" />
            <div className="h-5 w-full rounded bg-slate-200 mb-3" />
            <div className="h-5 w-full rounded bg-slate-200 mb-3" />
            <div className="h-5 w-full rounded bg-slate-200" />
          </div>
        </div>
      </section>
    </main>
  );
};

export default SkeletonLoader;