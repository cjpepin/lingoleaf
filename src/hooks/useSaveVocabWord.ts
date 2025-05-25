
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type SaveVocabParams = {
  word: string;
  translation: string;
  bookId: string;
  bookTitle?: string;
  context?: string;
  pageNumber?: number;
  folderId?: string | null;
};

export function useSaveVocabWord() {
  const [saving, setSaving] = useState(false);
  const [savingDone, setSavingDone] = useState(false);
  const { user } = useAuth();

  const save = async ({
    word, translation, bookId, bookTitle, context, pageNumber, folderId
  }: SaveVocabParams) => {
    if (!user) return false;
    setSaving(true);
    setSavingDone(false);
    const { error } = await supabase.from("vocab_words").insert({
      book_id: bookId,
      book_title: bookTitle ?? null,
      word,
      translation,
      context,
      page_number: pageNumber,
      user_id: user.id,
      folder_id: folderId ?? null,
    });
    setSaving(false);
    setSavingDone(!error);
    return !error;
  };

  return { save, saving, savingDone };
}
