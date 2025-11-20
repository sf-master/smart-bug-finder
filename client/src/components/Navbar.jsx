import { Link } from 'react-router-dom';

const Navbar = () => (
  <header className="bg-white shadow-sm border-b border-slate-100">
    <div className="mx-auto flex h-16 max-w-6xl items-center px-6">
      <Link to="/" className="text-2xl font-semibold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer">
        Smart Bug Finder
      </Link>
    </div>
  </header>
);

export default Navbar;


