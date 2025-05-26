import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import UpgradeCTA from "@/components/UpgradeCTA";
import UpgradeModal from "@/components/UpgradeModal";

/**
 * Sign in and sign up forms using Supabase auth.
 */
const Account = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const { user, loading: authLoading } = useAuth();

  // If user is authenticated, show account area
  if (authLoading) {
    return (
      <div className="bg-[#f8fafc] min-h-screen">
        <Navbar authenticated={false} />
        <main className="max-w-md mx-auto py-20 px-4 text-center">
          <UpgradeModal />
          <h2 className="text-2xl font-bold mb-4 text-green-800">Loading...</h2>
        </main>
      </div>
    );
  }

  if (user) {
    const handleLogout = async () => {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          title: "Sign out failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Signed out",
          description: "You have been logged out.",
        });
      }
    };

    return (
      <div className="bg-[#f8fafc] min-h-screen">
        <Navbar authenticated={true} />
        <main className="max-w-md mx-auto py-20 px-4 text-center">
          <UpgradeModal />
          <h2 className="text-2xl font-bold mb-4 text-green-800">Your Account</h2>
          <div className="mb-4 text-lg text-gray-700">Signed in as <span className="font-medium">{user.email}</span></div>
          <Button variant="secondary" onClick={handleLogout}>Log Out</Button>
          <UpgradeCTA className="mt-7" />
        </main>
      </div>
    );
  }

  // Login/Signup UI
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (error) {
        toast({
          title: "Sign In Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sign In Successful",
          description: "Welcome back!",
        });
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });

      if (error) {
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sign Up Successful",
          description: "Check your email to confirm your account.",
        });
        // Optionally, switch to login mode after signup
        setMode("login");
      }
    }
    setLoading(false);
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Navbar authenticated={false} />
      <main className="max-w-md mx-auto py-16 px-4 text-center">
        <UpgradeCTA className="mb-7" />
        <UpgradeModal />
        <h2 className="text-2xl font-bold mb-4 text-green-800">
          {mode === "login" ? "Sign In" : "Sign Up"}
        </h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            autoComplete="email"
            required
            disabled={loading}
          />
          <Input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            disabled={loading}
          />
          <Button size="lg" className="w-full" type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>
        <div className="mt-5">
          {mode === "login" ? (
            <span>
              New here?{" "}
              <button
                className="text-green-600 hover:underline font-medium"
                onClick={() => setMode("signup")}
                disabled={loading}
              >
                Sign Up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{" "}
              <button
                className="text-green-600 hover:underline font-medium"
                onClick={() => setMode("login")}
                disabled={loading}
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </main>
    </div>
  );
};

export default Account;
