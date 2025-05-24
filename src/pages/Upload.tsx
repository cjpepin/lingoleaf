
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { useState } from "react";

const Upload = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    file: undefined as File | undefined,
    image: undefined as File | undefined,
    notes: "",
  });
  const [uploading, setUploading] = useState(false);

  // While auth state is loading, display loading UI
  if (authLoading) {
    return (
      <div className="bg-[#f8fafc] min-h-screen">
        <Navbar authenticated={false} />
        <main className="max-w-2xl mx-auto py-20 px-4 text-center">
          <h2 className="text-2xl font-bold mb-6 text-green-800">Loading...</h2>
        </main>
      </div>
    );
  }

  // Block upload for unauthenticated users
  if (!user) {
    return (
      <div className="bg-[#f8fafc] min-h-screen">
        <Navbar authenticated={false} />
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

  // Handle upload form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    // Simulate a fake upload process (replace with Supabase upload in future)
    if (!form.title || !form.file) {
      toast({
        title: "Upload Failed",
        description: "Please fill out the book title and select a book file.",
        variant: "destructive",
      });
      setUploading(false);
      return;
    }
    setTimeout(() => {
      setUploading(false);
      toast({
        title: "Upload Successful",
        description: "Your book was uploaded! (Simulation)",
      });
      setForm({
        title: "",
        file: undefined,
        image: undefined,
        notes: "",
      });
    }, 1100);
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Navbar authenticated={true} />
      <main className="max-w-2xl mx-auto py-20 px-4">
        <h2 className="text-2xl font-bold mb-6 text-green-800">Upload a Book</h2>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              id="title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
              disabled={uploading}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="file" className="block text-sm font-medium text-gray-700">
              Book File <span className="text-red-500">*</span>
            </label>
            <Input
              type="file"
              id="file"
              accept=".pdf,.epub,.txt"
              onChange={e => setForm(f => ({
                ...f,
                file: e.target.files ? e.target.files[0] : undefined,
              }))}
              required
              disabled={uploading}
              className="mt-1"
            />
            <div className="text-xs text-gray-400 mt-1">
              Supported formats: PDF, EPUB, TXT
            </div>
          </div>
          <div>
            <label htmlFor="image" className="block text-sm font-medium text-gray-700">
              Cover Image (optional)
            </label>
            <Input
              type="file"
              id="image"
              accept="image/*"
              onChange={e => setForm(f => ({
                ...f,
                image: e.target.files ? e.target.files[0] : undefined,
              }))}
              disabled={uploading}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
              disabled={uploading}
            />
          </div>
          <Button size="lg" type="submit" disabled={uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default Upload;

