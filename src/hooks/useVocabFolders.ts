
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useVocabFolders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: folders, isLoading, error } = useQuery({
    queryKey: ["vocab-folders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("vocab_folders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data as Array<{ id: string; name: string; note: string | null; created_at: string }>;
    },
    enabled: !!user,
  });

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not logged in");
      const { error } = await supabase
        .from("vocab_folders")
        .insert({ name, user_id: user.id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vocab-folders", user?.id] });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, name, note }: { id: string; name: string; note?: string }) => {
      if (!user) throw new Error("Not logged in");
      const { error } = await supabase
        .from("vocab_folders")
        .update({ name, note })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vocab-folders", user?.id] });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not logged in");
      const { error } = await supabase
        .from("vocab_folders")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vocab-folders", user?.id] });
    },
  });

  return {
    folders,
    loading: isLoading,
    error,
    createFolder: createFolderMutation.mutateAsync,
    updateFolder: updateFolderMutation.mutateAsync,
    deleteFolder: deleteFolderMutation.mutateAsync,
  };
}

export function useAllVocabFolders() {
  // Mini hook for folder dropdown in popups etc (just loads all user's folders)
  const { user } = useAuth();
  return useQuery({
    queryKey: ["vocab-folders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("vocab_folders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data as Array<{ id: string; name: string }>;
    },
    enabled: !!user,
  });
}
