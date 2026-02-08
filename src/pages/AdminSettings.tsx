import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Settings, Plus, RefreshCw, Trash2, Check, X, ExternalLink, 
  Rss, FileJson, Globe, Clock 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface SourceFeed {
  id: string;
  name: string;
  url: string;
  feed_type: string;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

interface PendingSong {
  id: string;
  source_feed_id: string | null;
  title: string;
  artist: string;
  external_url: string | null;
  duration: number;
  genre: string | null;
  mood: string | null;
  status: string;
  created_at: string;
  source_feed?: { name: string } | null;
}

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const [feedDialogOpen, setFeedDialogOpen] = useState(false);
  const [editingFeed, setEditingFeed] = useState<SourceFeed | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form state
  const [feedName, setFeedName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [feedType, setFeedType] = useState("rss");

  // Fetch source feeds
  const { data: feeds = [], isLoading: feedsLoading } = useQuery({
    queryKey: ["source_feeds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("source_feeds")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SourceFeed[];
    },
  });

  // Fetch pending songs
  const { data: pendingSongs = [], isLoading: songsLoading } = useQuery({
    queryKey: ["pending_songs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_songs")
        .select(`*, source_feed:source_feeds(name)`)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PendingSong[];
    },
  });

  // Create/Update feed
  const saveFeedMutation = useMutation({
    mutationFn: async (feed: { name: string; url: string; feed_type: string; id?: string }) => {
      if (feed.id) {
        const { error } = await supabase
          .from("source_feeds")
          .update({ name: feed.name, url: feed.url, feed_type: feed.feed_type })
          .eq("id", feed.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("source_feeds")
          .insert({ name: feed.name, url: feed.url, feed_type: feed.feed_type });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source_feeds"] });
      toast.success(editingFeed ? "Feed updated" : "Feed added");
      closeFeedDialog();
    },
    onError: () => toast.error("Failed to save feed"),
  });

  // Delete feed
  const deleteFeedMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("source_feeds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source_feeds"] });
      toast.success("Feed deleted");
    },
    onError: () => toast.error("Failed to delete feed"),
  });

  // Toggle feed active
  const toggleFeedMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("source_feeds")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source_feeds"] });
    },
  });

  // Approve song (downloads to Supabase Storage via edge function)
  const approveSongMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("download-song", {
        body: { pending_song_id: id },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Download failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_songs"] });
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      toast.success("Song approved and downloaded to library");
    },
    onError: (error: Error) => toast.error(`Failed to approve: ${error.message}`),
  });

  // Reject song
  const rejectSongMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("pending_songs")
        .update({ 
          status: "rejected", 
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_songs"] });
      toast.success("Song rejected");
    },
    onError: () => toast.error("Failed to reject song"),
  });

  const openFeedDialog = (feed?: SourceFeed) => {
    if (feed) {
      setEditingFeed(feed);
      setFeedName(feed.name);
      setFeedUrl(feed.url);
      setFeedType(feed.feed_type);
    } else {
      setEditingFeed(null);
      setFeedName("");
      setFeedUrl("");
      setFeedType("rss");
    }
    setFeedDialogOpen(true);
  };

  const closeFeedDialog = () => {
    setFeedDialogOpen(false);
    setEditingFeed(null);
    setFeedName("");
    setFeedUrl("");
    setFeedType("rss");
  };

  const handleSaveFeed = () => {
    if (!feedName.trim() || !feedUrl.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    saveFeedMutation.mutate({
      name: feedName,
      url: feedUrl,
      feed_type: feedType,
      id: editingFeed?.id,
    });
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-feeds");
      
      if (error) {
        toast.error(`Sync failed: ${error.message}`);
        return;
      }

      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["source_feeds"] });
        queryClient.invalidateQueries({ queryKey: ["pending_songs"] });
        toast.success(data.message);
        if (data.errors?.length > 0) {
          data.errors.forEach((err: string) => toast.warning(err));
        }
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch (err) {
      toast.error("Sync failed unexpectedly");
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFeedTypeIcon = (type: string) => {
    switch (type) {
      case "rss": return <Rss className="h-4 w-4" />;
      case "json": return <FileJson className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Integrations
        </h1>
        <Button onClick={handleSync} disabled={isSyncing || feeds.filter(f => f.is_active).length === 0}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing..." : "Sync External Library"}
        </Button>
      </div>

      <Tabs defaultValue="feeds" className="space-y-4">
        <TabsList>
          <TabsTrigger value="feeds">Source Feeds</TabsTrigger>
          <TabsTrigger value="incoming">
            Incoming Songs
            {pendingSongs.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingSongs.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Source Feeds Tab */}
        <TabsContent value="feeds" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Source Feeds</CardTitle>
                <CardDescription>
                  Add RSS feeds or JSON endpoints from open music archives
                </CardDescription>
              </div>
              <Button onClick={() => openFeedDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Feed
              </Button>
            </CardHeader>
            <CardContent>
              {feedsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : feeds.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Rss className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No source feeds configured</p>
                  <p className="text-sm mt-1">Add an RSS or JSON feed to start importing music</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Last Synced</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feeds.map((feed) => (
                      <TableRow key={feed.id}>
                        <TableCell className="font-medium">{feed.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getFeedTypeIcon(feed.feed_type)}
                            <span className="uppercase text-xs">{feed.feed_type}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {feed.url}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground text-sm">
                            <Clock className="h-3 w-3" />
                            {formatDate(feed.last_synced_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={feed.is_active}
                            onCheckedChange={(checked) =>
                              toggleFeedMutation.mutate({ id: feed.id, is_active: checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openFeedDialog(feed)}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteFeedMutation.mutate(feed.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Incoming Songs Tab */}
        <TabsContent value="incoming" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Incoming Songs</CardTitle>
              <CardDescription>
                Review and approve tracks before they go live to restaurants
              </CardDescription>
            </CardHeader>
            <CardContent>
              {songsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : pendingSongs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Check className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending songs to review</p>
                  <p className="text-sm mt-1">Sync your feeds to import new tracks</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Artist</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Genre</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingSongs.map((song) => (
                      <TableRow key={song.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{song.title}</span>
                            {song.external_url && (
                              <a
                                href={song.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{song.artist}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {song.source_feed?.name || "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{song.genre || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(song.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => approveSongMutation.mutate(song.id)}
                              disabled={approveSongMutation.isPending || rejectSongMutation.isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => rejectSongMutation.mutate(song.id)}
                              disabled={approveSongMutation.isPending || rejectSongMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Feed Dialog */}
      <Dialog open={feedDialogOpen} onOpenChange={setFeedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFeed ? "Edit Feed" : "Add Source Feed"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feedName">Feed Name</Label>
              <Input
                id="feedName"
                placeholder="e.g., Free Music Archive"
                value={feedName}
                onChange={(e) => setFeedName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedUrl">Feed URL</Label>
              <Input
                id="feedUrl"
                placeholder="https://example.com/feed.rss"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedType">Feed Type</Label>
              <Select value={feedType} onValueChange={setFeedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rss">RSS Feed</SelectItem>
                  <SelectItem value="json">JSON Endpoint</SelectItem>
                  <SelectItem value="api">REST API</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeFeedDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveFeed} disabled={saveFeedMutation.isPending}>
              {saveFeedMutation.isPending ? "Saving..." : editingFeed ? "Update" : "Add Feed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
