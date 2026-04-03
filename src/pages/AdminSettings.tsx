import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Music, Globe, Save, Loader2, Mic, Crown, ListPlus, Key, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Playlist = Tables<"playlists">;

interface LandingPageSettings {
  playlist_id: string | null;
  enabled: boolean;
}

interface PremiumFeatures {
  announcements_enabled: boolean;
  custom_playlists_enabled: boolean;
}

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const [landingSettings, setLandingSettings] = useState<LandingPageSettings>({
    playlist_id: null,
    enabled: false,
  });
  const [premiumFeatures, setPremiumFeatures] = useState<PremiumFeatures>({
    announcements_enabled: false,
    custom_playlists_enabled: false,
  });
  const [apiToken, setApiToken] = useState("");

  // Fetch landing page settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["site-settings", "landing_page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("key", "landing_page")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch premium features settings
  const { data: premiumSettings, isLoading: premiumLoading } = useQuery({
    queryKey: ["site-settings", "premium_features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("key", "premium_features")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch A2A bearer token
  const { data: a2aTokenSetting } = useQuery({
    queryKey: ["site-settings", "a2a_bearer_token"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("key", "a2a_bearer_token")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: playlists } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("*")
        .order("title");

      if (error) throw error;
      return data as Playlist[];
    },
  });

  // Update local state when settings load
  useEffect(() => {
    if (settings?.value) {
      const value = settings.value as unknown as LandingPageSettings;
      setLandingSettings({
        playlist_id: value.playlist_id || null,
        enabled: value.enabled || false,
      });
    }
  }, [settings]);

  // Update premium features state when settings load
  useEffect(() => {
    if (premiumSettings?.value) {
      const value = premiumSettings.value as unknown as PremiumFeatures;
      setPremiumFeatures({
        announcements_enabled: value.announcements_enabled || false,
        custom_playlists_enabled: value.custom_playlists_enabled || false,
      });
    }
  }, [premiumSettings]);

  // Save landing page mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: LandingPageSettings) => {
      const { error } = await supabase
        .from("site_settings")
        .update({ value: JSON.parse(JSON.stringify(newSettings)) })
        .eq("key", "landing_page");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Settings saved successfully");
    },
    onError: (error) => {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    },
  });

  // Save premium features mutation
  const savePremiumMutation = useMutation({
    mutationFn: async (updates: Partial<PremiumFeatures>) => {
      // First read current value to merge with updates
      const { data: current } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "premium_features")
        .maybeSingle();

      const currentValue = (current?.value as unknown as PremiumFeatures) || {
        announcements_enabled: false,
        custom_playlists_enabled: false,
      };

      const newValue = { ...currentValue, ...updates };

      // Upsert the merged value
      const { error } = await supabase
        .from("site_settings")
        .upsert({ 
          key: "premium_features", 
          value: JSON.parse(JSON.stringify(newValue)) 
        }, { onConflict: "key" });

      if (error) throw error;
      return newValue;
    },
    onSuccess: (newValue) => {
      setPremiumFeatures(newValue);
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Premium features updated");
    },
    onError: (error) => {
      console.error("Failed to save premium features:", error);
      toast.error("Failed to save premium features");
    },
  });

  const handleSave = () => {
    saveMutation.mutate(landingSettings);
  };

  const handleToggleAnnouncements = (enabled: boolean) => {
    savePremiumMutation.mutate({ announcements_enabled: enabled });
  };

  const handleToggleCustomPlaylists = (enabled: boolean) => {
    savePremiumMutation.mutate({ custom_playlists_enabled: enabled });
  };

  const selectedPlaylist = playlists?.find((p) => p.id === landingSettings.playlist_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Site Settings</h1>
          <p className="text-muted-foreground">Configure global site settings</p>
        </div>
      </div>

      {settingsLoading || premiumLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Premium Features */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                <CardTitle>Premium Features</CardTitle>
              </div>
              <CardDescription>
                Enable or disable premium functionality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Announcements feature */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mic className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <Label htmlFor="announcements-toggle">Voice Announcements</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow businesses to record and schedule voice announcements
                    </p>
                  </div>
                </div>
                <Switch
                  id="announcements-toggle"
                  checked={premiumFeatures.announcements_enabled}
                  onCheckedChange={handleToggleAnnouncements}
                  disabled={savePremiumMutation.isPending}
                />
              </div>

              {/* Custom Playlists feature */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ListPlus className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <Label htmlFor="custom-playlists-toggle">Custom Playlists</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow businesses to create and curate their own playlists
                    </p>
                  </div>
                </div>
                <Switch
                  id="custom-playlists-toggle"
                  checked={premiumFeatures.custom_playlists_enabled}
                  onCheckedChange={handleToggleCustomPlaylists}
                  disabled={savePremiumMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>

          {/* Landing Page Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <CardTitle>Landing Page</CardTitle>
              </div>
              <CardDescription>
                Configure the public landing page experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable ambient music */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="ambient-music">Ambient Music</Label>
                  <p className="text-sm text-muted-foreground">
                    Play background music when visitors scroll
                  </p>
                </div>
                <Switch
                  id="ambient-music"
                  checked={landingSettings.enabled}
                  onCheckedChange={(checked) =>
                    setLandingSettings((prev) => ({ ...prev, enabled: checked }))
                  }
                />
              </div>

              {/* Playlist selector */}
              <div className="space-y-2">
                <Label htmlFor="playlist-select">Featured Playlist</Label>
                <Select
                  value={landingSettings.playlist_id || ""}
                  onValueChange={(value) =>
                    setLandingSettings((prev) => ({
                      ...prev,
                      playlist_id: value || null,
                    }))
                  }
                  disabled={!landingSettings.enabled}
                >
                  <SelectTrigger id="playlist-select" className="w-full">
                    <SelectValue placeholder="Select a playlist">
                      {selectedPlaylist ? (
                        <div className="flex items-center gap-2">
                          <Music className="h-4 w-4" />
                          <span>{selectedPlaylist.title}</span>
                        </div>
                      ) : (
                        "Select a playlist"
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {playlists?.map((playlist) => (
                      <SelectItem key={playlist.id} value={playlist.id}>
                        <div className="flex items-center gap-2">
                          {playlist.cover_image_url ? (
                            <img
                              src={playlist.cover_image_url}
                              alt=""
                              className="h-6 w-6 rounded object-cover"
                            />
                          ) : (
                            <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                              <Music className="h-3 w-3" />
                            </div>
                          )}
                          <span>{playlist.title}</span>
                        </div>
                      </SelectItem>
                    ))}
                    {(!playlists || playlists.length === 0) && (
                      <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                        No playlists available
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Songs from this playlist will play when visitors scroll on the landing page
                </p>
              </div>

              {/* Save button */}
              <div className="pt-4 border-t">
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="gap-2"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
