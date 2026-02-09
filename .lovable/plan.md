# Voice Announcements Feature (Premium)

A premium feature that allows businesses to record voice announcements and schedule them to play randomly during music blocks.

## Architecture

### Database Schema

**announcements** - Stores recorded voice clips
- `id` (UUID, PK)
- `profile_id` (UUID, FK → profiles.id)
- `title` (TEXT)
- `file_url` (TEXT) - URL to audio in storage bucket
- `duration` (INTEGER) - Duration in seconds
- `created_at`, `updated_at` (TIMESTAMP)

**schedule_entry_announcements** - Links announcements to schedule blocks
- `id` (UUID, PK)
- `schedule_entry_id` (UUID, FK → schedule_entries.id)
- `announcement_id` (UUID, FK → announcements.id)
- Unique constraint on (schedule_entry_id, announcement_id)

### Storage

- **Bucket**: `announcements` (public)
- **Path format**: `{profile_id}/{timestamp}-{filename}.webm`

### Settings

- Toggle in Admin Settings (`premium_features.announcements_enabled`)
- Stored in `site_settings` table with key `premium_features`

## User Flow

1. **Admin enables feature** in Site Settings → Premium Features
2. **Business user records announcements** via Announcements page (browser microphone)
3. **User edits a schedule block** and selects which announcements to include
4. **During playback**, announcements play randomly between songs

## Components

- `src/pages/Announcements.tsx` - Main page for recording/managing announcements
- `src/components/announcements/AudioRecorder.tsx` - Recording UI component
- `src/components/schedule/ScheduleDialog.tsx` - Updated to include announcement selection

## Hooks

- `useAnnouncements()` - CRUD operations for announcements
- `useAudioRecorder()` - Browser MediaRecorder integration
- `useScheduleAnnouncements()` - Link/unlink announcements to schedule entries

## Playback Integration (TODO)

The playback engine should:
1. Fetch linked announcements for the current schedule entry
2. Randomly insert announcements between songs
3. Track which announcements have played to ensure variety
