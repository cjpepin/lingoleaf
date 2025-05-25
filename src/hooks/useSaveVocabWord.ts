
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type SaveVocabParams = {
  word: string;
  translation: string;
  bookId: string;
  bookTitle?: string;
  context?: string;
  pageNumber?: number;
};

export function useSaveVocabWord() {
  const [saving, setSaving] = useState(false);
  const [savingDone, setSavingDone] = useState(false);

  const save = async ({
    word, translation, bookId, bookTitle, context, pageNumber
  }: SaveVocabParams) => {
    setSaving(true);
    setSavingDone(false);
    const { error } = await supabase.from("vocab_words").insert({
      book_id: bookId,
      book_title: bookTitle,
      word,
      translation,
      context,
      page_number: pageNumber,
    });
    setSaving(false);
    setSavingDone(!error);
    return !error;
  };

  return { save, saving, savingDone };
}
