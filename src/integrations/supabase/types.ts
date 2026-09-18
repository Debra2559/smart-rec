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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          sources: Json
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          sources?: Json
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          sources?: Json
          user_id?: string
        }
        Relationships: []
      }
      commitments: {
        Row: {
          counterpart: string
          created_at: string
          direction: string
          done: boolean
          due_at: string | null
          id: string
          recording_id: string | null
          text: string
          user_id: string | null
        }
        Insert: {
          counterpart?: string
          created_at?: string
          direction?: string
          done?: boolean
          due_at?: string | null
          id?: string
          recording_id?: string | null
          text: string
          user_id?: string | null
        }
        Update: {
          counterpart?: string
          created_at?: string
          direction?: string
          done?: boolean
          due_at?: string | null
          id?: string
          recording_id?: string | null
          text?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commitments_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      day_summaries: {
        Row: {
          content: string
          created_at: string
          day: string
          id: string
          mood_score: number | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          day: string
          id?: string
          mood_score?: number | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          day?: string
          id?: string
          mood_score?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      emotion_points: {
        Row: {
          created_at: string
          id: string
          label: string
          note: string | null
          recorded_at: string
          user_id: string | null
          valence: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          note?: string | null
          recorded_at: string
          user_id?: string | null
          valence: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          note?: string | null
          recorded_at?: string
          user_id?: string | null
          valence?: number
        }
        Relationships: []
      }
      events: {
        Row: {
          category: string
          created_at: string
          id: string
          mood: string | null
          occurred_at: string
          summary: string
          title: string
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          mood?: string | null
          occurred_at: string
          summary: string
          title: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          mood?: string | null
          occurred_at?: string
          summary?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      growth_reports: {
        Row: {
          content: string
          created_at: string
          habits: Json
          highlights: Json
          id: string
          period_start: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          habits?: Json
          highlights?: Json
          id?: string
          period_start: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          habits?: Json
          highlights?: Json
          id?: string
          period_start?: string
          user_id?: string | null
        }
        Relationships: []
      }
      health_metrics: {
        Row: {
          id: string
          metric: string
          recorded_at: string
          unit: string
          user_id: string | null
          value: number
        }
        Insert: {
          id?: string
          metric: string
          recorded_at: string
          unit: string
          user_id?: string | null
          value: number
        }
        Update: {
          id?: string
          metric?: string
          recorded_at?: string
          unit?: string
          user_id?: string | null
          value?: number
        }
        Relationships: []
      }
      knowledge_items: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          source: string
          source_name: string | null
          tags: string[]
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          source?: string
          source_name?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          source?: string
          source_name?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      people: {
        Row: {
          context: string
          created_at: string
          follow_up: string | null
          id: string
          last_seen_at: string
          mentions: number
          name: string
          relation: string
          user_id: string | null
        }
        Insert: {
          context?: string
          created_at?: string
          follow_up?: string | null
          id?: string
          last_seen_at?: string
          mentions?: number
          name: string
          relation?: string
          user_id?: string | null
        }
        Update: {
          context?: string
          created_at?: string
          follow_up?: string | null
          id?: string
          last_seen_at?: string
          mentions?: number
          name?: string
          relation?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          audio_path: string | null
          created_at: string
          decisions: Json
          duration_sec: number
          id: string
          insights: Json
          mindmap: Json | null
          occurred_at: string
          research_intro: string | null
          research_report: string | null
          research_topics: Json
          source: string
          status: string
          summary: string | null
          tags: string[]
          title: string
          user_id: string | null
        }
        Insert: {
          audio_path?: string | null
          created_at?: string
          decisions?: Json
          duration_sec?: number
          id?: string
          insights?: Json
          mindmap?: Json | null
          occurred_at?: string
          research_intro?: string | null
          research_report?: string | null
          research_topics?: Json
          source?: string
          status?: string
          summary?: string | null
          tags?: string[]
          title: string
          user_id?: string | null
        }
        Update: {
          audio_path?: string | null
          created_at?: string
          decisions?: Json
          duration_sec?: number
          id?: string
          insights?: Json
          mindmap?: Json | null
          occurred_at?: string
          research_intro?: string | null
          research_report?: string | null
          research_topics?: Json
          source?: string
          status?: string
          summary?: string | null
          tags?: string[]
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      speakers: {
        Row: {
          display_name: string
          id: string
          label: string
          user_id: string
        }
        Insert: {
          display_name: string
          id?: string
          label: string
          user_id: string
        }
        Update: {
          display_name?: string
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      todos: {
        Row: {
          created_at: string
          done: boolean
          due_at: string | null
          id: string
          remind_at: string | null
          source: string
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          remind_at?: string | null
          source?: string
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          remind_at?: string | null
          source?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      transcript_segments: {
        Row: {
          end_ms: number
          id: string
          recording_id: string
          seq: number
          speaker_label: string
          start_ms: number
          text: string
        }
        Insert: {
          end_ms: number
          id?: string
          recording_id: string
          seq: number
          speaker_label?: string
          start_ms: number
          text: string
        }
        Update: {
          end_ms?: number
          id?: string
          recording_id?: string
          seq?: number
          speaker_label?: string
          start_ms?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_segments_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_lines: {
        Row: {
          created_at: string
          id: string
          original: string
          seq: number
          session_id: string
          speaker: string
          translated: string
        }
        Insert: {
          created_at?: string
          id?: string
          original: string
          seq?: number
          session_id: string
          speaker?: string
          translated: string
        }
        Update: {
          created_at?: string
          id?: string
          original?: string
          seq?: number
          session_id?: string
          speaker?: string
          translated?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_lines_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "translation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_sessions: {
        Row: {
          created_at: string
          id: string
          mode: string
          source_lang: string
          target_lang: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          source_lang?: string
          target_lang?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          source_lang?: string
          target_lang?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
