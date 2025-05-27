import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  console.log("top");
  const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
  console.log("2");
  try {
    console.log("Received request to create checkout session");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    console.log("Authorization header:", authHeader);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    console.log("Authenticated user:", user);
    if (userError) throw new Error("Authentication error: " + userError.message);
    if (!user?.email) throw new Error("User email missing");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16"
    });
    // Find or create customer
    let customerSearch;
    try {
      customerSearch = await stripe.customers.search({
        query: `email:"${user.email}"`
      });
      console.log("Customer search result:", customerSearch.data);
    } catch (e) {
      console.error("Stripe customer search failed:", e);
      return;
    }
    let customerId;
    if (customerSearch.data.length > 0) {
      customerId = customerSearch.data[0].id;
    }
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "LinguaLeaf Premium Subscription"
            },
            unit_amount: 799,
            recurring: {
              interval: "month"
            }
          },
          quantity: 1
        }
      ],
      mode: "subscription",
      success_url: `${origin}/account?subscribed=success`,
      cancel_url: `${origin}/account?subscribed=cancel`
    });
    return new Response(JSON.stringify({
      url: session.url
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 200
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(msg);
    return new Response(JSON.stringify({
      error: msg
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});