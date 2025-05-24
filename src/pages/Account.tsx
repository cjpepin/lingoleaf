
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// Placeholder UI for Sign In/Profile (phase 1B only—will add real auth flow shortly)
const Account = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");

  // If user is authenticated, show profile/account page.
  const authenticated = false;

  if (authenticated) {
    return (
      <div className="bg-[#f8fafc] min-h-screen">
        <Navbar authenticated={true} />
        <main className="max-w-md mx-auto py-20 px-4 text-center">
          <h2 className="text-2xl font-bold mb-4 text-green-800">Your Account</h2>
          <Button variant="secondary">Log Out</Button>
        </main>
      </div>
    );
  }

  // Login/Signup UI
  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Navbar authenticated={false} />
      <main className="max-w-md mx-auto py-16 px-4 text-center">
        <h2 className="text-2xl font-bold mb-4 text-green-800">
          {mode === "login" ? "Sign In" : "Sign Up"}
        </h2>
        <form className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-2 rounded border border-gray-300"
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-2 rounded border border-gray-300"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
          <Button size="lg" className="w-full">
            {mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>
        <div className="mt-5">
          {mode === "login" ? (
            <span>
              New here?{" "}
              <button
                className="text-green-600 hover:underline font-medium"
                onClick={() => setMode("signup")}
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
