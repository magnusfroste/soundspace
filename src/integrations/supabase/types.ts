export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_generations: {
        Row: {
          audio_url: string | null
          created_at: string | null
          duration: number
          genre: string | null
          id: string
          mood: string | null
          prompt: string
          provider: string
          saved_to_library: boolean | null
          song_id: string | null
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          duration: number
          genre?: string | null
          id?: string
          mood?: string | null
          prompt: string
          provider: string
          saved_to_library?: boolean | null
          song_id?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          duration?: number
          genre?: string | null
          id?: string
          mood?: string | null
          prompt?: string
          provider?: string
          saved_to_library?: boolean | null
          song_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_songs: {
        Row: {
          artist: string
          created_at: string
          duration: number | null
          external_url: string | null
          genre: string | null
          id: string
          metadata: Json | null
          mood: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_feed_id: string | null
          status: string
          title: string
        }
        Insert: {
          artist?: string
          created_at?: string
          duration?: number | null
          external_url?: string | null
          genre?: string | null
          id?: string
          metadata?: Json | null
          mood?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_feed_id?: string | null
          status?: string
          title: string
        }
        Update: {
          artist?: string
          created_at?: string
          duration?: number | null
          external_url?: string | null
          genre?: string | null
          id?: string
          metadata?: Json | null
          mood?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_feed_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_songs_source_feed_id_fkey"
            columns: ["source_feed_id"]
            isOneToOne: false
            referencedRelation: "source_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      play_logs: {
        Row: {
          duration_listened: number | null
          id: string
          played_at: string
          song_id: string
          user_id: string
        }
        Insert: {
          duration_listened?: number | null
          id?: string
          played_at?: string
          song_id: string
          user_id: string
        }
        Update: {
          duration_listened?: number | null
          id?: string
          played_at?: string
          song_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_logs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_songs: {
        Row: {
          added_at: string
          id: string
          playlist_id: string
          position: number
          song_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          playlist_id: string
          position?: number
          song_id: string
        }
        Update: {
          added_at?: string
          id?: string
          playlist_id?: string
          position?: number
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_songs_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          atmospheres: string[] | null
          business_name: string | null
          business_subtype: string | null
          business_type: string | null
          created_at: string
          id: string
          location: string | null
          onboarding_completed: boolean | null
          preferred_genres: string[] | null
          suggested_playlist_ids: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          atmospheres?: string[] | null
          business_name?: string | null
          business_subtype?: string | null
          business_type?: string | null
          created_at?: string
          id?: string
          location?: string | null
          onboarding_completed?: boolean | null
          preferred_genres?: string[] | null
          suggested_playlist_ids?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          atmospheres?: string[] | null
          business_name?: string | null
          business_subtype?: string | null
          business_type?: string | null
          created_at?: string
          id?: string
          location?: string | null
          onboarding_completed?: boolean | null
          preferred_genres?: string[] | null
          suggested_playlist_ids?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schedule_entries: {
        Row: {
          color: string | null
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          playlist_id: string
          profile_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          playlist_id: string
          profile_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          playlist_id?: string
          profile_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_entries_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      songs: {
        Row: {
          artist: string
          bpm: number | null
          cover_url: string | null
          created_at: string
          duration: number
          file_url: string
          genre: string | null
          id: string
          mood: string | null
          origin_source: string | null
          title: string
        }
        Insert: {
          artist?: string
          bpm?: number | null
          cover_url?: string | null
          created_at?: string
          duration?: number
          file_url: string
          genre?: string | null
          id?: string
          mood?: string | null
          origin_source?: string | null
          title: string
        }
        Update: {
          artist?: string
          bpm?: number | null
          cover_url?: string | null
          created_at?: string
          duration?: number
          file_url?: string
          genre?: string | null
          id?: string
          mood?: string | null
          origin_source?: string | null
          title?: string
        }
        Relationships: []
      }
      source_feeds: {
        Row: {
          created_at: string
          feed_type: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          name: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          feed_type?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          feed_type?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "business"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "business"],
    },
  },
} as const
