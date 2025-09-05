/* eslint-disable */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  graphql_public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
  public: {
    Tables: {
      accounts: {
        Row: {
          access_token: string | null;
          expires_at: string | null;
          id: string;
          id_token: string | null;
          provider: string;
          provider_account_id: string;
          refresh_token: string | null;
          scope: string | null;
          session_state: string | null;
          token_type: string | null;
          type: string;
          user_id: string;
        };
        Insert: {
          access_token?: string | null;
          expires_at?: string | null;
          id: string;
          id_token?: string | null;
          provider: string;
          provider_account_id: string;
          refresh_token?: string | null;
          scope?: string | null;
          session_state?: string | null;
          token_type?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          access_token?: string | null;
          expires_at?: string | null;
          id?: string;
          id_token?: string | null;
          provider?: string;
          provider_account_id?: string;
          refresh_token?: string | null;
          scope?: string | null;
          session_state?: string | null;
          token_type?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      activity_log: {
        Row: {
          action: string;
          created_at: string;
          details: Json | null;
          entity_id: string | null;
          entity_type: string;
          id: string;
          ip_address: unknown | null;
          organization_id: string;
          severity: string;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          details?: Json | null;
          entity_id?: string | null;
          entity_type: string;
          id: string;
          ip_address?: unknown | null;
          organization_id: string;
          severity?: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          details?: Json | null;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          ip_address?: unknown | null;
          organization_id?: string;
          severity?: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_organization_id_organizations_id_fk";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      anonymous_rate_limits: {
        Row: {
          action_type: string;
          created_at: string;
          id: string;
          ip_address: string | null;
          organization_id: string;
          session_id: string;
        };
        Insert: {
          action_type: string;
          created_at?: string;
          id?: string;
          ip_address?: string | null;
          organization_id: string;
          session_id: string;
        };
        Update: {
          action_type?: string;
          created_at?: string;
          id?: string;
          ip_address?: string | null;
          organization_id?: string;
          session_id?: string;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          created_at: string;
          file_name: string;
          file_type: string;
          id: string;
          issue_id: string;
          organization_id: string;
          url: string;
        };
        Insert: {
          created_at?: string;
          file_name: string;
          file_type: string;
          id: string;
          issue_id: string;
          organization_id: string;
          url: string;
        };
        Update: {
          created_at?: string;
          file_name?: string;
          file_type?: string;
          id?: string;
          issue_id?: string;
          organization_id?: string;
          url?: string;
        };
        Relationships: [];
      };
      collection_machines: {
        Row: {
          collection_id: string;
          created_at: string;
          machine_id: string;
        };
        Insert: {
          collection_id: string;
          created_at?: string;
          machine_id: string;
        };
        Update: {
          collection_id?: string;
          created_at?: string;
          machine_id?: string;
        };
        Relationships: [];
      };
      collection_types: {
        Row: {
          created_at: string;
          description: string | null;
          display_name: string | null;
          generation_rules: Json | null;
          id: string;
          is_auto_generated: boolean;
          is_enabled: boolean;
          name: string;
          organization_id: string;
          sort_order: number;
          source_field: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          display_name?: string | null;
          generation_rules?: Json | null;
          id: string;
          is_auto_generated?: boolean;
          is_enabled?: boolean;
          name: string;
          organization_id: string;
          sort_order?: number;
          source_field?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          display_name?: string | null;
          generation_rules?: Json | null;
          id?: string;
          is_auto_generated?: boolean;
          is_enabled?: boolean;
          name?: string;
          organization_id?: string;
          sort_order?: number;
          source_field?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      collections: {
        Row: {
          created_at: string;
          description: string | null;
          filter_criteria: Json | null;
          id: string;
          is_manual: boolean;
          is_smart: boolean;
          location_id: string | null;
          name: string;
          organization_id: string;
          sort_order: number;
          type_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          filter_criteria?: Json | null;
          id: string;
          is_manual?: boolean;
          is_smart?: boolean;
          location_id?: string | null;
          name: string;
          organization_id: string;
          sort_order?: number;
          type_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          filter_criteria?: Json | null;
          id?: string;
          is_manual?: boolean;
          is_smart?: boolean;
          location_id?: string | null;
          name?: string;
          organization_id?: string;
          sort_order?: number;
          type_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          anonymous_display_name: string | null;
          anonymous_session_id: string | null;
          author_id: string | null;
          commenter_type: Database["public"]["Enums"]["commenter_type"];
          content: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          id: string;
          issue_id: string;
          moderation_status: Database["public"]["Enums"]["moderation_status"];
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          anonymous_display_name?: string | null;
          anonymous_session_id?: string | null;
          author_id?: string | null;
          commenter_type?: Database["public"]["Enums"]["commenter_type"];
          content: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id: string;
          issue_id: string;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          anonymous_display_name?: string | null;
          anonymous_session_id?: string | null;
          author_id?: string | null;
          commenter_type?: Database["public"]["Enums"]["commenter_type"];
          content?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          issue_id?: string;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          organization_id: string;
          role_id: string;
          status: string;
          token: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          organization_id: string;
          role_id: string;
          status?: string;
          token: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          organization_id?: string;
          role_id?: string;
          status?: string;
          token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_organizations_id_fk";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_role_id_roles_id_fk";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      issue_history: {
        Row: {
          actor_id: string | null;
          changed_at: string;
          field: string;
          id: string;
          issue_id: string;
          new_value: string | null;
          old_value: string | null;
          organization_id: string;
          type: Database["public"]["Enums"]["activity_type"];
        };
        Insert: {
          actor_id?: string | null;
          changed_at?: string;
          field: string;
          id: string;
          issue_id: string;
          new_value?: string | null;
          old_value?: string | null;
          organization_id: string;
          type: Database["public"]["Enums"]["activity_type"];
        };
        Update: {
          actor_id?: string | null;
          changed_at?: string;
          field?: string;
          id?: string;
          issue_id?: string;
          new_value?: string | null;
          old_value?: string | null;
          organization_id?: string;
          type?: Database["public"]["Enums"]["activity_type"];
        };
        Relationships: [];
      };
      issue_statuses: {
        Row: {
          category: Database["public"]["Enums"]["status_category"];
          id: string;
          is_default: boolean;
          name: string;
          organization_id: string;
        };
        Insert: {
          category: Database["public"]["Enums"]["status_category"];
          id: string;
          is_default?: boolean;
          name: string;
          organization_id: string;
        };
        Update: {
          category?: Database["public"]["Enums"]["status_category"];
          id?: string;
          is_default?: boolean;
          name?: string;
          organization_id?: string;
        };
        Relationships: [];
      };
      issues: {
        Row: {
          anonymous_contact_method: string | null;
          anonymous_session_id: string | null;
          assigned_to_id: string | null;
          checklist: Json | null;
          consistency: string | null;
          created_at: string;
          created_by_id: string | null;
          description: string | null;
          id: string;
          is_public: boolean | null;
          machine_id: string;
          moderation_status: Database["public"]["Enums"]["moderation_status"];
          organization_id: string;
          priority_id: string;
          reporter_email: string | null;
          reporter_type: Database["public"]["Enums"]["reporter_type"];
          resolved_at: string | null;
          severity: Database["public"]["Enums"]["severity"];
          status_id: string;
          submitter_name: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          anonymous_contact_method?: string | null;
          anonymous_session_id?: string | null;
          assigned_to_id?: string | null;
          checklist?: Json | null;
          consistency?: string | null;
          created_at?: string;
          created_by_id?: string | null;
          description?: string | null;
          id: string;
          is_public?: boolean | null;
          machine_id: string;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          organization_id: string;
          priority_id: string;
          reporter_email?: string | null;
          reporter_type?: Database["public"]["Enums"]["reporter_type"];
          resolved_at?: string | null;
          severity?: Database["public"]["Enums"]["severity"];
          status_id: string;
          submitter_name?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          anonymous_contact_method?: string | null;
          anonymous_session_id?: string | null;
          assigned_to_id?: string | null;
          checklist?: Json | null;
          consistency?: string | null;
          created_at?: string;
          created_by_id?: string | null;
          description?: string | null;
          id?: string;
          is_public?: boolean | null;
          machine_id?: string;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          organization_id?: string;
          priority_id?: string;
          reporter_email?: string | null;
          reporter_type?: Database["public"]["Enums"]["reporter_type"];
          resolved_at?: string | null;
          severity?: Database["public"]["Enums"]["severity"];
          status_id?: string;
          submitter_name?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          city: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_public: boolean | null;
          last_sync_at: string | null;
          latitude: number | null;
          longitude: number | null;
          name: string;
          organization_id: string;
          phone: string | null;
          pinball_map_id: number | null;
          region_id: string | null;
          state: string | null;
          street: string | null;
          sync_enabled: boolean;
          updated_at: string;
          website: string | null;
          zip: string | null;
        };
        Insert: {
          city?: string | null;
          created_at?: string;
          description?: string | null;
          id: string;
          is_public?: boolean | null;
          last_sync_at?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          organization_id: string;
          phone?: string | null;
          pinball_map_id?: number | null;
          region_id?: string | null;
          state?: string | null;
          street?: string | null;
          sync_enabled?: boolean;
          updated_at?: string;
          website?: string | null;
          zip?: string | null;
        };
        Update: {
          city?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean | null;
          last_sync_at?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          organization_id?: string;
          phone?: string | null;
          pinball_map_id?: number | null;
          region_id?: string | null;
          state?: string | null;
          street?: string | null;
          sync_enabled?: boolean;
          updated_at?: string;
          website?: string | null;
          zip?: string | null;
        };
        Relationships: [];
      };
      machines: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_public: boolean | null;
          location_id: string;
          model_id: string;
          name: string;
          notify_on_comments: boolean;
          notify_on_new_issues: boolean;
          notify_on_status_changes: boolean;
          organization_id: string;
          owner_id: string | null;
          owner_notifications_enabled: boolean;
          qr_code_generated_at: string | null;
          qr_code_id: string | null;
          qr_code_url: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          is_public?: boolean | null;
          location_id: string;
          model_id: string;
          name: string;
          notify_on_comments?: boolean;
          notify_on_new_issues?: boolean;
          notify_on_status_changes?: boolean;
          organization_id: string;
          owner_id?: string | null;
          owner_notifications_enabled?: boolean;
          qr_code_generated_at?: string | null;
          qr_code_id?: string | null;
          qr_code_url?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_public?: boolean | null;
          location_id?: string;
          model_id?: string;
          name?: string;
          notify_on_comments?: boolean;
          notify_on_new_issues?: boolean;
          notify_on_status_changes?: boolean;
          organization_id?: string;
          owner_id?: string | null;
          owner_notifications_enabled?: boolean;
          qr_code_generated_at?: string | null;
          qr_code_id?: string | null;
          qr_code_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          organization_id: string;
          role_id: string;
          user_id: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          role_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          role_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      models: {
        Row: {
          created_at: string;
          id: string;
          ipdb_id: string | null;
          ipdb_link: string | null;
          is_active: boolean;
          is_custom: boolean;
          kineticist_url: string | null;
          machine_display: string | null;
          machine_type: string | null;
          manufacturer: string | null;
          name: string;
          opdb_id: string | null;
          opdb_img_url: string | null;
          organization_id: string | null;
          updated_at: string;
          year: number | null;
        };
        Insert: {
          created_at?: string;
          id: string;
          ipdb_id?: string | null;
          ipdb_link?: string | null;
          is_active?: boolean;
          is_custom?: boolean;
          kineticist_url?: string | null;
          machine_display?: string | null;
          machine_type?: string | null;
          manufacturer?: string | null;
          name: string;
          opdb_id?: string | null;
          opdb_img_url?: string | null;
          organization_id?: string | null;
          updated_at?: string;
          year?: number | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          ipdb_id?: string | null;
          ipdb_link?: string | null;
          is_active?: boolean;
          is_custom?: boolean;
          kineticist_url?: string | null;
          machine_display?: string | null;
          machine_type?: string | null;
          manufacturer?: string | null;
          name?: string;
          opdb_id?: string | null;
          opdb_img_url?: string | null;
          organization_id?: string | null;
          updated_at?: string;
          year?: number | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          action_url: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type:
            | Database["public"]["Enums"]["notification_entity"]
            | null;
          id: string;
          message: string;
          organization_id: string;
          read: boolean;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        Insert: {
          action_url?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?:
            | Database["public"]["Enums"]["notification_entity"]
            | null;
          id: string;
          message: string;
          organization_id: string;
          read?: boolean;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        Update: {
          action_url?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?:
            | Database["public"]["Enums"]["notification_entity"]
            | null;
          id?: string;
          message?: string;
          organization_id?: string;
          read?: boolean;
          type?: Database["public"]["Enums"]["notification_type"];
          user_id?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          address: string | null;
          allow_anonymous_comments: boolean;
          allow_anonymous_issues: boolean;
          allow_anonymous_upvotes: boolean;
          created_at: string;
          description: string | null;
          id: string;
          is_public: boolean;
          logo_url: string | null;
          name: string;
          phone: string | null;
          public_issue_default: string;
          require_moderation_anonymous: boolean;
          subdomain: string;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          allow_anonymous_comments?: boolean;
          allow_anonymous_issues?: boolean;
          allow_anonymous_upvotes?: boolean;
          created_at?: string;
          description?: string | null;
          id: string;
          is_public?: boolean;
          logo_url?: string | null;
          name: string;
          phone?: string | null;
          public_issue_default?: string;
          require_moderation_anonymous?: boolean;
          subdomain: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          allow_anonymous_comments?: boolean;
          allow_anonymous_issues?: boolean;
          allow_anonymous_upvotes?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          logo_url?: string | null;
          name?: string;
          phone?: string | null;
          public_issue_default?: string;
          require_moderation_anonymous?: boolean;
          subdomain?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          description: string | null;
          id: string;
          name: string;
        };
        Insert: {
          description?: string | null;
          id: string;
          name: string;
        };
        Update: {
          description?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      pinball_map_configs: {
        Row: {
          api_enabled: boolean;
          api_key: string | null;
          auto_sync_enabled: boolean;
          create_missing_models: boolean;
          id: string;
          last_global_sync: string | null;
          organization_id: string;
          sync_interval_hours: number;
          update_existing_data: boolean;
        };
        Insert: {
          api_enabled?: boolean;
          api_key?: string | null;
          auto_sync_enabled?: boolean;
          create_missing_models?: boolean;
          id: string;
          last_global_sync?: string | null;
          organization_id: string;
          sync_interval_hours?: number;
          update_existing_data?: boolean;
        };
        Update: {
          api_enabled?: boolean;
          api_key?: string | null;
          auto_sync_enabled?: boolean;
          create_missing_models?: boolean;
          id?: string;
          last_global_sync?: string | null;
          organization_id?: string;
          sync_interval_hours?: number;
          update_existing_data?: boolean;
        };
        Relationships: [];
      };
      priorities: {
        Row: {
          id: string;
          is_default: boolean;
          name: string;
          order: number;
          organization_id: string;
        };
        Insert: {
          id: string;
          is_default?: boolean;
          name: string;
          order: number;
          organization_id: string;
        };
        Update: {
          id?: string;
          is_default?: boolean;
          name?: string;
          order?: number;
          organization_id?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          permission_id: string;
          role_id: string;
        };
        Insert: {
          permission_id: string;
          role_id: string;
        };
        Update: {
          permission_id?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_permissions_id_fk";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_permissions_role_id_roles_id_fk";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          created_at: string;
          id: string;
          is_default: boolean;
          is_system: boolean;
          name: string;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          is_default?: boolean;
          is_system?: boolean;
          name: string;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_default?: boolean;
          is_system?: boolean;
          name?: string;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          expires: string;
          id: string;
          session_token: string;
          user_id: string;
        };
        Insert: {
          expires: string;
          id: string;
          session_token: string;
          user_id: string;
        };
        Update: {
          expires?: string;
          id?: string;
          session_token?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      system_settings: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          setting_key: string;
          setting_value: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          organization_id: string;
          setting_key: string;
          setting_value: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          setting_key?: string;
          setting_value?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "system_settings_organization_id_organizations_id_fk";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      upvotes: {
        Row: {
          anonymous_session_id: string | null;
          created_at: string;
          id: string;
          issue_id: string;
          user_id: string | null;
          voter_type: Database["public"]["Enums"]["voter_type"];
        };
        Insert: {
          anonymous_session_id?: string | null;
          created_at?: string;
          id: string;
          issue_id: string;
          user_id?: string | null;
          voter_type?: Database["public"]["Enums"]["voter_type"];
        };
        Update: {
          anonymous_session_id?: string | null;
          created_at?: string;
          id?: string;
          issue_id?: string;
          user_id?: string | null;
          voter_type?: Database["public"]["Enums"]["voter_type"];
        };
        Relationships: [];
      };
      users: {
        Row: {
          bio: string | null;
          created_at: string;
          email: string | null;
          email_notifications_enabled: boolean;
          email_verified: string | null;
          id: string;
          image: string | null;
          name: string | null;
          notification_frequency: Database["public"]["Enums"]["notification_frequency"];
          profile_picture: string | null;
          push_notifications_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          email?: string | null;
          email_notifications_enabled?: boolean;
          email_verified?: string | null;
          id: string;
          image?: string | null;
          name?: string | null;
          notification_frequency?: Database["public"]["Enums"]["notification_frequency"];
          profile_picture?: string | null;
          push_notifications_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          email?: string | null;
          email_notifications_enabled?: boolean;
          email_verified?: string | null;
          id?: string;
          image?: string | null;
          name?: string | null;
          notification_frequency?: Database["public"]["Enums"]["notification_frequency"];
          profile_picture?: string | null;
          push_notifications_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      verification_tokens: {
        Row: {
          expires: string;
          identifier: string;
          token: string;
        };
        Insert: {
          expires: string;
          identifier: string;
          token: string;
        };
        Update: {
          expires?: string;
          identifier?: string;
          token?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      public_organizations_minimal: {
        Row: {
          id: string | null;
          logo_url: string | null;
          name: string | null;
          subdomain: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      cleanup_anonymous_rate_limits: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      fn_effective_issue_public: {
        Args: { issue_id: string };
        Returns: boolean;
      };
      fn_effective_location_public: {
        Args: { loc_id: string };
        Returns: boolean;
      };
      fn_effective_machine_public: {
        Args: { machine_id: string };
        Returns: boolean;
      };
      fn_has_permission: {
        Args: { org_id: string; perm_name: string; uid: string };
        Returns: boolean;
      };
      fn_is_org_member: {
        Args: { org_id: string; uid: string };
        Returns: boolean;
      };
      fn_public_organizations_minimal: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          logo_url: string;
          name: string;
          subdomain: string;
        }[];
      };
    };
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
        | "SYSTEM";
      commenter_type: "authenticated" | "anonymous";
      moderation_status: "pending" | "approved" | "rejected";
      notification_entity: "ISSUE" | "MACHINE" | "COMMENT" | "ORGANIZATION";
      notification_frequency: "IMMEDIATE" | "DAILY" | "WEEKLY" | "NEVER";
      notification_type:
        | "ISSUE_CREATED"
        | "ISSUE_UPDATED"
        | "ISSUE_ASSIGNED"
        | "ISSUE_COMMENTED"
        | "MACHINE_ASSIGNED"
        | "SYSTEM_ANNOUNCEMENT";
      reporter_type: "authenticated" | "anonymous";
      severity: "low" | "medium" | "high" | "critical";
      status_category: "NEW" | "IN_PROGRESS" | "RESOLVED";
      voter_type: "authenticated" | "anonymous";
    };
    CompositeTypes: Record<never, never>;
  };
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

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
} as const;
