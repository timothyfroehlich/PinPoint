export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          access_token: string | null
          expires_at: string | null
          id: string
          id_token: string | null
          provider: string
          provider_account_id: string
          refresh_token: string | null
          scope: string | null
          session_state: string | null
          token_type: string | null
          type: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          expires_at?: string | null
          id: string
          id_token?: string | null
          provider: string
          provider_account_id: string
          refresh_token?: string | null
          scope?: string | null
          session_state?: string | null
          token_type?: string | null
          type: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          expires_at?: string | null
          id?: string
          id_token?: string | null
          provider?: string
          provider_account_id?: string
          refresh_token?: string | null
          scope?: string | null
          session_state?: string | null
          token_type?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          organization_id: string
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id: string
          ip_address?: unknown
          organization_id: string
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          organization_id?: string
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_organization_id_organizations_id_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      anonymous_rate_limits: {
        Row: {
          action_type: string
          created_at: string
          id: string
          ip_address: string | null
          organization_id: string
          session_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id: string
          session_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          session_id?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          id: string
          issue_id: string
          organization_id: string
          url: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type: string
          id: string
          issue_id: string
          organization_id: string
          url: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          id?: string
          issue_id?: string
          organization_id?: string
          url?: string
        }
        Relationships: []
      }
      collection_machines: {
        Row: {
          collection_id: string
          created_at: string
          machine_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          machine_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          machine_id?: string
        }
        Relationships: []
      }
      collection_types: {
        Row: {
          created_at: string
          description: string | null
          display_name: string | null
          generation_rules: Json | null
          id: string
          is_auto_generated: boolean
          is_enabled: boolean
          name: string
          organization_id: string
          sort_order: number
          source_field: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name?: string | null
          generation_rules?: Json | null
          id: string
          is_auto_generated?: boolean
          is_enabled?: boolean
          name: string
          organization_id: string
          sort_order?: number
          source_field?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string | null
          generation_rules?: Json | null
          id?: string
          is_auto_generated?: boolean
          is_enabled?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
          source_field?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          filter_criteria: Json | null
          id: string
          is_manual: boolean
          is_smart: boolean
          location_id: string | null
          name: string
          organization_id: string
          sort_order: number
          type_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filter_criteria?: Json | null
          id: string
          is_manual?: boolean
          is_smart?: boolean
          location_id?: string | null
          name: string
          organization_id: string
          sort_order?: number
          type_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filter_criteria?: Json | null
          id?: string
          is_manual?: boolean
          is_smart?: boolean
          location_id?: string | null
          name?: string
          organization_id?: string
          sort_order?: number
          type_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          anonymous_display_name: string | null
          anonymous_session_id: string | null
          author_id: string | null
          commenter_type: Database["public"]["Enums"]["commenter_type"]
          content: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          issue_id: string
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          organization_id: string
          updated_at: string
        }
        Insert: {
          anonymous_display_name?: string | null
          anonymous_session_id?: string | null
          author_id?: string | null
          commenter_type?: Database["public"]["Enums"]["commenter_type"]
          content: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id: string
          issue_id: string
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          organization_id: string
          updated_at?: string
        }
        Update: {
          anonymous_display_name?: string | null
          anonymous_session_id?: string | null
          author_id?: string | null
          commenter_type?: Database["public"]["Enums"]["commenter_type"]
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          issue_id?: string
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role_id: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role_id: string
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role_id?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_organizations_id_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_role_id_roles_id_fk"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_history: {
        Row: {
          actor_id: string | null
          changed_at: string
          field: string
          id: string
          issue_id: string
          new_value: string | null
          old_value: string | null
          organization_id: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          actor_id?: string | null
          changed_at?: string
          field: string
          id: string
          issue_id: string
          new_value?: string | null
          old_value?: string | null
          organization_id: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          actor_id?: string | null
          changed_at?: string
          field?: string
          id?: string
          issue_id?: string
          new_value?: string | null
          old_value?: string | null
          organization_id?: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: []
      }
      issue_statuses: {
        Row: {
          category: Database["public"]["Enums"]["status_category"]
          id: string
          is_default: boolean
          name: string
          organization_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["status_category"]
          id: string
          is_default?: boolean
          name: string
          organization_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["status_category"]
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: []
      }
      issues: {
        Row: {
          anonymous_contact_method: string | null
          anonymous_session_id: string | null
          assigned_to_id: string | null
          checklist: Json | null
          consistency: string | null
          created_at: string
          created_by_id: string | null
          description: string | null
          id: string
          is_public: boolean | null
          machine_id: string
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          organization_id: string
          priority_id: string
          reporter_email: string | null
          reporter_type: Database["public"]["Enums"]["reporter_type"]
          resolved_at: string | null
          severity: Database["public"]["Enums"]["severity"]
          status_id: string
          submitter_name: string | null
          title: string
          updated_at: string
        }
        Insert: {
          anonymous_contact_method?: string | null
          anonymous_session_id?: string | null
          assigned_to_id?: string | null
          checklist?: Json | null
          consistency?: string | null
          created_at?: string
          created_by_id?: string | null
          description?: string | null
          id: string
          is_public?: boolean | null
          machine_id: string
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          organization_id: string
          priority_id: string
          reporter_email?: string | null
          reporter_type?: Database["public"]["Enums"]["reporter_type"]
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["severity"]
          status_id: string
          submitter_name?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          anonymous_contact_method?: string | null
          anonymous_session_id?: string | null
          assigned_to_id?: string | null
          checklist?: Json | null
          consistency?: string | null
          created_at?: string
          created_by_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          machine_id?: string
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          organization_id?: string
          priority_id?: string
          reporter_email?: string | null
          reporter_type?: Database["public"]["Enums"]["reporter_type"]
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["severity"]
          status_id?: string
          submitter_name?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          city: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean | null
          last_sync_at: string | null
          latitude: number | null
          longitude: number | null
          name: string
          organization_id: string
          phone: string | null
          pinball_map_id: number | null
          region_id: string | null
          state: string | null
          street: string | null
          sync_enabled: boolean
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          description?: string | null
          id: string
          is_public?: boolean | null
          last_sync_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          organization_id: string
          phone?: string | null
          pinball_map_id?: number | null
          region_id?: string | null
          state?: string | null
          street?: string | null
          sync_enabled?: boolean
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          last_sync_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          organization_id?: string
          phone?: string | null
          pinball_map_id?: number | null
          region_id?: string | null
          state?: string | null
          street?: string | null
          sync_enabled?: boolean
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      machines: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_public: boolean | null
          location_id: string
          model_id: string
          name: string
          notify_on_comments: boolean
          notify_on_new_issues: boolean
          notify_on_status_changes: boolean
          organization_id: string
          owner_id: string | null
          owner_notifications_enabled: boolean
          qr_code_generated_at: string | null
          qr_code_id: string | null
          qr_code_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          is_public?: boolean | null
          location_id: string
          model_id: string
          name: string
          notify_on_comments?: boolean
          notify_on_new_issues?: boolean
          notify_on_status_changes?: boolean
          organization_id: string
          owner_id?: string | null
          owner_notifications_enabled?: boolean
          qr_code_generated_at?: string | null
          qr_code_id?: string | null
          qr_code_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_public?: boolean | null
          location_id?: string
          model_id?: string
          name?: string
          notify_on_comments?: boolean
          notify_on_new_issues?: boolean
          notify_on_status_changes?: boolean
          organization_id?: string
          owner_id?: string | null
          owner_notifications_enabled?: boolean
          qr_code_generated_at?: string | null
          qr_code_id?: string | null
          qr_code_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          id: string
          organization_id: string
          role_id: string
          user_id: string
        }
        Insert: {
          id: string
          organization_id: string
          role_id: string
          user_id: string
        }
        Update: {
          id?: string
          organization_id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: []
      }
      models: {
        Row: {
          created_at: string
          id: string
          ipdb_id: string | null
          ipdb_link: string | null
          is_active: boolean
          is_custom: boolean
          kineticist_url: string | null
          machine_display: string | null
          machine_type: string | null
          manufacturer: string | null
          name: string
          opdb_id: string | null
          opdb_img_url: string | null
          organization_id: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          created_at?: string
          id: string
          ipdb_id?: string | null
          ipdb_link?: string | null
          is_active?: boolean
          is_custom?: boolean
          kineticist_url?: string | null
          machine_display?: string | null
          machine_type?: string | null
          manufacturer?: string | null
          name: string
          opdb_id?: string | null
          opdb_img_url?: string | null
          organization_id?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          ipdb_id?: string | null
          ipdb_link?: string | null
          is_active?: boolean
          is_custom?: boolean
          kineticist_url?: string | null
          machine_display?: string | null
          machine_type?: string | null
          manufacturer?: string | null
          name?: string
          opdb_id?: string | null
          opdb_img_url?: string | null
          organization_id?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["notification_entity"] | null
          id: string
          message: string
          organization_id: string
          read: boolean
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?:
            | Database["public"]["Enums"]["notification_entity"]
            | null
          id: string
          message: string
          organization_id: string
          read?: boolean
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?:
            | Database["public"]["Enums"]["notification_entity"]
            | null
          id?: string
          message?: string
          organization_id?: string
          read?: boolean
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          address: string | null
          allow_anonymous_comments: boolean
          allow_anonymous_issues: boolean
          allow_anonymous_upvotes: boolean
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          logo_url: string | null
          name: string
          phone: string | null
          public_issue_default: string
          require_moderation_anonymous: boolean
          subdomain: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          allow_anonymous_comments?: boolean
          allow_anonymous_issues?: boolean
          allow_anonymous_upvotes?: boolean
          created_at?: string
          description?: string | null
          id: string
          is_public?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          public_issue_default?: string
          require_moderation_anonymous?: boolean
          subdomain: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          allow_anonymous_comments?: boolean
          allow_anonymous_issues?: boolean
          allow_anonymous_upvotes?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          public_issue_default?: string
          require_moderation_anonymous?: boolean
          subdomain?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          description: string | null
          id: string
          name: string
        }
        Insert: {
          description?: string | null
          id: string
          name: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      pinball_map_configs: {
        Row: {
          api_enabled: boolean
          api_key: string | null
          auto_sync_enabled: boolean
          create_missing_models: boolean
          id: string
          last_global_sync: string | null
          organization_id: string
          sync_interval_hours: number
          update_existing_data: boolean
        }
        Insert: {
          api_enabled?: boolean
          api_key?: string | null
          auto_sync_enabled?: boolean
          create_missing_models?: boolean
          id: string
          last_global_sync?: string | null
          organization_id: string
          sync_interval_hours?: number
          update_existing_data?: boolean
        }
        Update: {
          api_enabled?: boolean
          api_key?: string | null
          auto_sync_enabled?: boolean
          create_missing_models?: boolean
          id?: string
          last_global_sync?: string | null
          organization_id?: string
          sync_interval_hours?: number
          update_existing_data?: boolean
        }
        Relationships: []
      }
      priorities: {
        Row: {
          id: string
          is_default: boolean
          name: string
          order: number
          organization_id: string
        }
        Insert: {
          id: string
          is_default?: boolean
          name: string
          order: number
          organization_id: string
        }
        Update: {
          id?: string
          is_default?: boolean
          name?: string
          order?: number
          organization_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_permissions_id_fk"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_roles_id_fk"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          is_system: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          is_default?: boolean
          is_system?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          is_system?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          expires: string
          id: string
          session_token: string
          user_id: string
        }
        Insert: {
          expires: string
          id: string
          session_token: string
          user_id: string
        }
        Update: {
          expires?: string
          id?: string
          session_token?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          organization_id: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_organization_id_organizations_id_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      upvotes: {
        Row: {
          anonymous_session_id: string | null
          created_at: string
          id: string
          issue_id: string
          user_id: string | null
          voter_type: Database["public"]["Enums"]["voter_type"]
        }
        Insert: {
          anonymous_session_id?: string | null
          created_at?: string
          id: string
          issue_id: string
          user_id?: string | null
          voter_type?: Database["public"]["Enums"]["voter_type"]
        }
        Update: {
          anonymous_session_id?: string | null
          created_at?: string
          id?: string
          issue_id?: string
          user_id?: string | null
          voter_type?: Database["public"]["Enums"]["voter_type"]
        }
        Relationships: []
      }
      users: {
        Row: {
          bio: string | null
          created_at: string
          email: string | null
          email_notifications_enabled: boolean
          email_verified: string | null
          id: string
          image: string | null
          name: string | null
          notification_frequency: Database["public"]["Enums"]["notification_frequency"]
          profile_picture: string | null
          push_notifications_enabled: boolean
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          email?: string | null
          email_notifications_enabled?: boolean
          email_verified?: string | null
          id: string
          image?: string | null
          name?: string | null
          notification_frequency?: Database["public"]["Enums"]["notification_frequency"]
          profile_picture?: string | null
          push_notifications_enabled?: boolean
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          email?: string | null
          email_notifications_enabled?: boolean
          email_verified?: string | null
          id?: string
          image?: string | null
          name?: string | null
          notification_frequency?: Database["public"]["Enums"]["notification_frequency"]
          profile_picture?: string | null
          push_notifications_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      verification_tokens: {
        Row: {
          expires: string
          identifier: string
          token: string
        }
        Insert: {
          expires: string
          identifier: string
          token: string
        }
        Update: {
          expires?: string
          identifier?: string
          token?: string
        }
        Relationships: []
      }
    }
    Views: {
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null
          fk_constraint_name: unknown
          fk_schema_name: unknown
          fk_table_name: unknown
          fk_table_oid: unknown
          is_deferrable: boolean | null
          is_deferred: boolean | null
          match_type: string | null
          on_delete: string | null
          on_update: string | null
          pk_columns: unknown[] | null
          pk_constraint_name: unknown
          pk_index_name: unknown
          pk_schema_name: unknown
          pk_table_name: unknown
          pk_table_oid: unknown
        }
        Relationships: []
      }
      public_organizations_minimal: {
        Row: {
          id: string | null
          logo_url: string | null
          name: string | null
          subdomain: string | null
        }
        Relationships: []
      }
      tap_funky: {
        Row: {
          args: string | null
          is_definer: boolean | null
          is_strict: boolean | null
          is_visible: boolean | null
          kind: unknown
          langoid: unknown
          name: unknown
          oid: unknown
          owner: unknown
          returns: string | null
          returns_set: boolean | null
          schema: unknown
          volatility: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cleanup: { Args: never; Returns: boolean }
      _contract_on: { Args: { "": string }; Returns: unknown }
      _currtest: { Args: never; Returns: number }
      _db_privs: { Args: never; Returns: unknown[] }
      _extensions: { Args: never; Returns: unknown[] }
      _get: { Args: { "": string }; Returns: number }
      _get_latest: { Args: { "": string }; Returns: number[] }
      _get_note: { Args: { "": string }; Returns: string }
      _is_verbose: { Args: never; Returns: boolean }
      _prokind: { Args: { p_oid: unknown }; Returns: unknown }
      _query: { Args: { "": string }; Returns: string }
      _refine_vol: { Args: { "": string }; Returns: string }
      _table_privs: { Args: never; Returns: unknown[] }
      _temptypes: { Args: { "": string }; Returns: string }
      _todo: { Args: never; Returns: string }
      cleanup_anonymous_rate_limits: { Args: never; Returns: undefined }
      clear_jwt_context: { Args: never; Returns: undefined }
      col_is_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
      col_not_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
      diag:
        | {
            Args: { msg: unknown }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { msg: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      diag_test_name: { Args: { "": string }; Returns: string }
      do_tap:
        | { Args: { "": string }; Returns: string[] }
        | { Args: never; Returns: string[] }
      ensure_test_memberships: { Args: never; Returns: undefined }
      fail:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      findfuncs: { Args: { "": string }; Returns: string[] }
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] }
      fn_effective_issue_public: {
        Args: { issue_id: string }
        Returns: boolean
      }
      fn_effective_location_public: {
        Args: { loc_id: string }
        Returns: boolean
      }
      fn_effective_machine_public: {
        Args: { machine_id: string }
        Returns: boolean
      }
      fn_has_permission: {
        Args: { org_id: string; perm_name: string; uid: string }
        Returns: boolean
      }
      fn_is_org_member: {
        Args: { org_id: string; uid: string }
        Returns: boolean
      }
      fn_public_organizations_minimal: {
        Args: never
        Returns: {
          id: string
          logo_url: string
          name: string
          subdomain: string
        }[]
      }
      fn_upsert_membership_admin: {
        Args: { p_org_id: string; p_role_id: string; p_user_id: string }
        Returns: undefined
      }
      has_unique: { Args: { "": string }; Returns: string }
      in_todo: { Args: never; Returns: boolean }
      is_empty: { Args: { "": string }; Returns: string }
      isnt_empty: { Args: { "": string }; Returns: string }
      lives_ok: { Args: { "": string }; Returns: string }
      no_plan: { Args: never; Returns: boolean[] }
      num_failed: { Args: never; Returns: number }
      os_name: { Args: never; Returns: string }
      pass:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      pg_version: { Args: never; Returns: string }
      pg_version_num: { Args: never; Returns: number }
      pgtap_version: { Args: never; Returns: number }
      runtests:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      set_competitor_org_context: {
        Args: { role_name?: string; user_id?: string }
        Returns: undefined
      }
      set_jwt_claims_for_test: {
        Args: {
          org_id: string
          permissions?: string[]
          role_name?: string
          user_id?: string
        }
        Returns: undefined
      }
      set_primary_org_context: {
        Args: { role_name?: string; user_id?: string }
        Returns: undefined
      }
      skip:
        | { Args: { how_many: number; why: string }; Returns: string }
        | { Args: { "": string }; Returns: string }
      test_email_admin: { Args: never; Returns: string }
      test_email_member1: { Args: never; Returns: string }
      test_email_member2: { Args: never; Returns: string }
      test_id: { Args: { prefix: string; suffix?: string }; Returns: string }
      test_issue_id: { Args: { suffix?: string }; Returns: string }
      test_location_id: { Args: { suffix?: string }; Returns: string }
      test_machine_id: { Args: { suffix?: string }; Returns: string }
      test_model_id: { Args: { suffix?: string }; Returns: string }
      test_name_admin: { Args: never; Returns: string }
      test_name_member1: { Args: never; Returns: string }
      test_name_member2: { Args: never; Returns: string }
      test_org_competitor: { Args: never; Returns: string }
      test_org_primary: { Args: never; Returns: string }
      test_priority_id: { Args: { suffix?: string }; Returns: string }
      test_status_id: { Args: { suffix?: string }; Returns: string }
      test_user_admin: { Args: never; Returns: string }
      test_user_member1: { Args: never; Returns: string }
      test_user_member2: { Args: never; Returns: string }
      throws_ok: { Args: { "": string }; Returns: string }
      todo:
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
      todo_end: { Args: never; Returns: boolean[] }
      todo_start:
        | { Args: { "": string }; Returns: boolean[] }
        | { Args: never; Returns: boolean[] }
    }
    Enums: {
      activity_type:
        | "CREATED"
        | "STATUS_CHANGED"
        | "ASSIGNED"
        | "PRIORITY_CHANGED"
        | "COMMENTED"
        | "COMMENT_DELETED"
        | "ATTACHMENT_ADDED"
        | "MERGED"
        | "RESOLVED"
        | "REOPENED"
        | "SYSTEM"
      commenter_type: "authenticated" | "anonymous"
      moderation_status: "pending" | "approved" | "rejected"
      notification_entity: "ISSUE" | "MACHINE" | "COMMENT" | "ORGANIZATION"
      notification_frequency: "IMMEDIATE" | "DAILY" | "WEEKLY" | "NEVER"
      notification_type:
        | "ISSUE_CREATED"
        | "ISSUE_UPDATED"
        | "ISSUE_ASSIGNED"
        | "ISSUE_COMMENTED"
        | "MACHINE_ASSIGNED"
        | "SYSTEM_ANNOUNCEMENT"
      reporter_type: "authenticated" | "anonymous"
      severity: "low" | "medium" | "high" | "critical"
      status_category: "NEW" | "IN_PROGRESS" | "RESOLVED"
      voter_type: "authenticated" | "anonymous"
    }
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_type: [
        "CREATED",
        "STATUS_CHANGED",
        "ASSIGNED",
        "PRIORITY_CHANGED",
        "COMMENTED",
        "COMMENT_DELETED",
        "ATTACHMENT_ADDED",
        "MERGED",
        "RESOLVED",
        "REOPENED",
        "SYSTEM",
      ],
      commenter_type: ["authenticated", "anonymous"],
      moderation_status: ["pending", "approved", "rejected"],
      notification_entity: ["ISSUE", "MACHINE", "COMMENT", "ORGANIZATION"],
      notification_frequency: ["IMMEDIATE", "DAILY", "WEEKLY", "NEVER"],
      notification_type: [
        "ISSUE_CREATED",
        "ISSUE_UPDATED",
        "ISSUE_ASSIGNED",
        "ISSUE_COMMENTED",
        "MACHINE_ASSIGNED",
        "SYSTEM_ANNOUNCEMENT",
      ],
      reporter_type: ["authenticated", "anonymous"],
      severity: ["low", "medium", "high", "critical"],
      status_category: ["NEW", "IN_PROGRESS", "RESOLVED"],
      voter_type: ["authenticated", "anonymous"],
    },
  },
} as const

