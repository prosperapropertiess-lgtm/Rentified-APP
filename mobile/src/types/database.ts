export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      landlords: {
        Row: {
          id: string;
          user_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          stripe_account_id: string | null;
          stripe_onboarded: boolean;
          notification_prefs: Json;
          push_subscription: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string | null;
          stripe_account_id?: string | null;
          stripe_onboarded?: boolean;
          notification_prefs?: Json;
          push_subscription?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string | null;
          stripe_account_id?: string | null;
          stripe_onboarded?: boolean;
          notification_prefs?: Json;
          push_subscription?: Json | null;
          updated_at?: string;
        };
      };
      properties: {
        Row: {
          id: string;
          landlord_id: string;
          name: string;
          address: string;
          city: string;
          province: string;
          postal_code: string;
          type: "single_family" | "multi_unit" | "condo" | "townhouse";
          image_url: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          landlord_id: string;
          name: string;
          address: string;
          city?: string;
          province?: string;
          postal_code: string;
          type?: "single_family" | "multi_unit" | "condo" | "townhouse";
          image_url?: string | null;
        };
        Update: {
          name?: string;
          address?: string;
          city?: string;
          province?: string;
          postal_code?: string;
          type?: "single_family" | "multi_unit" | "condo" | "townhouse";
          image_url?: string | null;
          updated_at?: string;
        };
      };
      units: {
        Row: {
          id: string;
          property_id: string;
          unit_number: string;
          bedrooms: number;
          bathrooms: number;
          sqft: number | null;
          rent_amount: number;
          status: "occupied" | "vacant" | "maintenance";
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          unit_number: string;
          bedrooms?: number;
          bathrooms?: number;
          sqft?: number | null;
          rent_amount: number;
          status?: "occupied" | "vacant" | "maintenance";
        };
        Update: {
          unit_number?: string;
          bedrooms?: number;
          bathrooms?: number;
          sqft?: number | null;
          rent_amount?: number;
          status?: "occupied" | "vacant" | "maintenance";
          updated_at?: string;
        };
      };
      tenants: {
        Row: {
          id: string;
          user_id: string | null;
          landlord_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          invite_token: string | null;
          invite_accepted: boolean;
          payment_streak: number;
          push_subscription: Json | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          landlord_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string | null;
          invite_token?: string | null;
          invite_accepted?: boolean;
          payment_streak?: number;
        };
        Update: {
          user_id?: string | null;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string | null;
          invite_token?: string | null;
          invite_accepted?: boolean;
          payment_streak?: number;
          updated_at?: string;
        };
      };
      leases: {
        Row: {
          id: string;
          unit_id: string;
          tenant_id: string;
          landlord_id: string;
          start_date: string;
          end_date: string;
          rent_amount: number;
          rent_due_day: number;
          security_deposit: number;
          last_months_rent_deposit: number;
          key_deposit: number;
          lmr_interest_paid_date: string | null;
          lmr_interest_owing: number;
          status: "active" | "expired" | "terminated" | "pending";
          document_url: string | null;
          signed_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          tenant_id: string;
          landlord_id: string;
          start_date: string;
          end_date: string;
          rent_amount: number;
          rent_due_day?: number;
          security_deposit?: number;
          last_months_rent_deposit?: number;
          key_deposit?: number;
          lmr_interest_paid_date?: string | null;
          lmr_interest_owing?: number;
          status?: "active" | "expired" | "terminated" | "pending";
          document_url?: string | null;
          signed_at?: string | null;
        };
        Update: {
          start_date?: string;
          end_date?: string;
          rent_amount?: number;
          rent_due_day?: number;
          last_months_rent_deposit?: number;
          key_deposit?: number;
          lmr_interest_paid_date?: string | null;
          lmr_interest_owing?: number;
          status?: "active" | "expired" | "terminated" | "pending";
          document_url?: string | null;
          signed_at?: string | null;
          deleted_at?: string | null;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          lease_id: string;
          tenant_id: string;
          landlord_id: string;
          amount: number;
          due_date: string;
          paid_at: string | null;
          status: "pending" | "processing" | "paid" | "overdue" | "partial" | "waived";
          payment_method: "stripe" | "etransfer" | "cash" | "cheque" | "other";
          recorded_manually: boolean;
          stripe_payment_intent_id: string | null;
          stripe_charge_id: string | null;
          late_fee: number;
          receipt_url: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lease_id: string;
          tenant_id: string;
          landlord_id: string;
          amount: number;
          due_date: string;
          paid_at?: string | null;
          status?: "pending" | "processing" | "paid" | "overdue" | "partial" | "waived";
          payment_method?: "stripe" | "etransfer" | "cash" | "cheque" | "other";
          recorded_manually?: boolean;
          stripe_payment_intent_id?: string | null;
          stripe_charge_id?: string | null;
          late_fee?: number;
          receipt_url?: string | null;
          notes?: string | null;
        };
        Update: {
          paid_at?: string | null;
          status?: "pending" | "processing" | "paid" | "overdue" | "partial" | "waived";
          payment_method?: "stripe" | "etransfer" | "cash" | "cheque" | "other";
          recorded_manually?: boolean;
          stripe_payment_intent_id?: string | null;
          stripe_charge_id?: string | null;
          late_fee?: number;
          receipt_url?: string | null;
          notes?: string | null;
        };
      };
      maintenance_requests: {
        Row: {
          id: string;
          unit_id: string;
          tenant_id: string;
          landlord_id: string;
          title: string;
          description: string;
          category: string;
          priority: "low" | "medium" | "high" | "urgent";
          status: "open" | "in_progress" | "scheduled" | "resolved" | "closed";
          ai_triage_notes: string | null;
          ai_priority_reason: string | null;
          images: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          tenant_id: string;
          landlord_id: string;
          title: string;
          description: string;
          category?: string;
          priority?: "low" | "medium" | "high" | "urgent";
          status?: "open" | "in_progress" | "scheduled" | "resolved" | "closed";
          ai_triage_notes?: string | null;
          ai_priority_reason?: string | null;
          images?: string[];
        };
        Update: {
          title?: string;
          description?: string;
          category?: string;
          priority?: "low" | "medium" | "high" | "urgent";
          status?: "open" | "in_progress" | "scheduled" | "resolved" | "closed";
          ai_triage_notes?: string | null;
          ai_priority_reason?: string | null;
          images?: string[];
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
