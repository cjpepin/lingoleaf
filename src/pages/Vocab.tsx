
import Navbar from "@/components/Navbar";
import VocabFolders from "@/components/vocab/VocabFolders";
import { useAuth } from "@/hooks/useAuth";

const Vocab = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-[#f8fafc] min-h-screen">
        <Navbar authenticated={false} />
        <main className="max-w-xl mx-auto py-20 px-4 text-center">
          <h2 className="text-2xl font-bold mb-6 text-green-800">
            Your Vocabulary
          </h2>
          <p className="mb-6 text-lg text-gray-700">
            Please sign in to access your vocabulary lists.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Navbar authenticated={true} />
      <main className="max-w-3xl mx-auto py-10 px-4">
        <h2 className="text-2xl font-bold mb-2 text-green-900">Vocabulary Manager</h2>
        <p className="mb-6 text-gray-600">Organize and review your vocabulary by folders. Free users: 3 folders max.</p>
        <VocabFolders />
      </main>
    </div>
  );
};

export default Vocab;
