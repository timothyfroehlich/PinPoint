export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  graphql_public: {
    Tables: Record<never, never>
    Views: Record<never, never>
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
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
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
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
          fk_constraint_name: unknown | null
          fk_schema_name: unknown | null
          fk_table_name: unknown | null
          fk_table_oid: unknown | null
          is_deferrable: boolean | null
          is_deferred: boolean | null
          match_type: string | null
          on_delete: string | null
          on_update: string | null
          pk_columns: unknown[] | null
          pk_constraint_name: unknown | null
          pk_index_name: unknown | null
          pk_schema_name: unknown | null
          pk_table_name: unknown | null
          pk_table_oid: unknown | null
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
          kind: unknown | null
          langoid: unknown | null
          name: unknown | null
          oid: unknown | null
          owner: unknown | null
          returns: string | null
          returns_set: boolean | null
          schema: unknown | null
          volatility: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cleanup: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      _contract_on: {
        Args: { "": string }
        Returns: unknown
      }
      _currtest: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      _db_privs: {
        Args: Record<PropertyKey, never>
        Returns: unknown[]
      }
      _definer: {
        Args: { "": unknown }
        Returns: boolean
      }
      _dexists: {
        Args: { "": unknown }
        Returns: boolean
      }
      _expand_context: {
        Args: { "": string }
        Returns: string
      }
      _expand_on: {
        Args: { "": string }
        Returns: string
      }
      _expand_vol: {
        Args: { "": string }
        Returns: string
      }
      _ext_exists: {
        Args: { "": unknown }
        Returns: boolean
      }
      _extensions: {
        Args: Record<PropertyKey, never> | { "": unknown }
        Returns: unknown[]
      }
      _funkargs: {
        Args: { "": unknown[] }
        Returns: string
      }
      _get: {
        Args: { "": string }
        Returns: number
      }
      _get_db_owner: {
        Args: { "": unknown }
        Returns: unknown
      }
      _get_dtype: {
        Args: { "": unknown }
        Returns: string
      }
      _get_language_owner: {
        Args: { "": unknown }
        Returns: unknown
      }
      _get_latest: {
        Args: { "": string }
        Returns: number[]
      }
      _get_note: {
        Args: { "": number } | { "": string }
        Returns: string
      }
      _get_opclass_owner: {
        Args: { "": unknown }
        Returns: unknown
      }
      _get_rel_owner: {
        Args: { "": unknown }
        Returns: unknown
      }
      _get_schema_owner: {
        Args: { "": unknown }
        Returns: unknown
      }
      _get_tablespace_owner: {
        Args: { "": unknown }
        Returns: unknown
      }
      _get_type_owner: {
        Args: { "": unknown }
        Returns: unknown
      }
      _got_func: {
        Args: { "": unknown }
        Returns: boolean
      }
      _grolist: {
        Args: { "": unknown }
        Returns: unknown[]
      }
      _has_group: {
        Args: { "": unknown }
        Returns: boolean
      }
      _has_role: {
        Args: { "": unknown }
        Returns: boolean
      }
      _has_user: {
        Args: { "": unknown }
        Returns: boolean
      }
      _inherited: {
        Args: { "": unknown }
        Returns: boolean
      }
      _is_schema: {
        Args: { "": unknown }
        Returns: boolean
      }
      _is_super: {
        Args: { "": unknown }
        Returns: boolean
      }
      _is_trusted: {
        Args: { "": unknown }
        Returns: boolean
      }
      _is_verbose: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      _lang: {
        Args: { "": unknown }
        Returns: unknown
      }
      _opc_exists: {
        Args: { "": unknown }
        Returns: boolean
      }
      _parts: {
        Args: { "": unknown }
        Returns: unknown[]
      }
      _pg_sv_type_array: {
        Args: { "": unknown[] }
        Returns: unknown[]
      }
      _prokind: {
        Args: { p_oid: unknown }
        Returns: unknown
      }
      _query: {
        Args: { "": string }
        Returns: string
      }
      _refine_vol: {
        Args: { "": string }
        Returns: string
      }
      _relexists: {
        Args: { "": unknown }
        Returns: boolean
      }
      _returns: {
        Args: { "": unknown }
        Returns: string
      }
      _strict: {
        Args: { "": unknown }
        Returns: boolean
      }
      _table_privs: {
        Args: Record<PropertyKey, never>
        Returns: unknown[]
      }
      _temptypes: {
        Args: { "": string }
        Returns: string
      }
      _todo: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      _vol: {
        Args: { "": unknown }
        Returns: string
      }
      can: {
        Args: { "": unknown[] }
        Returns: string
      }
      casts_are: {
        Args: { "": string[] }
        Returns: string
      }
      cleanup_anonymous_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clear_jwt_context: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      col_is_null: {
        Args:
          | {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
          | { column_name: unknown; description?: string; table_name: unknown }
        Returns: string
      }
      col_not_null: {
        Args:
          | {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
          | { column_name: unknown; description?: string; table_name: unknown }
        Returns: string
      }
      collect_tap: {
        Args: Record<PropertyKey, never> | { "": string[] }
        Returns: string
      }
      diag: {
        Args:
          | Record<PropertyKey, never>
           
          | { msg: string }
          | { msg: unknown }
        Returns: string
      }
      diag_test_name: {
        Args: { "": string }
        Returns: string
      }
      do_tap: {
        Args: Record<PropertyKey, never> | { "": string } | { "": unknown }
        Returns: string[]
      }
      domains_are: {
        Args: { "": unknown[] }
        Returns: string
      }
      enums_are: {
        Args: { "": unknown[] }
        Returns: string
      }
      extensions_are: {
        Args: { "": unknown[] }
        Returns: string
      }
      fail: {
        Args: Record<PropertyKey, never> | { "": string }
        Returns: string
      }
      findfuncs: {
        Args: { "": string }
        Returns: string[]
      }
      finish: {
        Args: { exception_on_failure?: boolean }
        Returns: string[]
      }
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
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          logo_url: string
          name: string
          subdomain: string
        }[]
      }
      foreign_tables_are: {
        Args: { "": unknown[] }
        Returns: string
      }
      functions_are: {
        Args: { "": unknown[] }
        Returns: string
      }
      groups_are: {
        Args: { "": unknown[] }
        Returns: string
      }
      has_check: {
        Args: { "": unknown }
        Returns: string
      }
      has_composite: {
        Args: { "": unknown }
        Returns: string
      }
      has_domain: {
        Args: { "": unknown }
        Returns: string
      }
      has_enum: {
        Args: { "": unknown }
        Returns: string
      }
      has_extension: {
        Args: { "": unknown }
        Returns: string
      }
      has_fk: {
        Args: { "": unknown }
        Returns: string
      }
      has_foreign_table: {
        Args: { "": unknown }
        Returns: string
      }
      has_function: {
        Args: { "": unknown }
        Returns: string
      }
      has_group: {
        Args: { "": unknown }
        Returns: string
      }
      has_inherited_tables: {
        Args: { "": unknown }
        Returns: string
      }
      has_language: {
        Args: { "": unknown }
        Returns: string
      }
      has_materialized_view: {
        Args: { "": unknown }
        Returns: string
      }
      has_opclass: {
        Args: { "": unknown }
        Returns: string
      }
      has_pk: {
        Args: { "": unknown }
        Returns: string
      }
      has_relation: {
        Args: { "": unknown }
        Returns: string
      }
      has_role: {
        Args: { "": unknown }
        Returns: string
      }
      has_schema: {
        Args: { "": unknown }
        Returns: string
      }
      has_sequence: {
        Args: { "": unknown }
        Returns: string
      }
      has_table: {
        Args: { "": unknown }
        Returns: string
      }
      has_tablespace: {
        Args: { "": unknown }
        Returns: string
      }
      has_type: {
        Args: { "": unknown }
        Returns: string
      }
      has_unique: {
        Args: { "": string }
        Returns: string
      }
      has_user: {
        Args: { "": unknown }
        Returns: string
      }
      has_view: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_composite: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_domain: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_enum: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_extension: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_fk: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_foreign_table: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_function: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_group: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_inherited_tables: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_language: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_materialized_view: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_opclass: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_pk: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_relation: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_role: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_schema: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_sequence: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_table: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_tablespace: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_type: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_user: {
        Args: { "": unknown }
        Returns: string
      }
      hasnt_view: {
        Args: { "": unknown }
        Returns: string
      }
      in_todo: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      index_is_primary: {
        Args: { "": unknown }
        Returns: string
      }
      index_is_unique: {
        Args: { "": unknown }
        Returns: string
      }
      is_aggregate: {
        Args: { "": unknown }
        Returns: string
      }
      is_clustered: {
        Args: { "": unknown }
        Returns: string
      }
      is_definer: {
        Args: { "": unknown }
        Returns: string
      }
      is_empty: {
        Args: { "": string }
        Returns: string
      }
      is_normal_function: {
        Args: { "": unknown }
        Returns: string
      }
      is_partitioned: {
        Args: { "": unknown }
        Returns: string
      }
      is_procedure: {
        Args: { "": unknown }
        Returns: string
      }
      is_strict: {
        Args: { "": unknown }
        Returns: string
      }
      is_superuser: {
        Args: { "": unknown }
        Returns: string
      }
      is_window: {
        Args: { "": unknown }
        Returns: string
      }
      isnt_aggregate: {
        Args: { "": unknown }
        Returns: string
      }
      isnt_definer: {
        Args: { "": unknown }
        Returns: string
      }
      isnt_empty: {
        Args: { "": string }
        Returns: string
      }
      isnt_normal_function: {
        Args: { "": unknown }
        Returns: string
      }
      isnt_partitioned: {
        Args: { "": unknown }
        Returns: string
      }
      isnt_procedure: {
        Args: { "": unknown }
        Returns: string
      }
      isnt_strict: {
        Args: { "": unknown }
        Returns: string
      }
      isnt_superuser: {
        Args: { "": unknown }
        Returns: string
      }
      isnt_window: {
        Args: { "": unknown }
        Returns: string
      }
      language_is_trusted: {
        Args: { "": unknown }
        Returns: string
      }
      languages_are: {
        Args: { "": unknown[] }
        Returns: string
      }
      lives_ok: {
        Args: { "": string }
        Returns: string
      }
      materialized_views_are: {
        Args: { "": unknown[] }
        Returns: string
      }
      no_plan: {
        Args: Record<PropertyKey, never>
        Returns: boolean[]
      }
      num_failed: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      ok: {
        Args: { "": boolean }
        Returns: string
      }
      opclasses_are: {
        Args: { "": unknown[] }
        Returns: string
      }
      operators_are: {
        Args: { "": string[] }
        Returns: string
      }
      os_name: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      pass: {
        Args: Record<PropertyKey, never> | { "": string }
        Returns: string
      }
      pg_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      pg_version_num: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      pgtap_version: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      plan: {
        Args: { "": number }
        Returns: string
      }
      roles_are: {
        Args: { "": unknown[] }
        Returns: string
      }
      runtests: {
        Args: Record<PropertyKey, never> | { "": string } | { "": unknown }
        Returns: string[]
      }
      schemas_are: {
        Args: { "": unknown[] }
        Returns: string
      }
      sequences_are: {
        Args: { "": unknown[] }
        Returns: string
      }
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
      skip: {
        Args:
          | { "": number }
          | { "": string }
          | { how_many: number; why: string }
        Returns: string
      }
      tables_are: {
        Args: { "": unknown[] }
        Returns: string
      }
      tablespaces_are: {
        Args: { "": unknown[] }
        Returns: string
      }
      test_email_admin: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      test_email_member1: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      test_email_member2: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      test_id: {
        Args: { prefix: string; suffix?: string }
        Returns: string
      }
      test_issue_id: {
        Args: { suffix?: string }
        Returns: string
      }
      test_location_id: {
        Args: { suffix?: string }
        Returns: string
      }
      test_machine_id: {
        Args: { suffix?: string }
        Returns: string
      }
      test_model_id: {
        Args: { suffix?: string }
        Returns: string
      }
      test_name_admin: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      test_name_member1: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      test_name_member2: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      test_org_competitor: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      test_org_primary: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      test_priority_id: {
        Args: { suffix?: string }
        Returns: string
      }
      test_status_id: {
        Args: { suffix?: string }
        Returns: string
      }
      test_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      test_user_member1: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      test_user_member2: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      throws_ok: {
        Args: { "": string }
        Returns: string
      }
      todo: {
        Args:
          | { how_many: number }
          | { how_many: number; why: string }
           
          | { why: string }
        Returns: boolean[]
      }
      todo_end: {
        Args: Record<PropertyKey, never>
        Returns: boolean[]
      }
      todo_start: {
        Args: Record<PropertyKey, never> | { "": string }
        Returns: boolean[]
      }
      types_are: {
        Args: { "": unknown[] }
        Returns: string
      }
      users_are: {
        Args: { "": unknown[] }
        Returns: string
      }
      views_are: {
        Args: { "": unknown[] }
        Returns: string
      }
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
      status_category: ["NEW", "IN_PROGRESS", "RESOLVED"],
      voter_type: ["authenticated", "anonymous"],
    },
  },
} as const

