
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Logging for transparency
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Supabase client with service role key for updating user info
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");

    // Get the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error("Authentication error: " + userError.message);
    if (!user?.email) throw new Error("User email missing");

    logStep("User authenticated", { id: user.id, email: user.email });

    // Stripe: find customer by email
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) customerId = customers.data[0].id;

    let hasActiveSub = false;

    if (customerId) {
      // Check subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      hasActiveSub = subscriptions.data.length > 0;
    }

    // Update user's tier in users table (`tier` is the premium flag)
    const newTier = hasActiveSub ? "paid" : "free";
    const { error: profileErr } = await supabaseClient
      .from("users").update({ tier: newTier }).eq("id", user.id);

    if (profileErr) {
      throw new Error("Couldn't update user premium status: " + profileErr.message);
    }

    logStep("Updated user tier", { id: user.id, newTier });

    return new Response(
      JSON.stringify({ subscribed: hasActiveSub, tier: newTier }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMsg });
    return new Response(JSON.stringify({ error: errorMsg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500
    });
  }
});
