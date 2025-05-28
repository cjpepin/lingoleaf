
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook to manage per-user-per-book metadata (current page & highlights).
 * Automatically creates metadata record if it doesn't exist.
 */
export function useUserBookMetadata(bookId: string | undefined) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [metadataId, setMetadataId] = useState<string | null>(null);

  // Fetch (or create if doesn't exist) metadata for this book/user combination
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
          // Load existing metadata
          setMetadataId(data.id);
          setCurrentPage(data.current_page ?? 1);
          
          // Parse highlights safely - handle both string and array formats
          let incomingHighlights = data.highlights;
          if (typeof incomingHighlights === "string") {
            try {
              incomingHighlights = JSON.parse(incomingHighlights);
            } catch (e) {
              console.warn("Failed to parse highlights JSON:", e);
              incomingHighlights = [];
            }
          }
          setHighlights(Array.isArray(incomingHighlights) ? incomingHighlights : []);
        } else {
          // Create new metadata record for this user/book combination
          const { data: insertData } = await supabase
            .from("user_book_metadata")
            .insert([{ 
              user_id: user.id, 
              book_id: bookId, 
              current_page: 1, 
              highlights: [] 
            }])
            .select()
            .maybeSingle();
            
          setMetadataId(insertData?.id || null);
          setCurrentPage(1);
          setHighlights([]);
        }
        setLoading(false);
      });
  }, [bookId, user?.id]);

  /**
   * Save metadata to database when page or highlights change
   */
  const saveMetadata = useCallback(
    async (newPage: number, newHighlights: any[]) => {
      if (!metadataId) return;
      
      // Update local state immediately for responsive UI
      setCurrentPage(newPage);
      setHighlights(newHighlights);
      
      // Persist to database
      await supabase.from("user_book_metadata").update({
        current_page: newPage,
        highlights: newHighlights,
        updated_at: new Date().toISOString(),
      }).eq("id", metadataId);
    },
    [metadataId]
  );

  // Helper functions to update specific metadata
  const updatePage = (page: number) => {
    saveMetadata(page, highlights);
  };

  const updateHighlights = (hl: any[]) => {
    saveMetadata(currentPage, hl);
  };

  return {
    currentPage,
    highlights,
    updatePage,
    updateHighlights,
    loading,
    // Internal setters for initial data loading
    setCurrentPage,
    setHighlights
  };
}
