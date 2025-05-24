import Navbar from "@/components/Navbar";

const Vocab = () => {
  // Gated section (should check real auth, but hardcoded for now)
  const authenticated = false;

  if (!authenticated) {
    return (
      <div className="bg-[#f8fafc] min-h-screen">
        <Navbar authenticated={authenticated} />
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

  // Vocab management UI will go here
  return (
    <div>
      {/* ... keep existing code (Vocab management for authenticated users) ... */}
    </div>
  );
};

export default Vocab;
