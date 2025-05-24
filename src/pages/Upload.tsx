import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Upload = () => {
  // This should be replaced with real auth logic
  const authenticated = false;
  const navigate = useNavigate();

  if (!authenticated) {
    return (
      <div className="bg-[#f8fafc] min-h-screen">
        <Navbar authenticated={authenticated} />
        <main className="max-w-2xl mx-auto py-20 px-4 text-center">
          <h2 className="text-2xl font-bold mb-6 text-green-800">
            Upload a Book
          </h2>
          <p className="mb-6 text-lg text-gray-700">
            Sign in or create an account to upload your own books.
          </p>
          <Button size="lg" onClick={() => navigate("/account")}>
            Sign In / Create Account
          </Button>
        </main>
      </div>
    );
  }

  // Upload form UI will go here (phase 1C, after auth)
  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Navbar authenticated={authenticated} />
      <main className="max-w-2xl mx-auto py-20 px-4">
        <h2 className="text-2xl font-bold mb-6 text-green-800">Upload a Book</h2>
        <form className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              type="text"
              id="title"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="file" className="block text-sm font-medium text-gray-700">
              Book File
            </label>
            <input
              type="file"
              id="file"
              className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
          </div>
          <div>
            <label htmlFor="image" className="block text-sm font-medium text-gray-700">
              Cover Image (optional)
            </label>
            <input
              type="file"
              id="image"
              className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
            />
          </div>
          <Button size="lg" type="submit">
            Upload
          </Button>
        </form>
      </main>
    </div>
  );
};

export default Upload;
