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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      banners: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      browsing_history: {
        Row: {
          id: string
          product_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          product_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "browsing_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          merchant_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          merchant_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          merchant_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_type: string
          sender_id: string
          sender_type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_type?: string
          sender_id: string
          sender_type?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_feeding: {
        Row: {
          created_at: string
          id: string
          message: string | null
          points: number
          rescue_story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          points?: number
          rescue_story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          points?: number
          rescue_story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_feeding_rescue_story_id_fkey"
            columns: ["rescue_story_id"]
            isOneToOne: false
            referencedRelation: "rescue_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          mentioned_user_ids: string[] | null
          parent_id: string | null
          post_id: string
          reply_to_user_id: string | null
          reply_to_username: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mentioned_user_ids?: string[] | null
          parent_id?: string | null
          post_id: string
          reply_to_user_id?: string | null
          reply_to_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mentioned_user_ids?: string[] | null
          parent_id?: string | null
          post_id?: string
          reply_to_user_id?: string | null
          reply_to_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_settings: {
        Row: {
          id: string
          mode: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          id?: string
          mode?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Update: {
          id?: string
          mode?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: []
      }
      companion_reports: {
        Row: {
          actions: string[]
          created_at: string
          diary: string | null
          extra: string | null
          id: string
          order_id: string
          photo_url: string | null
          poster_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: string[]
          created_at?: string
          diary?: string | null
          extra?: string | null
          id?: string
          order_id: string
          photo_url?: string | null
          poster_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: string[]
          created_at?: string
          diary?: string | null
          extra?: string | null
          id?: string
          order_id?: string
          photo_url?: string | null
          poster_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_reports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      content_violations: {
        Row: {
          content_snippet: string | null
          content_type: string
          created_at: string
          id: string
          status: string
          user_id: string
          violation_type: string
        }
        Insert: {
          content_snippet?: string | null
          content_type: string
          created_at?: string
          id?: string
          status?: string
          user_id: string
          violation_type: string
        }
        Update: {
          content_snippet?: string | null
          content_type?: string
          created_at?: string
          id?: string
          status?: string
          user_id?: string
          violation_type?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_discount: number | null
          min_order_amount: number
          name: string
          usage_limit: number | null
          used_count: number
          valid_from: string
          valid_until: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order_amount?: number
          name: string
          usage_limit?: number | null
          used_count?: number
          valid_from?: string
          valid_until: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order_amount?: number
          name?: string
          usage_limit?: number | null
          used_count?: number
          valid_from?: string
          valid_until?: string
        }
        Relationships: []
      }
      daily_point_caps: {
        Row: {
          cap_date: string
          points_earned: number
          user_id: string
        }
        Insert: {
          cap_date?: string
          points_earned?: number
          user_id: string
        }
        Update: {
          cap_date?: string
          points_earned?: number
          user_id?: string
        }
        Relationships: []
      }
      driver_applications: {
        Row: {
          created_at: string
          driver_license_url: string | null
          driving_years: number
          full_name: string
          gender: string
          handheld_id_url: string | null
          id: string
          id_card_back_url: string | null
          id_card_front_url: string | null
          pet_experience: string[]
          phone: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role_requested: string
          status: string
          updated_at: string
          user_id: string
          vehicle_license_url: string | null
          vehicle_type: string
        }
        Insert: {
          created_at?: string
          driver_license_url?: string | null
          driving_years?: number
          full_name: string
          gender: string
          handheld_id_url?: string | null
          id?: string
          id_card_back_url?: string | null
          id_card_front_url?: string | null
          pet_experience?: string[]
          phone: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_requested?: string
          status?: string
          updated_at?: string
          user_id: string
          vehicle_license_url?: string | null
          vehicle_type: string
        }
        Update: {
          created_at?: string
          driver_license_url?: string | null
          driving_years?: number
          full_name?: string
          gender?: string
          handheld_id_url?: string | null
          id?: string
          id_card_back_url?: string | null
          id_card_front_url?: string | null
          pet_experience?: string[]
          phone?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_requested?: string
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_license_url?: string | null
          vehicle_type?: string
        }
        Relationships: []
      }
      driver_certification_tests: {
        Row: {
          answers: Json
          created_at: string
          id: string
          passed: boolean
          score: number
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          passed?: boolean
          score?: number
          total_questions?: number
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          passed?: boolean
          score?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      earning_transactions: {
        Row: {
          commission: number
          created_at: string
          gross: number
          id: string
          net: number
          order_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          settled_at: string
          user_id: string
        }
        Insert: {
          commission?: number
          created_at?: string
          gross?: number
          id?: string
          net?: number
          order_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          settled_at?: string
          user_id: string
        }
        Update: {
          commission?: number
          created_at?: string
          gross?: number
          id?: string
          net?: number
          order_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          settled_at?: string
          user_id?: string
        }
        Relationships: []
      }
      emergency_reports: {
        Row: {
          contact_phone: string | null
          created_at: string
          description: string | null
          eta_minutes: number | null
          id: string
          order_id: string | null
          report_type: string
          resolved_at: string | null
          status: string
          ticket_no: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          eta_minutes?: number | null
          id?: string
          order_id?: string | null
          report_type: string
          resolved_at?: string | null
          status?: string
          ticket_no?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          eta_minutes?: number | null
          id?: string
          order_id?: string | null
          report_type?: string
          resolved_at?: string | null
          status?: string
          ticket_no?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_sales: {
        Row: {
          created_at: string
          ends_at: string
          flash_price: number
          id: string
          is_active: boolean
          original_price: number
          product_id: string
          sold_count: number
          starts_at: string
          stock: number
        }
        Insert: {
          created_at?: string
          ends_at: string
          flash_price: number
          id?: string
          is_active?: boolean
          original_price: number
          product_id: string
          sold_count?: number
          starts_at?: string
          stock?: number
        }
        Update: {
          created_at?: string
          ends_at?: string
          flash_price?: number
          id?: string
          is_active?: boolean
          original_price?: number
          product_id?: string
          sold_count?: number
          starts_at?: string
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "flash_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      group_order_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          order_id: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          order_id?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_order_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      group_orders: {
        Row: {
          address_summary: string
          community_name: string
          created_at: string
          discount_per_member: number
          id: string
          initiator_id: string
          latitude: number | null
          longitude: number | null
          member_count: number
          service_date: string
          service_type: string | null
          status: string
          target_count: number
          technician_id: string | null
          updated_at: string
        }
        Insert: {
          address_summary: string
          community_name: string
          created_at?: string
          discount_per_member?: number
          id?: string
          initiator_id: string
          latitude?: number | null
          longitude?: number | null
          member_count?: number
          service_date: string
          service_type?: string | null
          status?: string
          target_count?: number
          technician_id?: string | null
          updated_at?: string
        }
        Update: {
          address_summary?: string
          community_name?: string
          created_at?: string
          discount_per_member?: number
          id?: string
          initiator_id?: string
          latitude?: number | null
          longitude?: number | null
          member_count?: number
          service_date?: string
          service_type?: string | null
          status?: string
          target_count?: number
          technician_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hotel_reviews: {
        Row: {
          content: string | null
          created_at: string
          hotel_id: string
          id: string
          images: string[]
          rating: number
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          hotel_id: string
          id?: string
          images?: string[]
          rating?: number
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          hotel_id?: string
          id?: string
          images?: string[]
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_reviews_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "pet_hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_pet_clues: {
        Row: {
          created_at: string
          description: string
          id: string
          image_url: string | null
          latitude: number
          longitude: number
          lost_pet_id: string
          spotted_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          image_url?: string | null
          latitude: number
          longitude: number
          lost_pet_id: string
          spotted_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          latitude?: number
          longitude?: number
          lost_pet_id?: string
          spotted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lost_pet_clues_lost_pet_id_fkey"
            columns: ["lost_pet_id"]
            isOneToOne: false
            referencedRelation: "lost_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_pets: {
        Row: {
          breed: string | null
          created_at: string
          donate_to_shelter: boolean
          features: string
          id: string
          image_url: string | null
          last_seen_location: string
          latitude: number
          longitude: number
          lost_at: string
          pet_name: string
          pet_type: string
          reward_points: number
          status: string
          updated_at: string
          user_id: string
          virtual_phone: string | null
        }
        Insert: {
          breed?: string | null
          created_at?: string
          donate_to_shelter?: boolean
          features: string
          id?: string
          image_url?: string | null
          last_seen_location: string
          latitude: number
          longitude: number
          lost_at?: string
          pet_name: string
          pet_type?: string
          reward_points?: number
          status?: string
          updated_at?: string
          user_id: string
          virtual_phone?: string | null
        }
        Update: {
          breed?: string | null
          created_at?: string
          donate_to_shelter?: boolean
          features?: string
          id?: string
          image_url?: string | null
          last_seen_location?: string
          latitude?: number
          longitude?: number
          lost_at?: string
          pet_name?: string
          pet_type?: string
          reward_points?: number
          status?: string
          updated_at?: string
          user_id?: string
          virtual_phone?: string | null
        }
        Relationships: []
      }
      love_point_transactions: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          id: string
          points: number
          related_id: string | null
          related_type: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          id?: string
          points: number
          related_id?: string | null
          related_type?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          id?: string
          points?: number
          related_id?: string | null
          related_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      merchant_appeals: {
        Row: {
          contact_info: string | null
          created_at: string
          description: string
          id: string
          order_id: string | null
          reason: string
          reply: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_info?: string | null
          created_at?: string
          description: string
          id?: string
          order_id?: string | null
          reason: string
          reply?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_info?: string | null
          created_at?: string
          description?: string
          id?: string
          order_id?: string | null
          reason?: string
          reply?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_appeals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_applications: {
        Row: {
          address: string | null
          contact_name: string | null
          contact_phone: string
          created_at: string
          created_merchant_id: string | null
          description: string | null
          id: string
          license_image_url: string | null
          license_number: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          store_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          created_merchant_id?: string | null
          description?: string | null
          id?: string
          license_image_url?: string | null
          license_number: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          created_merchant_id?: string | null
          description?: string | null
          id?: string
          license_image_url?: string | null
          license_number?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      merchant_owners: {
        Row: {
          created_at: string
          id: string
          merchant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          merchant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          merchant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_owners_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          address: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          is_verified: boolean
          license_image_url: string | null
          license_number: string | null
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_verified?: boolean
          license_image_url?: string | null
          license_number?: string | null
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_verified?: boolean
          license_image_url?: string | null
          license_number?: string | null
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          related_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          cover_image: string | null
          created_at: string
          id: string
          merchant_id: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          id?: string
          merchant_id?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          id?: string
          merchant_id?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_reviews: {
        Row: {
          content: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating?: number
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          booking_date: string | null
          booking_time: string | null
          created_at: string
          driver_distance_km: number | null
          driver_fare: number | null
          driver_id: string | null
          dropoff_address: string | null
          id: string
          notes: string | null
          order_no: string
          order_status: string
          order_type: string
          payment_method: string | null
          payment_status: string
          pet_id: string | null
          pet_snapshot: Json | null
          pet_type: string | null
          pickup_address: string | null
          service_type: string | null
          store_name: string | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_date?: string | null
          booking_time?: string | null
          created_at?: string
          driver_distance_km?: number | null
          driver_fare?: number | null
          driver_id?: string | null
          dropoff_address?: string | null
          id?: string
          notes?: string | null
          order_no?: string
          order_status?: string
          order_type?: string
          payment_method?: string | null
          payment_status?: string
          pet_id?: string | null
          pet_snapshot?: Json | null
          pet_type?: string | null
          pickup_address?: string | null
          service_type?: string | null
          store_name?: string | null
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_date?: string | null
          booking_time?: string | null
          created_at?: string
          driver_distance_km?: number | null
          driver_fare?: number | null
          driver_id?: string | null
          dropoff_address?: string | null
          id?: string
          notes?: string | null
          order_no?: string
          order_status?: string
          order_type?: string
          payment_method?: string | null
          payment_status?: string
          pet_id?: string | null
          pet_snapshot?: Json | null
          pet_type?: string | null
          pickup_address?: string | null
          service_type?: string | null
          store_name?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pet_hotels: {
        Row: {
          address: string
          amenities: string[]
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          latitude: number
          longitude: number
          name: string
          phone: string | null
          price_max: number
          price_min: number
          rating: number
          reviews_count: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          address: string
          amenities?: string[]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          latitude: number
          longitude: number
          name: string
          phone?: string | null
          price_max?: number
          price_min?: number
          rating?: number
          reviews_count?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          address?: string
          amenities?: string[]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
          phone?: string | null
          price_max?: number
          price_min?: number
          rating?: number
          reviews_count?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      pets: {
        Row: {
          allergies: string[]
          auto_share: boolean
          avatar_url: string | null
          behavior_notes: string[]
          birthday: string | null
          breed: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          notes: string | null
          pet_type: string
          updated_at: string
          user_id: string
          vaccinations: Json
          weight_kg: number | null
        }
        Insert: {
          allergies?: string[]
          auto_share?: boolean
          avatar_url?: string | null
          behavior_notes?: string[]
          birthday?: string | null
          breed?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          notes?: string | null
          pet_type?: string
          updated_at?: string
          user_id: string
          vaccinations?: Json
          weight_kg?: number | null
        }
        Update: {
          allergies?: string[]
          auto_share?: boolean
          avatar_url?: string | null
          behavior_notes?: string[]
          birthday?: string | null
          breed?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          notes?: string | null
          pet_type?: string
          updated_at?: string
          user_id?: string
          vaccinations?: Json
          weight_kg?: number | null
        }
        Relationships: []
      }
      point_donations: {
        Row: {
          created_at: string
          id: string
          message: string | null
          points: number
          target_id: string | null
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          points: number
          target_id?: string | null
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          points?: number
          target_id?: string | null
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      point_redeemable_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          points_required: number
          sort_order: number
          stock: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          points_required: number
          sort_order?: number
          stock?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          points_required?: number
          sort_order?: number
          stock?: number
        }
        Relationships: []
      }
      post_media: {
        Row: {
          created_at: string
          id: string
          media_type: string
          media_url: string
          post_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_type: string
          media_url: string
          post_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_featured: boolean
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_featured?: boolean
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_featured?: boolean
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_skus: {
        Row: {
          attributes: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          original_price: number | null
          price: number
          product_id: string
          sort_order: number
          stock: number
        }
        Insert: {
          attributes?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          original_price?: number | null
          price: number
          product_id: string
          sort_order?: number
          stock?: number
        }
        Update: {
          attributes?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          original_price?: number | null
          price?: number
          product_id?: string
          sort_order?: number
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category_id: string | null
          cover_image: string | null
          created_at: string
          description: string | null
          id: string
          images: string[] | null
          is_active: boolean
          merchant_id: string
          name: string
          original_price: number | null
          price: number
          sales_count: number
          stock: number
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          merchant_id: string
          name: string
          original_price?: number | null
          price: number
          sales_count?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          merchant_id?: string
          name?: string
          original_price?: number | null
          price?: number
          sales_count?: number
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          id: string
          is_verified_real_name: boolean
          love_points: number
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          is_verified_real_name?: boolean
          love_points?: number
          updated_at?: string
          user_id: string
          username?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          is_verified_real_name?: boolean
          love_points?: number
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      provider_balances: {
        Row: {
          available: number
          frozen: number
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
          withdrawn_total: number
        }
        Insert: {
          available?: number
          frozen?: number
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
          withdrawn_total?: number
        }
        Update: {
          available?: number
          frozen?: number
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
          withdrawn_total?: number
        }
        Relationships: []
      }
      rescue_stories: {
        Row: {
          after_image: string | null
          before_image: string | null
          cloud_feed_count: number
          cloud_feed_points: number
          created_at: string
          id: string
          is_active: boolean
          location: string | null
          medical_progress: string | null
          pet_name: string
          pet_type: string
          status: string
          story: string
          updated_at: string
          user_id: string
        }
        Insert: {
          after_image?: string | null
          before_image?: string | null
          cloud_feed_count?: number
          cloud_feed_points?: number
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          medical_progress?: string | null
          pet_name: string
          pet_type?: string
          status?: string
          story: string
          updated_at?: string
          user_id: string
        }
        Update: {
          after_image?: string | null
          before_image?: string | null
          cloud_feed_count?: number
          cloud_feed_points?: number
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          medical_progress?: string | null
          pet_name?: string
          pet_type?: string
          status?: string
          story?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_media: {
        Row: {
          created_at: string
          id: string
          media_type: string
          media_url: string
          review_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_type?: string
          media_url: string
          review_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_media_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "order_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_badges: {
        Row: {
          code: string
          created_at: string
          description: string
          description_en: string | null
          icon: string
          id: string
          is_active: boolean
          sort_order: number
          title: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          description_en?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          description_en?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_recommendation_rules: {
        Row: {
          age_max_months: number | null
          age_min_months: number | null
          breed_keywords: string[] | null
          created_at: string
          id: string
          is_active: boolean
          pet_type: string | null
          priority: number
          reason_text: string
          service_emoji: string | null
          service_id: string
          service_title: string
          updated_at: string
        }
        Insert: {
          age_max_months?: number | null
          age_min_months?: number | null
          breed_keywords?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          pet_type?: string | null
          priority?: number
          reason_text: string
          service_emoji?: string | null
          service_id: string
          service_title: string
          updated_at?: string
        }
        Update: {
          age_max_months?: number | null
          age_min_months?: number | null
          breed_keywords?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          pet_type?: string | null
          priority?: number
          reason_text?: string
          service_emoji?: string | null
          service_id?: string
          service_title?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_timeline_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          media_type: string | null
          media_url: string | null
          occurred_at: string
          order_id: string
          technician_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          occurred_at?: string
          order_id: string
          technician_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          occurred_at?: string
          order_id?: string
          technician_id?: string | null
        }
        Relationships: []
      }
      technician_reviews: {
        Row: {
          content: string
          created_at: string
          id: string
          rating: number
          reviewer_avatar: string | null
          reviewer_name: string
          service_type: string
          technician_code: string
          technician_level: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          rating: number
          reviewer_avatar?: string | null
          reviewer_name: string
          service_type: string
          technician_code: string
          technician_level?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          rating?: number
          reviewer_avatar?: string | null
          reviewer_name?: string
          service_type?: string
          technician_code?: string
          technician_level?: string
        }
        Relationships: []
      }
      technician_stats: {
        Row: {
          avg_rating: number
          bio: string | null
          certifications: string[]
          created_at: string
          display_name: string
          id: string
          insurance_no: string | null
          level: string
          review_count: number
          technician_code: string
          total_services: number
          updated_at: string
          years_of_experience: number
        }
        Insert: {
          avg_rating?: number
          bio?: string | null
          certifications?: string[]
          created_at?: string
          display_name: string
          id?: string
          insurance_no?: string | null
          level?: string
          review_count?: number
          technician_code: string
          total_services?: number
          updated_at?: string
          years_of_experience?: number
        }
        Update: {
          avg_rating?: number
          bio?: string | null
          certifications?: string[]
          created_at?: string
          display_name?: string
          id?: string
          insurance_no?: string | null
          level?: string
          review_count?: number
          technician_code?: string
          total_services?: number
          updated_at?: string
          years_of_experience?: number
        }
        Relationships: []
      }
      tnr_collaborations: {
        Row: {
          cats_count: number
          created_at: string
          description: string
          id: string
          latitude: number | null
          location: string
          longitude: number | null
          scheduled_date: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          volunteers_joined: number
          volunteers_needed: number
        }
        Insert: {
          cats_count?: number
          created_at?: string
          description: string
          id?: string
          latitude?: number | null
          location: string
          longitude?: number | null
          scheduled_date?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          volunteers_joined?: number
          volunteers_needed?: number
        }
        Update: {
          cats_count?: number
          created_at?: string
          description?: string
          id?: string
          latitude?: number | null
          location?: string
          longitude?: number | null
          scheduled_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          volunteers_joined?: number
          volunteers_needed?: number
        }
        Relationships: []
      }
      trip_ratings: {
        Row: {
          communication_rating: number | null
          created_at: string
          driver_id: string | null
          feedback: string | null
          id: string
          order_id: string
          overall_rating: number
          pet_care_rating: number | null
          punctuality_rating: number | null
          quick_tags: string[]
          safety_rating: number | null
          user_id: string
        }
        Insert: {
          communication_rating?: number | null
          created_at?: string
          driver_id?: string | null
          feedback?: string | null
          id?: string
          order_id: string
          overall_rating: number
          pet_care_rating?: number | null
          punctuality_rating?: number | null
          quick_tags?: string[]
          safety_rating?: number | null
          user_id: string
        }
        Update: {
          communication_rating?: number | null
          created_at?: string
          driver_id?: string | null
          feedback?: string | null
          id?: string
          order_id?: string
          overall_rating?: number
          pet_care_rating?: number | null
          punctuality_rating?: number | null
          quick_tags?: string[]
          safety_rating?: number | null
          user_id?: string
        }
        Relationships: []
      }
      trip_tracking: {
        Row: {
          cabin_temperature: number | null
          created_at: string
          distance_km: number | null
          driver_id: string | null
          driver_lat: number | null
          driver_lng: number | null
          eta_minutes: number | null
          id: string
          message: string | null
          order_id: string
          photo_urls: string[]
          stage: string
          updated_at: string
        }
        Insert: {
          cabin_temperature?: number | null
          created_at?: string
          distance_km?: number | null
          driver_id?: string | null
          driver_lat?: number | null
          driver_lng?: number | null
          eta_minutes?: number | null
          id?: string
          message?: string | null
          order_id: string
          photo_urls?: string[]
          stage?: string
          updated_at?: string
        }
        Update: {
          cabin_temperature?: number | null
          created_at?: string
          distance_km?: number | null
          driver_id?: string | null
          driver_lat?: number | null
          driver_lng?: number | null
          eta_minutes?: number | null
          id?: string
          message?: string | null
          order_id?: string
          photo_urls?: string[]
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string
          awarded_by: string
          badge_code: string
          badge_icon: string
          badge_level: string
          badge_name: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string
          badge_code: string
          badge_icon?: string
          badge_level?: string
          badge_name: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string
          badge_code?: string
          badge_icon?: string
          badge_level?: string
          badge_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_coupons: {
        Row: {
          claimed_at: string
          coupon_id: string
          id: string
          is_used: boolean
          used_at: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string
          coupon_id: string
          id?: string
          is_used?: boolean
          used_at?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string
          coupon_id?: string
          id?: string
          is_used?: boolean
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_coupons_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          actual_amount: number
          amount: number
          bank_info: Json
          fee: number
          id: string
          paid_at: string | null
          reject_reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          risk_flags: string[]
          role: Database["public"]["Enums"]["app_role"]
          status: string
          user_id: string
          voucher_no: string | null
        }
        Insert: {
          actual_amount?: number
          amount: number
          bank_info?: Json
          fee?: number
          id?: string
          paid_at?: string | null
          reject_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_flags?: string[]
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          user_id: string
          voucher_no?: string | null
        }
        Update: {
          actual_amount?: number
          amount?: number
          bank_info?: Json
          fee?: number
          id?: string
          paid_at?: string | null
          reject_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_flags?: string[]
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          user_id?: string
          voucher_no?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_approve_withdrawal: { Args: { _id: string }; Returns: Json }
      admin_force_pay_withdrawal: { Args: { _id: string }; Returns: Json }
      admin_reject_withdrawal: {
        Args: { _id: string; _reason: string }
        Returns: Json
      }
      admin_set_commission: {
        Args: {
          _mode: string
          _role: Database["public"]["Enums"]["app_role"]
          _value: number
        }
        Returns: Json
      }
      approve_driver_application: {
        Args: { _application_id: string; _note?: string }
        Returns: Json
      }
      approve_merchant_application: {
        Args: { _application_id: string; _note?: string }
        Returns: Json
      }
      award_love_points: {
        Args: {
          _action: string
          _description?: string
          _points: number
          _related_id?: string
          _related_type?: string
        }
        Returns: Json
      }
      donate_love_points: {
        Args: {
          _message?: string
          _points: number
          _target_id?: string
          _target_type: string
        }
        Returns: Json
      }
      get_product_review_stats: {
        Args: never
        Returns: {
          avg_rating: number
          good_rate: number
          good_review_count: number
          product_id: string
          review_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_merchant_owner: {
        Args: { _merchant_id: string; _user_id: string }
        Returns: boolean
      }
      provider_request_withdrawal: {
        Args: { _amount: number; _bank_info: Json }
        Returns: Json
      }
      reject_driver_application: {
        Args: { _application_id: string; _reason: string }
        Returns: Json
      }
      reject_merchant_application: {
        Args: { _application_id: string; _note?: string }
        Returns: Json
      }
      spend_love_points: {
        Args: {
          _description?: string
          _points: number
          _purpose: string
          _related_id?: string
          _related_type?: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "merchant" | "user" | "sitter" | "groomer" | "driver"
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
      app_role: ["admin", "merchant", "user", "sitter", "groomer", "driver"],
    },
  },
} as const
