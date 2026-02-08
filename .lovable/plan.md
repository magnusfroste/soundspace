
# Music Scheduling System for Business

## Overview
Adding Soundtrack-style weekly music scheduling so businesses can pre-program their entire week's music atmosphere. Instead of manually picking playlists, the system will automatically play the right music at the right time.

## The Difference: Personal vs Business

| Personal Player | Business Scheduler |
|-----------------|-------------------|
| Pick a playlist manually | Set it and forget it |
| Play what you want now | Plan ahead for the week |
| One mood at a time | Different moods throughout the day |

## What We'll Build

### 1. Database: Schedule Storage

A new `schedule_entries` table to store time-block assignments:

```text
schedule_entries
├── id (uuid)
├── profile_id (links to business)
├── playlist_id (which playlist to play)
├── day_of_week (0-6, Sunday=0)
├── start_time (e.g., "09:00")
├── end_time (e.g., "12:00")
├── is_active (boolean)
└── created_at / updated_at
```

Each entry represents a colored block like "Breakfast diner 9AM-11AM on Monday".

### 2. Weekly Schedule Page (Business Users)

A new `/schedule` page with a visual weekly calendar:

```text
┌──────────────────────────────────────────────────────┐
│  SCHEDULE                                            │
│  Diner Restaurant                                    │
├────────┬────────┬────────┬────────┬────────┬────────┤
│        │ Mon    │ Tue    │ Wed    │ Thu    │ Fri    │
├────────┼────────┼────────┼────────┼────────┼────────┤
│  9 AM  │ ░░░░░░ │ ░░░░░░ │ ░░░░░░ │ ░░░░░░ │        │
│        │Relaxed │ Jazzy  │Relaxed │ Jazzy  │        │
├────────┼────────┼────────┼────────┼────────┼────────┤
│ 12 PM  │ ░░░░░░ │ ░░░░░░ │ ░░░░░░ │ ░░░░░░ │        │
│        │ Lunch  │ Lunch  │ Lunch  │ Lunch  │        │
├────────┼────────┼────────┼────────┼────────┼────────┤
│  3 PM  │ ░░░░░░ │ ░░░░░░ │ ░░░░░░ │ ░░░░░░ │        │
│        │Jazzy   │ Chill  │ Jazzy  │ Chill  │        │
└────────┴────────┴────────┴────────┴────────┴────────┘
         [+ Add Time Block]      ── Current time indicator
```

Features:
- Visual time grid (hours on left, days across top)
- Colored blocks showing scheduled playlists
- Red line showing current time
- Click to add new blocks
- Drag/resize blocks (future enhancement)

### 3. Auto-Play Engine

The PlayerContext will gain schedule awareness:

```text
Every minute, check:
  1. Is schedule mode enabled?
  2. What's the current day/time?
  3. Which playlist should be playing?
  4. If different from current → switch automatically
```

This runs in the background so when it's noon, the music automatically transitions from "Breakfast" to "Lunch Rush" without anyone touching anything.

### 4. Navigation Updates

Add "Schedule" to the business user sidebar:
- Home
- Playlists
- **Schedule** (new)
- Now Playing

### 5. Profile Enhancement

Add business type to profiles so we can offer relevant defaults:

```text
profiles.business_type: 
  - restaurant
  - retail
  - gym
  - hotel
  - office
  - (etc.)
```

## Implementation Steps

1. **Database Migration**
   - Create `schedule_entries` table
   - Add `business_type` column to profiles
   - RLS policies for business users

2. **Schedule Page UI**
   - Weekly calendar grid component
   - Time block component with playlist info
   - Add/edit block dialog
   - Current time indicator

3. **PlayerContext Enhancement**
   - Add schedule mode toggle
   - Add interval check for current schedule
   - Automatic playlist switching logic

4. **Navigation & Settings**
   - Add Schedule to sidebar
   - Add schedule on/off toggle to settings

## Technical Details

### Schedule Entry Model
```text
{
  id: "uuid",
  profile_id: "uuid",           // Which business
  playlist_id: "uuid",          // Which playlist
  day_of_week: 1,              // 0=Sun, 1=Mon, etc.
  start_time: "09:00",         // 24-hour format
  end_time: "12:00",           // 24-hour format
  color: "#9b87f5",            // Visual identification
  is_active: true
}
```

### Auto-Play Check Logic (runs every 60 seconds)
```text
1. Get current day (0-6) and time (HH:MM)
2. Query schedule_entries WHERE:
   - profile_id = current user's profile
   - day_of_week = today
   - start_time <= now <= end_time
   - is_active = true
3. If found and different from current playlist:
   - Load playlist songs
   - Start playing from beginning
```

### RLS Policies
- Business users can only see/edit their own schedule
- Admins can view all schedules (for support)

## Files to Create/Modify

| File | Action |
|------|--------|
| `schedule_entries` table | Create via migration |
| `src/pages/Schedule.tsx` | New page with weekly calendar |
| `src/components/ScheduleBlock.tsx` | Time block component |
| `src/components/ScheduleDialog.tsx` | Add/edit entry dialog |
| `src/contexts/PlayerContext.tsx` | Add schedule-aware auto-play |
| `src/components/AppSidebar.tsx` | Add Schedule nav item |
| `src/App.tsx` | Add /schedule route |

## Future Enhancements (not in this phase)
- Drag-and-drop block resizing
- Copy day/week schedules
- Holiday exceptions
- Multi-location schedules
- Schedule templates by business type
