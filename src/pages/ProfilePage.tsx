import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { User, Camera, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [displayName, setDisplayName] = useState<string | null>(null);
  const resolvedName = displayName ?? profile?.display_name ?? "";

  const updateProfile = useMutation({
    mutationFn: async (fields: { display_name?: string; avatar_url?: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update(fields)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Profile updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [uploading, setUploading] = useState(false);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatar_url = `${urlData.publicUrl}?t=${Date.now()}`;

      await updateProfile.mutateAsync({ avatar_url });
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleSave() {
    updateProfile.mutate({ display_name: resolvedName || undefined });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <User className="h-6 w-6 text-primary" />
        Profile
      </h1>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative group h-24 w-24 rounded-full bg-muted overflow-hidden ring-2 ring-border hover:ring-primary transition-all"
          disabled={uploading}
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <User className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {uploading ? (
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarUpload}
        />
        <p className="text-xs text-muted-foreground">Click to change photo</p>
      </div>

      {/* Form */}
      <div className="glass rounded-xl p-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={resolvedName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled className="opacity-60" />
        </div>

        <div className="space-y-2">
          <Label>Role</Label>
          <div>
            <Badge variant={role === "admin" ? "default" : "secondary"}>
              {role}
            </Badge>
          </div>
        </div>

        {profile?.business_name && (
          <div className="space-y-2">
            <Label>Business</Label>
            <Input value={profile.business_name} disabled className="opacity-60" />
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={updateProfile.isPending}
          className="w-full gap-2"
        >
          {updateProfile.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
