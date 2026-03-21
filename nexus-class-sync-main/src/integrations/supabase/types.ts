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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      auth_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          is_active: boolean
          last_activity: string
          refresh_token: string
          school_id: string
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity?: string
          refresh_token: string
          school_id: string
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity?: string
          refresh_token?: string
          school_id?: string
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      class_students: {
        Row: {
          class_id: string
          id: string
          joined_at: string
          student_id: string
        }
        Insert: {
          class_id: string
          id?: string
          joined_at?: string
          student_id: string
        }
        Update: {
          class_id?: string
          id?: string
          joined_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "school_users"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          class_code: string
          class_name: string
          created_at: string
          expires_at: string | null
          id: string
          school_id: string
          teacher_id: string
        }
        Insert: {
          class_code: string
          class_name: string
          created_at?: string
          expires_at?: string | null
          id?: string
          school_id: string
          teacher_id: string
        }
        Update: {
          class_code?: string
          class_name?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          school_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "school_users"
            referencedColumns: ["id"]
          },
        ]
      }
      control_center_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          last_activity: string | null
          session_token: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          last_activity?: string | null
          session_token: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          last_activity?: string | null
          session_token?: string
        }
        Relationships: []
      }
      login_logs: {
        Row: {
          id: string
          ip_address: string | null
          logged_in_at: string
          login_type: string
          school_id: string
          user_id: string | null
          username: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          login_type: string
          school_id: string
          user_id?: string | null
          username: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          login_type?: string
          school_id?: string
          user_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "login_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "school_users"
            referencedColumns: ["id"]
          },
        ]
      }
      role_audit_log: {
        Row: {
          action: string
          id: string
          performed_at: string
          performed_by: string | null
          reason: string | null
          role: Database["public"]["Enums"]["app_role"]
          school_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          id?: string
          performed_at?: string
          performed_by?: string | null
          reason?: string | null
          role: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          id?: string
          performed_at?: string
          performed_by?: string | null
          reason?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      school_users: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          password: string
          school_id: string
          user_type: string
          username: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          password: string
          school_id: string
          user_type: string
          username: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          password?: string
          school_id?: string
          user_type?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_users_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string
          admin_password: string
          admin_username: string
          created_at: string
          id: string
          is_active: boolean
          school_code: string
          school_end_time: string
          school_name: string
          school_start_time: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address: string
          admin_password: string
          admin_username: string
          created_at?: string
          id?: string
          is_active?: boolean
          school_code: string
          school_end_time?: string
          school_name: string
          school_start_time?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          admin_password?: string
          admin_username?: string
          created_at?: string
          id?: string
          is_active?: boolean
          school_code?: string
          school_end_time?: string
          school_name?: string
          school_start_time?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_devices: {
        Row: {
          connection_status: string | null
          created_at: string | null
          device_name: string
          device_type: string
          id: string
          is_connected: boolean | null
          last_connected: string | null
          last_detected_at: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          connection_status?: string | null
          created_at?: string | null
          device_name: string
          device_type: string
          id?: string
          is_connected?: boolean | null
          last_connected?: string | null
          last_detected_at?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          connection_status?: string | null
          created_at?: string | null
          device_name?: string
          device_type?: string
          id?: string
          is_connected?: boolean | null
          last_connected?: string | null
          last_detected_at?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_devices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          audio_level: number | null
          class_id: string | null
          created_at: string | null
          full_name: string
          id: string
          is_online: boolean | null
          last_audio_update: string | null
          last_seen: string | null
          password: string | null
          school_id: string
          updated_at: string | null
          username: string
        }
        Insert: {
          audio_level?: number | null
          class_id?: string | null
          created_at?: string | null
          full_name: string
          id?: string
          is_online?: boolean | null
          last_audio_update?: string | null
          last_seen?: string | null
          password?: string | null
          school_id: string
          updated_at?: string | null
          username: string
        }
        Update: {
          audio_level?: number | null
          class_id?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          is_online?: boolean | null
          last_audio_update?: string | null
          last_seen?: string | null
          password?: string | null
          school_id?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_students_class_id"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_students_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authenticate_admin_secure: {
        Args: {
          p_admin_username: string
          p_password: string
          p_school_code: string
        }
        Returns: {
          admin_username: string
          school_id: string
          school_name: string
        }[]
      }
      authenticate_school_admin: {
        Args: { p_password: string; p_school_code: string; p_username: string }
        Returns: {
          admin_username: string
          is_active: boolean
          school_id: string
          school_name: string
        }[]
      }
      authenticate_school_admin_v2: {
        Args: { p_password: string; p_school_code: string; p_username: string }
        Returns: {
          admin_username: string
          is_authenticated: boolean
          school_id: string
          school_name: string
        }[]
      }
      authenticate_school_user: {
        Args: {
          p_password: string
          p_school_code: string
          p_user_type: string
          p_username: string
        }
        Returns: {
          full_name: string
          school_id: string
          user_id: string
          user_type: string
          username: string
        }[]
      }
      authenticate_school_user_secure: {
        Args: {
          p_password: string
          p_school_code: string
          p_user_type: string
          p_username: string
        }
        Returns: {
          full_name: string
          school_id: string
          user_id: string
          user_type: string
          username: string
        }[]
      }
      authenticate_student: {
        Args: { p_class_code: string; p_username: string }
        Returns: {
          class_code: string
          class_id: string
          class_name: string
          full_name: string
          school_id: string
          student_id: string
          username: string
        }[]
      }
      authenticate_student_secure: {
        Args: { p_class_code: string; p_password: string; p_username: string }
        Returns: {
          class_code: string
          class_id: string
          class_name: string
          full_name: string
          school_id: string
          student_id: string
          username: string
        }[]
      }
      authenticate_user_secure: {
        Args: {
          p_password: string
          p_school_code: string
          p_user_type: string
          p_username: string
        }
        Returns: {
          full_name: string
          school_id: string
          school_name: string
          user_id: string
          user_type: string
          username: string
        }[]
      }
      can_view_admin_credentials: {
        Args: { target_school_id: string }
        Returns: boolean
      }
      class_belongs_to_school: {
        Args: { p_class_id: string; p_school_id: string }
        Returns: boolean
      }
      cleanup_expired_classes: { Args: never; Returns: number }
      cleanup_expired_sessions: { Args: never; Returns: number }
      clear_current_user: { Args: never; Returns: undefined }
      create_control_center_session: {
        Args: { p_password: string; p_username: string }
        Returns: {
          expires_at: string
          session_token: string
        }[]
      }
      create_school_secure: {
        Args: {
          p_address: string
          p_admin_password: string
          p_admin_username: string
          p_school_code: string
          p_school_name: string
        }
        Returns: string
      }
      create_school_user:
        | {
            Args: {
              p_full_name: string
              p_password: string
              p_school_id: string
              p_user_type: string
              p_username: string
            }
            Returns: string
          }
        | {
            Args: {
              p_admin_school_code: string
              p_admin_username: string
              p_full_name: string
              p_password: string
              p_school_id: string
              p_user_type: string
              p_username: string
            }
            Returns: string
          }
        | {
            Args: {
              p_full_name: string
              p_password: string
              p_school_id: string
              p_session_token: string
              p_user_type: string
              p_username: string
            }
            Returns: string
          }
      create_school_with_session: {
        Args: {
          p_address: string
          p_admin_password: string
          p_admin_username: string
          p_school_code: string
          p_school_end_time?: string
          p_school_name: string
          p_school_start_time?: string
          p_session_token: string
          p_timezone?: string
        }
        Returns: string
      }
      create_teacher_class:
        | {
            Args: {
              p_class_code: string
              p_class_name: string
              p_school_id: string
              p_teacher_id: string
            }
            Returns: {
              class_code: string
              class_name: string
              created_at: string
              expires_at: string | null
              id: string
              school_id: string
              teacher_id: string
            }
            SetofOptions: {
              from: "*"
              to: "classes"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_class_code: string
              p_class_name: string
              p_expires_at?: string
              p_school_id: string
              p_teacher_id: string
            }
            Returns: {
              class_code: string
              class_name: string
              created_at: string
              expires_at: string | null
              id: string
              school_id: string
              teacher_id: string
            }[]
            SetofOptions: {
              from: "*"
              to: "classes"
              isOneToOne: false
              isSetofReturn: true
            }
          }
      current_user_id: { Args: never; Returns: string }
      debug_authentication: {
        Args: {
          p_password: string
          p_school_code: string
          p_user_type: string
          p_username: string
        }
        Returns: {
          password_matches: boolean
          school_active: boolean
          school_exists: boolean
          stored_password: string
          user_exists: boolean
          user_id: string
        }[]
      }
      delete_school_user:
        | {
            Args: {
              p_school_id: string
              p_session_token: string
              p_user_id: string
            }
            Returns: boolean
          }
        | { Args: { p_school_id: string; p_user_id: string }; Returns: boolean }
        | {
            Args: {
              p_admin_school_code: string
              p_admin_username: string
              p_school_id: string
              p_user_id: string
            }
            Returns: boolean
          }
      delete_school_with_session: {
        Args: { p_school_id: string; p_session_token: string }
        Returns: boolean
      }
      delete_teacher_class: {
        Args: { p_class_id: string; p_teacher_id: string }
        Returns: boolean
      }
      ensure_student_record: {
        Args: {
          p_full_name: string
          p_school_id: string
          p_user_id: string
          p_username: string
        }
        Returns: undefined
      }
      get_class_students: {
        Args: { p_class_id: string; p_teacher_id: string }
        Returns: {
          audio_level: number
          class_id: string
          created_at: string
          full_name: string
          id: string
          is_online: boolean
          last_audio_update: string
          last_seen: string
          school_id: string
          updated_at: string
          username: string
        }[]
      }
      get_current_user_profile: {
        Args: never
        Returns: {
          created_at: string
          full_name: string
          id: string
          school_id: string
          user_type: string
          username: string
        }[]
      }
      get_school_basic_info: {
        Args: { p_school_code: string }
        Returns: {
          is_active: boolean
          school_code: string
          school_name: string
        }[]
      }
      get_school_by_code: {
        Args: { p_school_code: string }
        Returns: {
          id: string
          is_active: boolean
          school_code: string
          school_end_time: string
          school_name: string
          school_start_time: string
          timezone: string
        }[]
      }
      get_school_info_for_auth: {
        Args: { p_school_code: string }
        Returns: {
          is_active: boolean
          school_code: string
          school_name: string
        }[]
      }
      get_school_info_secure: {
        Args: { p_school_code: string }
        Returns: {
          is_active: boolean
          school_code: string
          school_name: string
        }[]
      }
      get_school_users:
        | {
            Args: { p_school_id: string }
            Returns: {
              created_at: string
              full_name: string
              id: string
              user_type: string
              username: string
            }[]
          }
        | {
            Args: {
              p_admin_school_code: string
              p_admin_username: string
              p_school_id: string
            }
            Returns: {
              created_at: string
              full_name: string
              id: string
              user_type: string
              username: string
            }[]
          }
        | {
            Args: { p_school_id: string; p_session_token: string }
            Returns: {
              created_at: string
              full_name: string
              id: string
              user_type: string
              username: string
            }[]
          }
      get_schools_safe: {
        Args: never
        Returns: {
          address: string
          admin_username: string
          created_at: string
          id: string
          is_active: boolean
          school_code: string
          school_name: string
          updated_at: string
        }[]
      }
      get_schools_with_session: {
        Args: { p_session_token: string }
        Returns: {
          address: string
          admin_username: string
          created_at: string
          id: string
          is_active: boolean
          school_code: string
          school_end_time: string
          school_name: string
          school_start_time: string
          timezone: string
          updated_at: string
        }[]
      }
      get_student_profile: {
        Args: { p_student_id: string }
        Returns: {
          audio_level: number
          class_code: string
          class_id: string
          class_name: string
          full_name: string
          id: string
          is_online: boolean
          last_seen: string
          school_id: string
          username: string
        }[]
      }
      get_student_school_id: { Args: { p_student_id: string }; Returns: string }
      get_teacher_classes: {
        Args: { p_teacher_id: string }
        Returns: {
          class_code: string
          class_name: string
          created_at: string
          expires_at: string | null
          id: string
          school_id: string
          teacher_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "classes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_school_id: { Args: { user_uuid: string }; Returns: string }
      get_user_type: { Args: { user_uuid: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_school: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _school_id: string
          _user_id: string
        }
        Returns: boolean
      }
      hash_password: { Args: { password_text: string }; Returns: string }
      invalidate_session: {
        Args: { p_session_token: string }
        Returns: boolean
      }
      is_admin_for_school: {
        Args: { p_school_id: string; p_user_id: string }
        Returns: boolean
      }
      is_current_student_member: {
        Args: { target_class_id: string }
        Returns: boolean
      }
      is_school_admin: {
        Args: { admin_user_id: string; target_school_id: string }
        Returns: boolean
      }
      is_superadmin: { Args: never; Returns: boolean }
      is_teacher_in_school: {
        Args: { target_school_id: string; teacher_user_id: string }
        Returns: boolean
      }
      is_teacher_of_class: {
        Args: { target_class_id: string; teacher_user_id: string }
        Returns: boolean
      }
      is_within_school_hours: {
        Args: { p_school_id: string }
        Returns: boolean
      }
      kick_student_from_class: {
        Args: { p_class_id: string; p_student_id: string; p_teacher_id: string }
        Returns: boolean
      }
      ping: { Args: never; Returns: boolean }
      search_school_classes: {
        Args: { p_query: string; p_teacher_id: string }
        Returns: {
          class_code: string
          class_name: string
          created_at: string
          expires_at: string | null
          id: string
          school_id: string
          teacher_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "classes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_current_user: { Args: { user_uuid: string }; Returns: undefined }
      join_class_by_code: {
        Args: { p_class_code: string }
        Returns: { id: string; class_code: string; class_name: string } | null
      }
      get_student_classes: {
        Args: { p_student_id?: string | null }
        Returns: { id: string; class_code: string; class_name: string; created_at?: string; teacher_id?: string }[]
      }
      leave_class: {
        Args: { p_class_id: string; p_student_id?: string | null }
        Returns: undefined
      }
      set_student_password: {
        Args: { p_new_password: string; p_student_id: string }
        Returns: boolean
      }
      update_device_connection_status: {
        Args: {
          p_device_id: string
          p_is_connected: boolean
          p_student_id: string
        }
        Returns: undefined
      }
      update_school_status: {
        Args: { p_is_active: boolean; p_school_id: string }
        Returns: boolean
      }
      update_school_status_with_session: {
        Args: {
          p_is_active: boolean
          p_school_id: string
          p_session_token: string
        }
        Returns: boolean
      }
      update_school_user:
        | {
            Args: {
              p_full_name: string
              p_password?: string
              p_school_id: string
              p_session_token: string
              p_user_id: string
              p_user_type: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_admin_school_code: string
              p_admin_username: string
              p_full_name: string
              p_password?: string
              p_school_id: string
              p_user_id: string
              p_user_type: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_full_name: string
              p_password?: string
              p_school_id: string
              p_user_id: string
              p_user_type: string
            }
            Returns: boolean
          }
      update_school_with_session: {
        Args: {
          p_address: string
          p_admin_password: string
          p_admin_username: string
          p_school_end_time?: string
          p_school_id: string
          p_school_name: string
          p_school_start_time?: string
          p_session_token: string
          p_timezone?: string
        }
        Returns: boolean
      }
      update_student_audio_level: {
        Args: { p_audio_level: number; p_student_id: string }
        Returns: undefined
      }
      update_student_status: {
        Args: { p_is_online?: boolean; p_student_id: string }
        Returns: undefined
      }
      upsert_student_devices: {
        Args: { p_devices: string[]; p_student_id: string }
        Returns: undefined
      }
      validate_and_set_user: {
        Args: { p_session_token: string }
        Returns: {
          school_id: string
          user_id: string
        }[]
      }
      validate_control_center_admin: {
        Args: { p_password: string; p_username: string }
        Returns: boolean
      }
      validate_control_center_session: {
        Args: { p_session_token: string }
        Returns: boolean
      }
      validate_session_token: {
        Args: { p_session_token: string }
        Returns: {
          is_valid: boolean
          school_id: string
          session_id: string
          user_id: string
        }[]
      }
      verify_password: {
        Args: { password_hash: string; password_text: string }
        Returns: boolean
      }
      verify_school_admin_credentials: {
        Args: {
          p_admin_username: string
          p_password: string
          p_school_code: string
        }
        Returns: {
          is_authenticated: boolean
          school_id: string
          school_name: string
        }[]
      }
      verify_school_admin_secure: {
        Args: {
          p_admin_username: string
          p_password: string
          p_school_code: string
        }
        Returns: {
          is_valid: boolean
          school_id: string
          school_name: string
        }[]
      }
    }
    Enums: {
      app_role: "superadmin" | "school_admin" | "teacher" | "student"
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
      app_role: ["superadmin", "school_admin", "teacher", "student"],
    },
  },
} as const
