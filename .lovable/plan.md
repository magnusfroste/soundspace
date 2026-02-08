
# SomHonesto — App Shell & Persistent Player

## Overview
Build the foundational app shell for "SomHonesto", a B2B royalty-free music streaming service for Brazilian businesses. This phase sets up the database, authentication, premium dark UI, role-aware navigation, and a **fully functional persistent music player** connected to Supabase Storage.

## Visual Identity
- **Premium Dark Mode** theme: deep gray background (#121212), glassmorphism cards, rounded corners
- Vibrant green (#1DB954-style) and purple accents for playback controls and active states
- Clean, modern typography — polished, Spotify-inspired aesthetic

## 1. Supabase Setup & Database Schema
- Connect Lovable Cloud (Supabase)
- Create tables:
  - **user_roles** — stores admin/business roles per user (security best practice, separate from profiles)
  - **profiles** — extends auth.users with business_name, location
  - **songs** — title, artist, genre, mood, duration, file_url (pointing to Supabase Storage), bpm, origin_source
  - **playlists** — title, description, cover_image_url, category
  - **playlist_songs** — join table (playlist_id, song_id, position)
  - **play_logs** — user_id, song_id, played_at, duration_listened
- RLS policies: business users can read songs/playlists, admins can read/write everything
- Create a Supabase Storage bucket for audio files ("songs" bucket, public read)

## 2. Authentication
- Auth page (/auth) with email/password login and signup
- Styled to match the premium dark theme
- After login, redirect to the main app
- Role is checked from user_roles table to determine navigation

## 3. App Shell & Layout
- **Sidebar navigation** (collapsible):
  - **Business users** see: Home, Browse Playlists, Now Playing
  - **Admins** see: Dashboard, Ingestion Engine, Playlists Management, Integration Settings
- **Main content area** — renders routed pages
- **Persistent Player Footer** — always visible at the bottom, outside of the router, so navigation never interrupts playback

## 4. Persistent Music Player (Functional)
- HTML5 Audio element managed via React Context at the layout level
- Player UI: current song info (title, artist, cover), play/pause, next/previous, seek bar, volume control, elapsed/total time
- Fetches real audio files from the Supabase "songs" storage bucket
- Plays songs from a queue; clicking a playlist loads its songs into the queue
- Playback continues seamlessly across page navigation

## 5. Placeholder Pages
- **Home** — welcome message with a few featured playlists (cards linking to playlist detail)
- **Browse Playlists** — grid of playlist cards (fetched from DB)
- **Playlist Detail** — list of songs in a playlist, click to play
- **Admin Dashboard** — placeholder stats cards (active users, top playlists)
- **Ingestion Engine** — placeholder UI for uploading MP3s (will be built out in a later phase)

## What's NOT in this phase
- Full ingestion engine with metadata editing
- Analytics with real data
- Integration/API key management
- Subscription/billing
- Mobile-responsive polish (will be refined later)
