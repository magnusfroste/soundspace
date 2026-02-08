import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pending_song_id } = await req.json();

    if (!pending_song_id) {
      return new Response(JSON.stringify({ error: "pending_song_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pending song
    const { data: pendingSong, error: fetchError } = await supabase
      .from("pending_songs")
      .select("*")
      .eq("id", pending_song_id)
      .single();

    if (fetchError || !pendingSong) {
      return new Response(JSON.stringify({ error: "Song not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingSong.external_url) {
      return new Response(JSON.stringify({ error: "No external URL for this song" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Downloading: ${pendingSong.external_url}`);

    // Download the audio file
    const audioResponse = await fetch(pendingSong.external_url, {
      headers: {
        "User-Agent": "SomHonesto/1.0 (Music Library)",
      },
    });
    
    if (!audioResponse.ok) {
      console.error(`Download failed: ${audioResponse.status} from ${pendingSong.external_url}`);
      
      // Handle specific error codes with user-friendly messages
      if (audioResponse.status === 404) {
        // Mark the pending song as unavailable
        await supabase
          .from("pending_songs")
          .update({ status: "unavailable" })
          .eq("id", pending_song_id);
          
        return new Response(
          JSON.stringify({ 
            error: "Source file no longer available",
            details: "The external source has removed or moved this file. The song has been marked as unavailable.",
            status_code: 404
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (audioResponse.status === 403) {
        return new Response(
          JSON.stringify({ 
            error: "Access denied by source",
            details: "The external source is blocking access to this file.",
            status_code: 403
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: `Failed to download audio`,
          details: `Source returned status ${audioResponse.status}`,
          status_code: audioResponse.status
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const contentType = audioResponse.headers.get("content-type") || "audio/mpeg";
    
    // Generate unique filename
    const timestamp = Date.now();
    const safeTitle = pendingSong.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 50);
    const filename = `${timestamp}-${safeTitle}.mp3`;

    console.log(`Uploading to storage: ${filename} (${audioBuffer.byteLength} bytes)`);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("songs")
      .upload(filename, audioBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: `Failed to upload: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("songs")
      .getPublicUrl(filename);

    const publicUrl = publicUrlData.publicUrl;

    console.log(`Uploaded successfully: ${publicUrl}`);

    // Create song record
    const { error: songError } = await supabase.from("songs").insert({
      title: pendingSong.title,
      artist: pendingSong.artist,
      file_url: publicUrl,
      duration: pendingSong.duration || 0,
      genre: pendingSong.genre,
      mood: pendingSong.mood,
      origin_source: "external_feed",
    });

    if (songError) {
      console.error("Song insert error:", songError);
      // Try to clean up uploaded file
      await supabase.storage.from("songs").remove([filename]);
      return new Response(
        JSON.stringify({ error: `Failed to create song record: ${songError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update pending song status
    await supabase
      .from("pending_songs")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", pending_song_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Song approved and added to library",
        file_url: publicUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Download error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
