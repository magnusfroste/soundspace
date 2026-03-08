import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, style } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build a rich prompt for album cover art
    const fullPrompt = `Create a visually stunning abstract album cover art for a music playlist. Theme: ${prompt}. Style: ${style || "modern abstract"}. The image should be:
- Square format suitable for playlist cover
- Professional music streaming aesthetic
- Bold, vibrant colors with depth
- No text or typography
- Dark background with colorful accents
- High contrast and visually striking`;

    console.log("Generating cover with prompt:", fullPrompt);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: fullPrompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response keys:", JSON.stringify(Object.keys(data)));

    // Try multiple response formats:
    // 1. OpenAI-style: choices[0].message.images[0].image_url.url
    // 2. Lovable Gateway: choices[0].message.content with inline base64 parts
    // 3. Gemini native: candidates[0].content.parts[].inlineData
    let imageUrl: string | null = null;

    // Format 1: images array
    imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;

    // Format 2: content parts with inline_image or image_url
    if (!imageUrl) {
      const content = data.choices?.[0]?.message?.content;
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === "image_url" && part.image_url?.url) {
            imageUrl = part.image_url.url;
            break;
          }
          if (part.inline_data?.data) {
            imageUrl = `data:${part.inline_data.mime_type || "image/png"};base64,${part.inline_data.data}`;
            break;
          }
        }
      }
    }

    // Format 3: Gemini native candidates format
    if (!imageUrl && data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          imageUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    // Format 4: OpenAI images.generate style (b64_json)
    if (!imageUrl && data.data?.[0]?.b64_json) {
      imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
    }

    if (!imageUrl) {
      console.error("No image in response. Response structure:", JSON.stringify(data).slice(0, 500));
      throw new Error("No image generated — unexpected response format");
    }

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cover generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
