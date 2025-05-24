
import { useUserBooks } from "@/hooks/useUserBooks";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

// Fallback demo data (unauthed, empty state)
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

export const useLibraryBooks = () => {
  const { user } = useAuth();
  const { data: userBooks, isLoading, error, refetch } = useUserBooks(user?.id);

  useEffect(() => {
    if (user?.id) refetch();
  }, [user?.id]);

  // If logged in and has books, show them; else dummy data
  const booksToShow = user && userBooks && userBooks.length > 0 ? userBooks : DUMMY_BOOKS;

  return {
    user,
    booksToShow,
    isLoading,
    error,
    refetch
  };
};
