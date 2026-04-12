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
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
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
          dropoff_address: string | null
          id: string
          notes: string | null
          order_no: string
          order_status: string
          order_type: string
          payment_method: string | null
          payment_status: string
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
          dropoff_address?: string | null
          id?: string
          notes?: string | null
          order_no?: string
          order_status?: string
          order_type?: string
          payment_method?: string | null
          payment_status?: string
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
          dropoff_address?: string | null
          id?: string
          notes?: string | null
          order_no?: string
          order_status?: string
          order_type?: string
          payment_method?: string | null
          payment_status?: string
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
          content: string
          created_at: string
          id: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
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
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          username?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          username?: string
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
    Enums: {},
  },
} as const
