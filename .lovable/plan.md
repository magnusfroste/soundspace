
# Custom User Playlists - Premium Feature

## Summary
Add a premium feature that allows business users to create their own personal playlists and populate them either manually by browsing the song library, or automatically via AI based on their mood/style preferences.

---

## User Experience

### How It Works
1. **New Page**: `/my-playlists` - A dedicated page for managing custom playlists
2. **Create Playlist**: Users click "New Playlist" and provide a title + optional description
3. **Fill Playlist**:
   - **Manual**: Browse available songs and add them
   - **AI Fill**: Describe the vibe (e.g., "calm morning coffee shop") and AI selects matching songs
4. **Use in Schedule**: Custom playlists appear in the schedule dropdown alongside admin-curated playlists

### Navigation
- New sidebar item "My Playlists" with Crown icon (premium indicator)
- Only visible when `custom_playlists_enabled` is true in `premium_features`

---

## Technical Implementation

### 1. Database Changes

**New Table: `user_playlists`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| profile_id | uuid | FK to profiles |
| title | text | Required |
| description | text | Optional |
| cover_image_url | text | Optional |
| created_at | timestamp | Default now() |
| updated_at | timestamp | Default now() |

**New Table: `user_playlist_songs`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_playlist_id | uuid | FK to user_playlists |
| song_id | uuid | FK to songs |
| position | integer | For ordering |
| added_at | timestamp | Default now() |

**RLS Policies**
- Users can CRUD their own playlists (profile_id matches)
- Read access to songs table already exists

### 2. Backend Function

**New Edge Function: `ai-fill-playlist`**
- Input: `{ prompt: string, maxSongs: number }`
- Uses Lovable AI (gemini-3-flash) to analyze available songs
- Returns array of song IDs that match the prompt
- Considers song metadata: title, artist, genre, mood

### 3. Frontend Components

**New Files:**
```text
src/pages/MyPlaylists.tsx          # List user's custom playlists
src/pages/MyPlaylistDetail.tsx     # View/edit a single playlist
src/components/user-playlists/
  CreatePlaylistDialog.tsx         # Create new playlist modal
  AddSongsDialog.tsx               # Browse and add songs manually
  AIFillDialog.tsx                 # AI-powered song selection
src/hooks/useUserPlaylists.ts      # Data fetching & mutations
```

**MyPlaylists Page:**
- Grid of user's playlists with cover, title, song count
- "New Playlist" button
- Click to open playlist detail

**MyPlaylistDetail Page:**
- Header with cover, title, description, edit button
- Song list with play, reorder, remove actions
- Floating action buttons: "Add Songs" / "AI Fill"

**AddSongsDialog:**
- Search/filter songs from library
- Click to add to playlist
- Shows which songs are already in the playlist

**AIFillDialog:**
- Text input for describing desired vibe
- Slider for number of songs (5-20)
- Preview results before confirming

### 4. Admin Settings

Add toggle in `AdminSettings.tsx` under Premium Features:
- Icon: `Wand2` or `ListPlus`
- Label: "Custom Playlists"
- Description: "Allow businesses to create and curate their own playlists"

### 5. Schedule Integration

Update `ScheduleDialog.tsx` to include user playlists in the dropdown:
- Fetch both admin playlists and user playlists
- Group them visually: "Curated" / "My Playlists"
- Store reference differently if needed (or use same playlist_id pattern)

---

## File Changes Summary

| Action | File |
|--------|------|
| Create | `supabase/migrations/xxx_user_playlists.sql` |
| Create | `supabase/functions/ai-fill-playlist/index.ts` |
| Create | `src/pages/MyPlaylists.tsx` |
| Create | `src/pages/MyPlaylistDetail.tsx` |
| Create | `src/components/user-playlists/CreatePlaylistDialog.tsx` |
| Create | `src/components/user-playlists/AddSongsDialog.tsx` |
| Create | `src/components/user-playlists/AIFillDialog.tsx` |
| Create | `src/hooks/useUserPlaylists.ts` |
| Edit | `src/App.tsx` - Add routes |
| Edit | `src/components/AppSidebar.tsx` - Add nav item |
| Edit | `src/pages/AdminSettings.tsx` - Add toggle |
| Edit | `src/components/schedule/ScheduleDialog.tsx` - Include user playlists |

---

## Architecture Notes

- **Separation**: User playlists (`user_playlists`) are separate from admin playlists (`playlists`) to maintain data integrity and permission boundaries
- **Song Access**: Users can read all songs (RLS already allows authenticated read) but cannot modify them
- **AI Integration**: Uses existing Lovable AI gateway pattern from `suggest-playlist` function
- **Consistent UI**: Follows same design patterns as Announcements feature (premium badge, toggle, dialog-based creation)
