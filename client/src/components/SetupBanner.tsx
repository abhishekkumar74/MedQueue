import { AlertTriangle } from 'lucide-react';

export default function SetupBanner() {
  return (
    <div className="min-h-screen bg-[#E8F3FF] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-amber-200 p-8 max-w-lg w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Supabase Setup Required</h2>
        </div>

        <p className="text-gray-600 text-sm mb-5">
          The app needs your Supabase project credentials to connect to the database.
          Create a <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">.env</code> file
          in the project root with the following variables:
        </p>

        <div className="bg-gray-900 rounded-xl p-4 mb-5 font-mono text-sm text-green-400 overflow-x-auto">
          <div className="text-gray-500 mb-1"># .env</div>
          <div>VITE_SUPABASE_URL=https://your-project.supabase.co</div>
          <div>VITE_SUPABASE_ANON_KEY=your-anon-key</div>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <p className="font-semibold text-gray-700">Where to find these values:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-600">
            <li>Go to <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-[#005EB8] underline">supabase.com/dashboard</a></li>
            <li>Open your project → <strong>Settings → API</strong></li>
            <li>Copy the <strong>Project URL</strong> and <strong>anon public</strong> key</li>
            <li>Paste them into your <code className="bg-gray-100 px-1 rounded font-mono text-xs">.env</code> file and restart the dev server</li>
          </ol>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100 text-xs text-gray-400">
          After adding the .env file, run <code className="bg-gray-100 px-1 rounded font-mono">npm run dev</code> again.
        </div>
      </div>
    </div>
  );
}
