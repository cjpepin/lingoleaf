
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to fetch the current user's books from Supabase
 * @param userId Supabase user id
 */
export const useUserBooks = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["books", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!userId,
  });
};
