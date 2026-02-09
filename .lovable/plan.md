

# Business Onboarding Flow

A guided onboarding experience that uses AI to match businesses with relevant playlists from your curated library, followed by easy scheduling.

## Overview

The onboarding collects business context (type, sub-type, atmosphere, preferred genres) and uses AI to suggest 2-3 matching playlists from your existing library. After matching, users land on a "Quick Start" view showing their suggested playlists prominently, with an option to explore the full library.

```text
+------------------+    +------------------+    +------------------+
|  Business Type   | -> |   Atmosphere     | -> |   Genre Prefs    |
|  (Bar, Cafe...)  |    |  (Calm, Hip...)  |    |  (Jazz, Pop...)  |
+------------------+    +------------------+    +------------------+
         |                      |                       |
         +----------------------+-----------------------+
                               |
                        +------v------+
                        |  AI Match   |
                        | (Edge Func) |
                        +------+------+
                               |
                   +-----------v-----------+
                   |  2-3 Suggested Playlists  |
                   |  "Perfect for your pub"  |
                   +-----------+---------------+
                               |
                        +------v------+
                        | Quick Start |
                        |   Schedule  |
                        +-------------+
```

## User Flow

### Step 1: Business Type
- Dropdown with categories: Bar, Cafe, Restaurant, Gym, Hotel, Office, Salon, Spa, Store, Medical, Other
- When selected, show sub-type chips (e.g., Bar -> Wine bar, Dive bar, Cocktail bar, Pub, etc.)

### Step 2: Atmosphere (Pick 1-3)
- Chip selection: Calm, Energetic, Luxurious, Modern, Traditional, Casual, Upbeat, Romantic, Hip, Cozy
- Multi-select up to 3

### Step 3: Genre Preferences (Optional)
- Option A: "Let SomHonesto suggest" (AI picks based on business type + atmosphere)
- Option B: Manual selection chips (Jazz, Pop, Electronic, Ambient, Classical, etc.)

### Step 4: AI Matching
- Loading screen: "Finding the perfect playlists for your [business type]..."
- Edge function calls AI to match preferences against playlist metadata

### Step 5: Results
- Display 2-3 matched playlists with reasoning
- "These are now in your library" message
- CTA: "Set up your schedule" or "Start playing"

## Data Model Changes

### Profile Table Updates
Add columns to store onboarding preferences:
- `business_subtype` (text): e.g., "wine_bar", "cocktail_bar"
- `atmospheres` (text[]): array of selected atmosphere tags
- `preferred_genres` (text[]): array of genre preferences
- `onboarding_completed` (boolean): flag to skip onboarding on return
- `suggested_playlist_ids` (uuid[]): AI-suggested playlists for this profile

## Components

### New Files
1. **`src/pages/Onboarding.tsx`** - Multi-step wizard container
2. **`src/components/onboarding/BusinessTypeStep.tsx`** - Business category + sub-type
3. **`src/components/onboarding/AtmosphereStep.tsx`** - Atmosphere chip selection
4. **`src/components/onboarding/GenreStep.tsx`** - Genre preferences
5. **`src/components/onboarding/MatchingStep.tsx`** - Loading + results display
6. **`src/hooks/useOnboarding.ts`** - State management + profile saving

### Edge Function
**`supabase/functions/match-business-playlists/index.ts`**
- Input: business_type, business_subtype, atmospheres, genres, available playlists
- Uses Lovable AI to score and rank playlists
- Returns top 2-3 matches with reasoning

## Post-Onboarding Experience

### Modified Home Page (`/app`)
- **For new users (suggested playlists exist)**: Show "Your Playlists" section prominently with 2-3 matched playlists + "Explore more playlists" link below
- **For existing users**: Current behavior (all playlists visible)

### Playlists Page (`/playlists`)
- Show "Recommended for you" badge on AI-matched playlists
- All playlists remain accessible for full exploration

## Routing Logic

```text
User logs in -> Check profile.onboarding_completed
   |
   +-- false --> /onboarding (multi-step wizard)
   |
   +-- true --> /app (normal home with suggestions highlighted)
```

## Technical Details

### AI Matching Prompt Strategy
The edge function will:
1. Build a profile description from business type + sub-type + atmospheres
2. Describe each playlist (title, category, description, song stats)
3. Ask AI to rank and explain top matches in English

### Playlist Metadata Enhancement
Current playlists have `category` and `description`. The AI can match based on:
- Category keywords (Ambient, Electronic, Corporate)
- Description text
- Song mood/genre distributions (calculated from playlist_songs -> songs)

### Progressive Disclosure
- Onboarding is 3-4 quick steps (under 60 seconds)
- Skip option available on intro screen for power users
- Can always access full library after onboarding

