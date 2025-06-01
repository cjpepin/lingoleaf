
import Navbar from "@/components/Navbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import UpgradeCTA from "@/components/UpgradeCTA";
import UpgradeModal from "@/components/UpgradeModal";
import { useAuth } from "@/hooks/useAuth";
import { useLibraryBooks } from "@/hooks/useLibraryBooks";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const isAuthenticated = user !== null && !authLoading;
  const {
    libraryBooks,
    isLoading,
    error,
    refetch
  } = useLibraryBooks();
  const booksToShow = libraryBooks?.length > 0 ? libraryBooks : [];

  return (
    <div className="bg-[#F3F6F4] min-h-screen">
      <Navbar authenticated={isAuthenticated} />
      <UpgradeModal />
      <main className="max-w-5xl mx-auto py-8 px-4">
        
        {/* Hero section */}
        <div className="flex flex-col md:flex-row items-center md:gap-12 gap-8 pb-8">
          <div className="flex-1 text-center md:text-left">
            <h2 className="mt-7 text-4xl font-semibold text-green-700 mb-2">
              Grow your language skills with real books
            </h2>
            <p className="text-lg text-gray-700 max-w-xl mb-5">
              Upload your own books or explore our library. Highlight unfamiliar words, 
              get translations, and save vocabulary—right as you read.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <Button
                size="lg"
                onClick={() => (isAuthenticated ? navigate("/upload") : navigate("/account"))}
              >
                {isAuthenticated ? "Upload a Book" : "Sign In to Upload"}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate("/library")}
              >
                Explore Library
              </Button>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-4 items-center">
            <img
              src="https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=cover&w=380&q=80"
              alt="Book Reading"
              className="rounded-xl shadow-lg w-full max-w-xs object-cover"
            />
          </div>
        </div>

        <UpgradeCTA className="max-w-2xl mx-auto mt-5" />

        {/* Featured books section */}
        <section className="pt-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-green-800">
              Library Highlights
            </h3>
            <Button
              variant="ghost"
              onClick={() => navigate("/library")}
              className="text-green-700"
            >
              See all &rarr;
            </Button>
          </div>
          <div className="grid md:grid-cols-3 gap-7">
            {booksToShow.map((book) => (
              <Card key={book.id} className="hover-scale transition cursor-pointer">
                <div onClick={() => navigate(`/read/${book.id}`)}>
                  <img
                    src={book.cover_image_url || "https://placehold.co/400x520?text=Book+Cover"}
                    alt={book.title}
                    className="w-full h-52 object-cover rounded-t-lg"
                  />
                  <CardHeader>
                    <CardTitle className="text-green-900 text-lg">{book.title}</CardTitle>
                    {/* <div className="text-sm text-gray-500">{book.author}</div> */}
                  </CardHeader>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
