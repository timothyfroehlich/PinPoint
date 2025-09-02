/**
 * Supabase Database Schema Types (Generated)
 *
 * Auto-generated from Supabase schema.
 * Contains all table, insert, update, and relationship type definitions.
 *
 * Note: This file contains generated types from `supabase gen types`
 * Do not modify manually - regenerate using database schema commands.
 */

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
            foreignKeyName: "fk_activity_log_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_activity_log_user";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      attachments: {
        Row: {
          created_at: string;
          file_name: string;
          file_path: string;
          file_size: number;
          file_type: string;
          id: string;
          issue_id: string;
          organization_id: string;
          updated_at: string;
          uploaded_by: string;
        };
        Insert: {
          created_at?: string;
          file_name: string;
          file_path: string;
          file_size: number;
          file_type: string;
          id: string;
          issue_id: string;
          organization_id: string;
          updated_at?: string;
          uploaded_by: string;
        };
        Update: {
          created_at?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number;
          file_type?: string;
          id?: string;
          issue_id?: string;
          organization_id?: string;
          updated_at?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_attachments_issue";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_attachments_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_attachments_user";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      collection_types: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id: string;
          name: string;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_collection_types_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      collections: {
        Row: {
          collection_type_id: string;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          collection_type_id: string;
          created_at?: string;
          description?: string | null;
          id: string;
          name: string;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          collection_type_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_collections_collection_type";
            columns: ["collection_type_id"];
            isOneToOne: false;
            referencedRelation: "collection_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_collections_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          anonymous_session_id: string | null;
          content: string;
          created_at: string;
          id: string;
          is_internal: boolean;
          issue_id: string;
          organization_id: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          anonymous_session_id?: string | null;
          content: string;
          created_at?: string;
          id: string;
          is_internal?: boolean;
          issue_id: string;
          organization_id: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          anonymous_session_id?: string | null;
          content?: string;
          created_at?: string;
          id?: string;
          is_internal?: boolean;
          issue_id?: string;
          organization_id?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_comments_issue";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_comments_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_comments_user";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      issue_history: {
        Row: {
          changed_by: string | null;
          changed_from: Json | null;
          changed_to: Json | null;
          created_at: string;
          field_name: string;
          id: string;
          issue_id: string;
          organization_id: string;
        };
        Insert: {
          changed_by?: string | null;
          changed_from?: Json | null;
          changed_to?: Json | null;
          created_at?: string;
          field_name: string;
          id: string;
          issue_id: string;
          organization_id: string;
        };
        Update: {
          changed_by?: string | null;
          changed_from?: Json | null;
          changed_to?: Json | null;
          created_at?: string;
          field_name?: string;
          id?: string;
          issue_id?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_issue_history_changed_by";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_issue_history_issue";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_issue_history_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      issue_statuses: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_closed: boolean;
          is_default: boolean;
          name: string;
          order_index: number;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id: string;
          is_closed?: boolean;
          is_default?: boolean;
          name: string;
          order_index?: number;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_closed?: boolean;
          is_default?: boolean;
          name?: string;
          order_index?: number;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_issue_statuses_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      issues: {
        Row: {
          anonymous_session_id: string | null;
          assigned_to: string | null;
          created_at: string;
          description: string | null;
          id: string;
          machine_id: string;
          moderation_status: Database["public"]["Enums"]["moderation_status"];
          organization_id: string;
          priority_id: string | null;
          reported_by: string | null;
          resolved_at: string | null;
          status_id: string;
          title: string;
          updated_at: string;
          visibility: Database["public"]["Enums"]["visibility"];
        };
        Insert: {
          anonymous_session_id?: string | null;
          assigned_to?: string | null;
          created_at?: string;
          description?: string | null;
          id: string;
          machine_id: string;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          organization_id: string;
          priority_id?: string | null;
          reported_by?: string | null;
          resolved_at?: string | null;
          status_id: string;
          title: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["visibility"];
        };
        Update: {
          anonymous_session_id?: string | null;
          assigned_to?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          machine_id?: string;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          organization_id?: string;
          priority_id?: string | null;
          reported_by?: string | null;
          resolved_at?: string | null;
          status_id?: string;
          title?: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "fk_issues_assigned_to";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_issues_machine";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_issues_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_issues_priority";
            columns: ["priority_id"];
            isOneToOne: false;
            referencedRelation: "priorities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_issues_reported_by";
            columns: ["reported_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_issues_status";
            columns: ["status_id"];
            isOneToOne: false;
            referencedRelation: "issue_statuses";
            referencedColumns: ["id"];
          },
        ];
      };
      locations: {
        Row: {
          address: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_public: boolean | null;
          name: string;
          organization_id: string;
          phone: string | null;
          postal_code: string | null;
          state: string | null;
          street: string | null;
          sync_enabled: boolean;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          description?: string | null;
          id: string;
          is_public?: boolean | null;
          name: string;
          organization_id: string;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          street?: string | null;
          sync_enabled?: boolean;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean | null;
          name?: string;
          organization_id?: string;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          street?: string | null;
          sync_enabled?: boolean;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_locations_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      machine_collections: {
        Row: {
          collection_id: string;
          created_at: string;
          id: string;
          machine_id: string;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          collection_id: string;
          created_at?: string;
          id: string;
          machine_id: string;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          collection_id?: string;
          created_at?: string;
          id?: string;
          machine_id?: string;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_machine_collections_collection";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_machine_collections_machine";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_machine_collections_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      machines: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          location_id: string;
          model_id: string;
          name: string;
          organization_id: string;
          owner_id: string | null;
          qr_code_generated_at: string | null;
          qr_code_id: string | null;
          qr_code_url: string | null;
          serial_number: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id: string;
          location_id: string;
          model_id: string;
          name: string;
          organization_id: string;
          owner_id?: string | null;
          qr_code_generated_at?: string | null;
          qr_code_id?: string | null;
          qr_code_url?: string | null;
          serial_number?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          location_id?: string;
          model_id?: string;
          name?: string;
          organization_id?: string;
          owner_id?: string | null;
          qr_code_generated_at?: string | null;
          qr_code_id?: string | null;
          qr_code_url?: string | null;
          serial_number?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_machines_location";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_machines_model";
            columns: ["model_id"];
            isOneToOne: false;
            referencedRelation: "models";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_machines_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_machines_owner";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          role_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          organization_id: string;
          role_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          role_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_memberships_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_memberships_role";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_memberships_user";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      models: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          manufacturer: string | null;
          name: string;
          organization_id: string;
          updated_at: string;
          year_manufactured: number | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id: string;
          manufacturer?: string | null;
          name: string;
          organization_id: string;
          updated_at?: string;
          year_manufactured?: number | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          manufacturer?: string | null;
          name?: string;
          organization_id?: string;
          updated_at?: string;
          year_manufactured?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_models_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          content: Json;
          created_at: string;
          entity_id: string | null;
          entity_type: Database["public"]["Enums"]["notification_entity"];
          expires_at: string | null;
          id: string;
          is_read: boolean;
          organization_id: string;
          priority: Database["public"]["Enums"]["notification_priority"];
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content: Json;
          created_at?: string;
          entity_id?: string | null;
          entity_type: Database["public"]["Enums"]["notification_entity"];
          expires_at?: string | null;
          id: string;
          is_read?: boolean;
          organization_id: string;
          priority?: Database["public"]["Enums"]["notification_priority"];
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: Json;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: Database["public"]["Enums"]["notification_entity"];
          expires_at?: string | null;
          id?: string;
          is_read?: boolean;
          organization_id?: string;
          priority?: Database["public"]["Enums"]["notification_priority"];
          title?: string;
          type?: Database["public"]["Enums"]["notification_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_notifications_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_notifications_user";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          address: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_public: boolean;
          logo_url: string | null;
          name: string;
          phone: string | null;
          public_issue_creation_enabled: boolean;
          public_issue_default: string;
          subdomain: string;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          description?: string | null;
          id: string;
          is_public?: boolean;
          logo_url?: string | null;
          name: string;
          phone?: string | null;
          public_issue_creation_enabled?: boolean;
          public_issue_default: string;
          subdomain: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          logo_url?: string | null;
          name?: string;
          phone?: string | null;
          public_issue_creation_enabled?: boolean;
          public_issue_default?: string;
          subdomain?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      priorities: {
        Row: {
          color: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_default: boolean;
          name: string;
          order_index: number;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          id: string;
          is_default?: boolean;
          name: string;
          order_index?: number;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          order_index?: number;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_priorities_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          permission_id: string;
          role_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          organization_id: string;
          permission_id: string;
          role_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          permission_id?: string;
          role_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_role_permissions_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_role_permissions_permission";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_role_permissions_role";
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
        Relationships: [
          {
            foreignKeyName: "fk_roles_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      system_settings: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id: string;
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      upvotes: {
        Row: {
          anonymous_session_id: string | null;
          created_at: string;
          id: string;
          issue_id: string;
          organization_id: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          anonymous_session_id?: string | null;
          created_at?: string;
          id: string;
          issue_id: string;
          organization_id: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          anonymous_session_id?: string | null;
          created_at?: string;
          id?: string;
          issue_id?: string;
          organization_id?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_upvotes_issue";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_upvotes_organization";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_upvotes_user";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          bio: string | null;
          created_at: string;
          email: string;
          email_notifications_enabled: boolean;
          email_verified: string | null;
          id: string;
          image: string | null;
          name: string | null;
          notification_frequency: string | null;
          push_notifications_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          email: string;
          email_notifications_enabled?: boolean;
          email_verified?: string | null;
          id: string;
          image?: string | null;
          name?: string | null;
          notification_frequency?: string | null;
          push_notifications_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          email?: string;
          email_notifications_enabled?: boolean;
          email_verified?: string | null;
          id?: string;
          image?: string | null;
          name?: string | null;
          notification_frequency?: string | null;
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
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      moderation_status: "pending" | "approved" | "rejected";
      notification_entity:
        | "issue"
        | "comment"
        | "machine"
        | "location"
        | "user"
        | "organization";
      notification_priority: "low" | "medium" | "high" | "urgent";
      notification_type:
        | "issue_created"
        | "issue_updated"
        | "issue_assigned"
        | "issue_resolved"
        | "comment_added"
        | "machine_added"
        | "machine_updated"
        | "system_alert"
        | "user_invitation"
        | "organization_update";
      visibility: "public" | "organization" | "private";
    };
    CompositeTypes: Record<never, never>;
  };
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never;
