
# Admin Song Library with Drag-and-Drop Playlist Management

## Overview

Create a new "Song Library" admin page that provides a centralized view of all songs with metadata, preview capabilities, and drag-and-drop functionality for organizing songs into playlists. This will serve as the primary workspace for content curators.

## Architecture (Model-View-Data)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  songs table          │  playlists table      │  playlist_songs table   │
│  - id, title, artist  │  - id, title          │  - playlist_id          │
│  - genre, mood, bpm   │  - category           │  - song_id              │
│  - duration, cover    │  - cover_image_url    │  - position             │
│  - file_url           │                       │                         │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
┌─────────────────────────────┐    ┌─────────────────────────────┐
│        MODEL LAYER          │    │        VIEW LAYER           │
├─────────────────────────────┤    ├─────────────────────────────┤
│  useSongsLibrary hook       │    │  AdminLibrary page          │
│  - Fetch all songs          │    │  - Split-panel layout       │
│  - Filter/search logic      │    │                             │
│  - Drag-and-drop state      │    │  SongCard component         │
│                             │    │  - Cover, metadata, preview │
│  usePlaylistManager hook    │    │  - Drag handle              │
│  - Add song to playlist     │    │                             │
│  - Remove from playlist     │    │  PlaylistDropZone           │
│  - Reorder songs            │    │  - Visual drop target       │
└─────────────────────────────┘    │  - Song count badge         │
                                   └─────────────────────────────┘
```

## UI Design (Reference Image Inspired)

The layout follows the reference image pattern with a dual-panel approach:

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  SONG LIBRARY                                    [Search...] [Filters ▼] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────┐   ┌───────────────────────────┐ │
│  │         SONG CARDS GRID             │   │      PLAYLISTS PANEL     │ │
│  │                                     │   │                           │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐│   │  ┌───────────────────┐   │ │
│  │  │  ▶ ⋮   │ │  ▶ ⋮   │ │  ▶ ⋮   ││   │  │ Relaxed Ambience  │   │ │
│  │  │ [cover] │ │ [cover] │ │ [cover] ││   │  │ 🎵 3 songs        │   │ │
│  │  │ Title   │ │ Title   │ │ Title   ││   │  │ [Drop to add]     │   │ │
│  │  │ Artist  │ │ Artist  │ │ Artist  ││   │  └───────────────────┘   │ │
│  │  │ Jazz    │ │ Pop     │ │ Ambient ││   │                           │ │
│  │  │ 3:45    │ │ 2:30    │ │ 4:00    ││   │  ┌───────────────────┐   │ │
│  │  └─────────┘ └─────────┘ └─────────┘│   │  │ Energetic Beats   │   │ │
│  │                                     │   │  │ 🎵 2 songs        │   │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐│   │  └───────────────────┘   │ │
│  │  │  ▶ ⋮   │ │  ▶ ⋮   │ │  ▶ ⋮   ││   │                           │ │
│  │  │ ...    │ │ ...    │ │ ...    ││   │  ┌───────────────────┐   │ │
│  │  └─────────┘ └─────────┘ └─────────┘│   │  │ Professional      │   │ │
│  │                                     │   │  │ Settings          │   │ │
│  └─────────────────────────────────────┘   │  │ 🎵 2 songs        │   │ │
│                                            │  └───────────────────┘   │ │
│                                            └───────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
│                            PLAYER BAR                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

## Song Card Design

Each card displays essential metadata with quick-action capabilities:

```text
┌──────────────────────────────┐
│  [⋮ drag]  ▶ play    [more] │
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │                        │  │
│  │      Cover Image       │  │
│  │      (or icon)         │  │
│  │                        │  │
│  └────────────────────────┘  │
│                              │
│  Jazz Lounge Session         │
│  Smooth Keys                 │
│                              │
│  ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ Jazz │ │Mellow│ │ 4:00 │  │
│  └──────┘ └──────┘ └──────┘  │
│                              │
│  In: Relaxed Ambience        │
└──────────────────────────────┘
```

## Implementation Steps

### 1. New Page: AdminLibrary.tsx
- Create `/admin/library` route
- Split-panel layout using ResizablePanelGroup from existing UI components
- Left panel: Song grid with filtering
- Right panel: Playlist drop zones

### 2. New Component: SongCard.tsx
- Compact card showing: cover, title, artist, genre, mood, duration
- Play button for inline preview (uses PlayerContext)
- Drag handle for drag-and-drop
- "Currently in playlist" indicator
- Context menu for additional actions

### 3. New Component: PlaylistDropZone.tsx
- Collapsible playlist cards in right panel
- Visual feedback when dragging over (highlight border)
- Shows current song count
- Expands to show songs already in playlist

### 4. Drag-and-Drop Implementation
- Use native HTML5 drag-and-drop (no extra dependencies)
- Store dragged song ID in dataTransfer
- Visual cues: ghost element, drop zone highlighting
- Prevent duplicate additions

### 5. Filter System
- Search by title/artist
- Filter by genre dropdown
- Filter by mood dropdown
- Filter by "not in any playlist" toggle

### 6. Navigation Update
- Add "Song Library" to admin sidebar between "Song Ingestion" and "Manage Playlists"

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/AdminLibrary.tsx` | Main page with split layout |
| `src/components/admin/SongCard.tsx` | Draggable song card |
| `src/components/admin/PlaylistDropZone.tsx` | Drop target for playlists |
| `src/hooks/useSongLibrary.ts` | Song fetching/filtering logic |

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/admin/library` route |
| `src/components/AppSidebar.tsx` | Add "Song Library" nav item |

## Technical Details

### Drag-and-Drop Data Flow

```text
1. User starts dragging SongCard
   → onDragStart: set dataTransfer with song.id
   → Visual: card gets reduced opacity

2. User hovers over PlaylistDropZone
   → onDragEnter/onDragOver: highlight drop zone
   → Show "Add to playlist" visual feedback

3. User drops on PlaylistDropZone
   → onDrop: extract song.id from dataTransfer
   → Check if song already in playlist
   → If not: INSERT into playlist_songs with next position
   → Invalidate queries to refresh UI
```

### Query Keys for Cache Management

```text
["admin-songs-library"]     - All songs with metadata
["admin-playlists-zones"]   - Playlists with song counts
["playlist-songs", id]      - Songs in specific playlist
```

### Inline Preview Logic

- Click play button on card → playSong(song) from PlayerContext
- Current song is highlighted with primary color
- Pause button appears when that song is playing

## Keep It Simple (Phase 1)

Initial implementation will NOT include:
- Reordering songs within playlists (future)
- Bulk select/drag multiple songs (future)
- Remove song from playlist via drag (future)
- Batch editing metadata (future)

These can be added incrementally after the core drag-to-add workflow is solid.

## Security Considerations

- All operations use existing RLS policies
- Admins already have INSERT/DELETE on playlist_songs
- No new database changes required
