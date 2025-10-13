import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0";

// Deno does not natively support 'fetch' for OpenAI, so we use their client
import { OpenAI } from "https://deno.land/x/openai@v4.52.0/mod.ts";

// Initialize OpenAI client using the secret key from environment variables
// Note: We avoid 'SUPABASE_' prefix in user-defined secrets to prevent conflicts.
const openai = new OpenAI({ apiKey: Deno.env.get("MY_OPENAI_API_KEY") });
const MODEL_NAME = "gpt-4.1-nano-2025-04-14"; // Preferred model

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Core Function: Call OpenAI to generate the JD ---
async function generateJobDescription(keywords: string, currentJd: string): Promise<string> {
    const action = currentJd.length > 50 ? "REGENERATE" : "GENERATE";
    
    // System message guides the AI's persona and output format
    const systemMessage = `You are a professional HR specialist at 'Brother' tasked with writing concise, well-structured, professional job descriptions (JDs) in markdown format. 
    The JD must be ready-to-use. Do not include a final 'Job Requirements' section, as that is a separate form field. 
    Focus only on the 'Key Responsibilities' and 'Why Join Us' sections. The tone should be engaging and positive.`;
    
    let prompt;

    if (action === "REGENERATE") {
        prompt = `The user is not happy with the current JD. Please provide an improved, high-quality, and structurally different version for a role based on the following keywords: ${keywords}. 
        The previous attempt was: """${currentJd}"""`;
    } else {
        prompt = `Please write a comprehensive job description for a role at Brother based on these core keywords: ${keywords}.`;
    }

    const completion = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
    });

    return completion.choices[0].message.content || "";
}

// --- Core Function: Save form data to Supabase ---
async function submitRequisition(data: any) {
    // Supabase client creation using the service role key for secure writing
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("APP_SUPABASE_SERVICE_KEY")! // Uses the secure Service Key
    );
    
    const { data: insertData, error } = await supabase
        .from('requisitions') // Our table name
        .insert([data])
        .select('id') // Select the ID of the new row
        .single();
    
    if (error) {
        throw new Error(`Supabase insert error: ${error.message}`);
    }
    
    return insertData;
}


serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders, status: 204 });
    }

    try {
        const { action, keywords, current_jd, payload } = await req.json();

        if (action === 'submit') {
            // --- Submission Mode ---
            if (!payload) throw new Error("Missing submission payload.");
            const result = await submitRequisition(payload);
            return new Response(JSON.stringify(result), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }
        
        // --- JD Generation Mode (Default) ---
        if (!keywords) {
            throw new Error("Missing 'keywords' in request for AI generation.");
        }
        
        const generated_jd = await generateJobDescription(keywords, current_jd || "");

        return new Response(JSON.stringify({ generated_jd }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
        
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});