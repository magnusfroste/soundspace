import { defineMcp } from "@lovable.dev/mcp-js";
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
  name: "sound-space",
  title: "sound-space",
  version: "1.0.0",
  instructions:
    "Tools for the sound-space music library. Authenticate with the MCP API token as a bearer token. " +
    "Use list_songs/get_song to browse the catalog, update_song to edit metadata (title, artist, genre, mood, prompt, lyrics, BPM, key), " +
    "delete_song/restore_song for trash management, and the playlist tools to curate playlists.",
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
