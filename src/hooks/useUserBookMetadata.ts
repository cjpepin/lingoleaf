
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook to manage per-user-per-book metadata (current page & highlights).
 */
export function useUserBookMetadata(bookId: string | undefined) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [metadataId, setMetadataId] = useState<string | null>(null);

  // Fetch (or create if doesn't exist) metadata for this book/user.
  useEffect(() => {
    if (!user?.id || !bookId) return;
    setLoading(true);
    supabase
      .from("user_book_metadata")
      .select("*")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (data) {
          setMetadataId(data.id);
          setCurrentPage(data.current_page ?? 1);
          // Safely parse highlights if string, else use as array
          let incomingHighlights = data.highlights;
          if (typeof incomingHighlights === "string") {
            try {
              incomingHighlights = JSON.parse(incomingHighlights);
            } catch (e) {
              incomingHighlights = [];
            }
          }
          setHighlights(Array.isArray(incomingHighlights) ? incomingHighlights : []);
        } else {
          // Create if missing
          const { data: insertData } = await supabase
            .from("user_book_metadata")
            .insert([{ user_id: user.id, book_id: bookId, current_page: 1, highlights: [] }])
            .select()
            .maybeSingle();
          setMetadataId(insertData?.id || null);
          setCurrentPage(1);
          setHighlights([]);
        }
        setLoading(false);
      });
  }, [bookId, user?.id]);

  // Save current page/highlights when they change
  const saveMetadata = useCallback(
    async (newPage: number, newHighlights: any[]) => {
      if (!metadataId) return;
      setCurrentPage(newPage);
      setHighlights(newHighlights);
      await supabase.from("user_book_metadata").update({
        current_page: newPage,
        highlights: newHighlights,
        updated_at: new Date().toISOString(),
      }).eq("id", metadataId);
    },
    [metadataId]
  );

  const updatePage = (page: number) => {
    setCurrentPage(page);
    saveMetadata(page, highlights);
  }

  const updateHighlights = (hl: any[]) => {
    setHighlights(hl);
    saveMetadata(currentPage, hl);
  };

  return {
    currentPage,
    highlights,
    updatePage,
    updateHighlights,
    loading,
    setCurrentPage,
    setHighlights // for internal use (e.g. initial restore)
  };
}
