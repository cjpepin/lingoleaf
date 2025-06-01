
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useLibraryBooks = () => {
  const { data: libraryBooks, isLoading, error, refetch } = useQuery({
      queryKey: ["library-books"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("books")
          .select("*")
          .eq("access_level", "free")
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        return data || [];
      },
    });

  useEffect(() => {
    refetch();
  }, []);

  return {
    libraryBooks: libraryBooks || [],
    isLoading,
    error,
    refetch
  };
};

