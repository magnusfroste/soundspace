
# Rename Playlists to Simple Energy-Based Names

A quick update to make playlist names intuitive for scheduling. Three existing playlists will be renamed to reflect their energy level rather than context.

## Changes

| Current Name | New Name | Category |
|--------------|----------|----------|
| Relaxed Ambience | **Calm** | Ambient |
| Energetic Beats | **Energy** | Electronic |
| Professional Settings | **Focus** | Corporate |

## Implementation

A single SQL update statement will rename all three playlists using their existing IDs:

```sql
UPDATE playlists SET title = 'Calm' WHERE id = '71b49421-9aa8-4c44-b3b3-0c69c650dd93';
UPDATE playlists SET title = 'Energy' WHERE id = '8e74cc79-db7a-4f65-91b3-5c3f68b00c64';
UPDATE playlists SET title = 'Focus' WHERE id = 'cea36987-29d3-4ea1-a3a2-5334871cc059';
```

## Result

After renaming, the admin playlists page will show:
- **Calm** (Ambient)
- **Energy** (Electronic)
- **Focus** (Corporate)

The descriptions remain unchanged to provide additional context when needed.
