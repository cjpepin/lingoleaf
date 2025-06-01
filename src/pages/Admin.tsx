
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useUserRole";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminBookManagement from "@/components/admin/AdminBookManagement";
import AdminUserManagement from "@/components/admin/AdminUserManagement";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import { Navigate } from "react-router-dom";

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useIsAdmin();

  // Show loading while checking authentication and role
  if (authLoading || roleLoading) {
    return (
      <div className="bg-[#f8fafc] min-h-screen">
        <Navbar authenticated={!!user} />
        <main className="max-w-7xl mx-auto py-8 px-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-green-800">Loading...</h2>
          </div>
        </main>
      </div>
    );
  }

  // Redirect if not authenticated or not admin
  // if (!user || !isAdmin) {
  //   return <Navigate to="/" replace />;
  // }

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Navbar authenticated={true} />
      <main className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-800 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage books, users, and view analytics</p>
        </div>

        <Tabs defaultValue="books" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="books">Book Management</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="books">
            <AdminBookManagement />
          </TabsContent>

          <TabsContent value="users">
            <AdminUserManagement />
          </TabsContent>

          <TabsContent value="analytics">
            <AdminAnalytics />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
