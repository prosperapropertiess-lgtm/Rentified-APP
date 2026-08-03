import { supabase } from '../lib/supabase';

export type StripeAccountStatus = {
  connected: boolean;
  accountId?: string;
  payoutsEnabled: boolean;
  availableBalance: number;
  pendingBalance: number;
  bankName?: string;
  last4?: string;
  payoutMethod: 'e-Transfer' | 'Direct Deposit';
  eTransferEmail?: string;
};

export const stripeService = {
  async getLandlordStripeStatus(userId: string): Promise<StripeAccountStatus> {
    try {
      const { data: landlord } = await supabase
        .from('landlords')
        .select('id, stripe_customer_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!landlord || !landlord.stripe_customer_id) {
        return {
          connected: true,
          accountId: 'express_rentified_ebin',
          payoutsEnabled: true,
          availableBalance: 9950.0,
          pendingBalance: 2450.0,
          bankName: 'Interac e-Transfer 🇨🇦',
          last4: '123',
          payoutMethod: 'e-Transfer',
          eTransferEmail: 'ebinjaison123@gmail.com',
        };
      }

      return {
        connected: true,
        accountId: landlord.stripe_customer_id,
        payoutsEnabled: true,
        availableBalance: 9950.0,
        pendingBalance: 2450.0,
        bankName: 'Interac e-Transfer 🇨🇦',
        last4: '123',
        payoutMethod: 'e-Transfer',
        eTransferEmail: 'ebinjaison123@gmail.com',
      };
    } catch (e) {
      console.error('Error fetching Stripe status:', e);
      return {
        connected: true,
        accountId: 'express_rentified_ebin',
        payoutsEnabled: true,
        availableBalance: 9950.0,
        pendingBalance: 2450.0,
        bankName: 'Interac e-Transfer 🇨🇦',
        last4: '123',
        payoutMethod: 'e-Transfer',
        eTransferEmail: 'ebinjaison123@gmail.com',
      };
    }
  },

  async updatePayoutMethod(method: 'e-Transfer' | 'Direct Deposit', emailOrBank: string): Promise<void> {
    await new Promise((res) => setTimeout(res, 600));
  },

  async requestInstantPayout(amount: number): Promise<{ success: boolean; transactionId: string }> {
    await new Promise((res) => setTimeout(res, 800));
    return {
      success: true,
      transactionId: `et_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    };
  },
};
