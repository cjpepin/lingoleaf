
import Navbar from "@/components/Navbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const DUMMY_BOOKS = [
  {
    id: "1",
    title: "French for Beginners",
    author: "Marie Dubois",
    cover: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=cover&w=400&q=80"
  },
  {
    id: "2",
    title: "Learn Spanish Fast",
    author: "Carlos Garcia",
    cover: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=cover&w=400&q=80"
  },
  {
    id: "3",
    title: "Mandarin Tales",
    author: "Sun Yan",
    cover: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=cover&w=400&q=80"
  }
];

const Library = () => {
  const navigate = useNavigate();
  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Navbar authenticated={false} />
      <main className="max-w-5xl mx-auto py-8 px-4">
        <h2 className="text-3xl font-bold text-green-800 mb-6">Library</h2>
        <div className="grid md:grid-cols-3 gap-7">
          {DUMMY_BOOKS.map((book) => (
            <Card key={book.id} className="hover-scale transition">
              <div
                onClick={() => navigate(`/read/${book.id}`)}
                className="cursor-pointer"
              >
                <img
                  src={book.cover || "https://placehold.co/400x520?text=Book+Cover"}
                  alt=""
                  className="w-full h-52 object-cover rounded-t-lg"
                />
                <CardHeader>
                  <CardTitle className="text-green-900 text-lg">{book.title}</CardTitle>
                  <div className="text-sm text-gray-500">{book.author}</div>
                </CardHeader>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Library;

