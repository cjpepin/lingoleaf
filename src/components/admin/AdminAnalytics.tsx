
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BookOpen, Users, Upload, TrendingUp } from "lucide-react";

const AdminAnalytics = () => {
  // Fetch analytics data
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["adminAnalytics"],
    queryFn: async () => {
      // Get total books count
      const { count: totalBooks } = await supabase
        .from("books")
        .select("*", { count: "exact", head: true });

      // Get total users count
      const { count: totalUsers } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true });

      // Get books by access level
      const { data: booksByAccess } = await supabase
        .from("books")
        .select("access_level")
        .then(({ data }) => {
          const counts = data?.reduce((acc, book) => {
            acc[book.access_level] = (acc[book.access_level] || 0) + 1;
            return acc;
          }, {} as Record<string, number>) || {};
          
          return {
            data: Object.entries(counts).map(([level, count]) => ({
              name: level,
              count,
            }))
          };
        });

      // Get user growth (simplified - just showing role distribution)
      const { data: roleDistribution } = await supabase
        .from("user_roles")
        .select("role")
        .then(({ data }) => {
          const counts = data?.reduce((acc, user) => {
            acc[user.role] = (acc[user.role] || 0) + 1;
            return acc;
          }, {} as Record<string, number>) || {};
          
          return {
            data: Object.entries(counts).map(([role, count]) => ({
              name: role,
              count,
            }))
          };
        });

      return {
        totalBooks: totalBooks || 0,
        totalUsers: totalUsers || 0,
        booksByAccess: booksByAccess || [],
        roleDistribution: roleDistribution || [],
      };
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading analytics...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <BookOpen className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{analytics?.totalBooks}</p>
                <p className="text-sm text-gray-600">Total Books</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{analytics?.totalUsers}</p>
                <p className="text-sm text-gray-600">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Upload className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">
                  {analytics?.booksByAccess?.reduce((sum, item) => sum + item.count, 0) || 0}
                </p>
                <p className="text-sm text-gray-600">Books Uploaded</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">
                  {analytics?.roleDistribution?.find(r => r.name === "admin")?.count || 0}
                </p>
                <p className="text-sm text-gray-600">Admin Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Books by Access Level</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics?.booksByAccess}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Role Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics?.roleDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalytics;
