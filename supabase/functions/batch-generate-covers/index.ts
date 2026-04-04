import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get songs without covers — small batch to stay within timeout
    const body = await req.json().catch(() => ({}));
    const trashedOnly = body.trashed_only !== false;
    const batchSize = body.batch_size || 5;

    let query = supabase
      .from("songs")
      .select("id, title, genre, mood")
      .or("cover_url.is.null,cover_url.eq.");

    if (trashedOnly) {
      query = query.not("deleted_at", "is", null);
    }

    const { data: songs, error: fetchError } = await query.limit(batchSize);
    if (fetchError) throw fetchError;
    if (!songs || songs.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No songs need covers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating covers for ${songs.length} songs`);
    let success = 0;
    let failed = 0;

    for (const song of songs) {
      try {
        const prompt = `Album cover art for a ${song.genre || "ambient"} track called "${song.title}". Mood: ${song.mood || "relaxed"}. Abstract, no text, dark background, vibrant accents, square format, professional music streaming aesthetic.`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image-preview",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
          }),
        });

        if (!aiRes.ok) {
          console.error(`AI error for ${song.id}: ${aiRes.status}`);
          failed++;
          // Rate limit — stop batch
          if (aiRes.status === 429) {
            console.log("Rate limited, stopping batch");
            break;
          }
          continue;
        }

        const data = await aiRes.json();

        // Extract image from response
        let imageData: string | null = null;
        let mimeType = "image/png";

        // Format 1: images array
        const imgUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (imgUrl?.startsWith("data:")) {
          const match = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) { mimeType = match[1]; imageData = match[2]; }
        } else if (imgUrl) {
          imageData = imgUrl;
        }

        // Format 2: content parts
        if (!imageData) {
          const content = data.choices?.[0]?.message?.content;
          if (Array.isArray(content)) {
            for (const part of content) {
              if (part.type === "image_url" && part.image_url?.url) {
                const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
                if (match) { mimeType = match[1]; imageData = match[2]; break; }
              }
              if (part.inline_data?.data) {
                mimeType = part.inline_data.mime_type || "image/png";
                imageData = part.inline_data.data;
                break;
              }
            }
          }
        }

        if (!imageData) {
          console.error(`No image in response for ${song.id}`);
          failed++;
          continue;
        }

        // Decode and upload to storage
        const bytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
        const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
        const fileName = `covers/cover-${song.id}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("songs")
          .upload(fileName, bytes, { contentType: mimeType, upsert: true });

        if (uploadError) {
          console.error(`Upload error for ${song.id}:`, uploadError);
          failed++;
          continue;
        }

        const { data: urlData } = supabase.storage.from("songs").getPublicUrl(fileName);

        // Update song with cover URL
        const { error: updateError } = await supabase
          .from("songs")
          .update({ cover_url: urlData.publicUrl })
          .eq("id", song.id);

        if (updateError) {
          console.error(`Update error for ${song.id}:`, updateError);
          failed++;
          continue;
        }

        success++;
        console.log(`✓ Cover generated for "${song.title}" (${success}/${songs.length})`);

        // Small delay between generations to avoid rate limits
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        console.error(`Error processing ${song.id}:`, err);
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed: songs.length, success, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Batch cover error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
