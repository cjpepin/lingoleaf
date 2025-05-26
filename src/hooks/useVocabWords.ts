
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useVocabWords(folderId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch words for current folder or "All"
  const { data: words, isLoading } = useQuery({
    queryKey: ["vocab-words", user?.id, folderId ?? "all"],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase
        .from("vocab_words")
        .select("*")
        .eq("user_id", user.id);
      if (folderId) {
        q = q.eq("folder_id", folderId);
      } else {
        q = q.is("folder_id", null);
      }
      q = q.order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data as Array<{
        id: string;
        word: string;
        translation: string;
        context: string | null;
        created_at: string;
      }>;
    },
    enabled: !!user,
  });

  // Add new word 
  // For manual vocab entries, pass book_id="manual", book_title=null, and page_number=null
  async function addWord(word: string, translation: string, context: string | null) {
    if (!user) return;
    await supabase.from("vocab_words").insert({
      user_id: user.id,
      book_id: "manual",
      book_title: null,
      word,
      translation,
      context,
      page_number: null,
      folder_id: folderId || null,
    });
    queryClient.invalidateQueries({ queryKey: ["vocab-words", user?.id, folderId ?? "all"] });
  }

  // Remove a word
  async function removeWord(wordId: string) {
    if (!user) return;
    await supabase
      .from("vocab_words")
      .delete()
      .eq("id", wordId)
      .eq("user_id", user.id);
    queryClient.invalidateQueries({ queryKey: ["vocab-words", user?.id, folderId ?? "all"] });
  }

  // Update note/context
  async function updateNote(wordId: string, note: string) {
    if (!user) return;
    await supabase
      .from("vocab_words")
      .update({ context: note })
      .eq("id", wordId)
      .eq("user_id", user.id);
    queryClient.invalidateQueries({ queryKey: ["vocab-words", user?.id, folderId ?? "all"] });
  }

  return {
    words,
    loading: isLoading,
    addWord,
    removeWord,
    updateNote,
  };
}

