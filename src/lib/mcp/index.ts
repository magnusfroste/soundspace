import { auth, defineMcp } from "@lovable.dev/mcp-js";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";
import listSongs from "./tools/list-songs";
import getSong from "./tools/get-song";
import updateSong from "./tools/update-song";
import deleteSong from "./tools/delete-song";
import restoreSong from "./tools/restore-song";
import listPlaylists from "./tools/list-playlists";
import getPlaylistSongs from "./tools/get-playlist-songs";
import createPlaylist from "./tools/create-playlist";
import updatePlaylist from "./tools/update-playlist";
import deletePlaylist from "./tools/delete-playlist";
import addSongToPlaylist from "./tools/add-song-to-playlist";
import removeSongFromPlaylist from "./tools/remove-song-from-playlist";
import libraryStats from "./tools/library-stats";

export default defineMcp({
  name: "soundspace",
  title: "SoundSpace",
  version: "1.0.0",
  instructions:
    "Tools for the SoundSpace music library. Sign in with an admin account via OAuth. " +
    "Use list_songs/get_song to browse the catalog, update_song to edit metadata (title, artist, genre, mood, prompt, lyrics, BPM, key), " +
    "delete_song/restore_song for trash management, and the playlist tools to curate playlists.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listSongs,
    getSong,
    updateSong,
    deleteSong,
    restoreSong,
    listPlaylists,
    getPlaylistSongs,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    libraryStats,
  ],
});
