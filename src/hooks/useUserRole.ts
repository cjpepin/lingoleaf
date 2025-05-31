
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook to get the current user's role
 */
export const useUserRole = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["userRole", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase.rpc("get_user_role", {
        _user_id: user.id,
      });
      
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user?.id,
  });
};

/**
 * Hook to check if user has admin role
 */
export const useIsAdmin = () => {
  const { data: role, isLoading } = useUserRole();
  return {
    isAdmin: role === "admin",
    isLoading,
  };
};
