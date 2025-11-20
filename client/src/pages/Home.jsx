import UrlInput from '../components/UrlInput';

const Home = () => (
  <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col items-center justify-center px-6">
    <div className="card w-full max-w-2xl p-10 text-center">
      <p className="mb-3 text-sm uppercase tracking-widest text-indigo-500 font-semibold">
        AI-powered UI bug detection
      </p>
      <h1 className="text-4xl font-bold text-slate-900 mb-4">
        Smart Bug Finder
      </h1>
      <p className="text-slate-600 mb-8">
        Enter a website URL and let our AI scan for visual and accessibility issues within seconds.
      </p>
      <UrlInput />
    </div>
  </main>
);

export default Home;


