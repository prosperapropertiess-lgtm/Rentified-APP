import { supabase } from '../lib/supabase';
import { PropertyCollectionItem, TenantCollectionItem, PaymentMethodType, PaymentStatus } from '../app/(tabs)/payments';

export const rentService = {
  async fetchCollectionSummary(userId: string) {
    try {
      // landlords.id = auth.users.id in Prospera schema
      const { data: properties } = await supabase
        .from('properties')
        .select('id, name, address')
        .eq('landlord_id', userId);

      return properties;
    } catch (e) {
      console.error('Error fetching collection summary:', e);
      return null;
    }
  },

  calculateMetrics(properties: PropertyCollectionItem[]) {
    const totalRentDue = properties.reduce((acc, p) => acc + p.totalMonthlyRent, 0);
    const totalCollected = properties.reduce((acc, p) => acc + p.amountCollected, 0);
    const outstandingBalance = properties.reduce((acc, p) => acc + p.amountOutstanding, 0);

    const allTenants = properties.flatMap((p) => p.tenants);
    const overdueTenantsCount = allTenants.filter((t) => t.status === 'overdue').length;
    const paymentsReceivedTodayCount = allTenants.filter(
      (t) => t.status === 'paid' && t.paidDate && new Date(t.paidDate).toDateString() === new Date().toDateString()
    ).length;

    return {
      totalRentDue,
      totalCollected,
      outstandingBalance,
      overdueTenantsCount,
      paymentsReceivedTodayCount,
    };
  },

  markAsPaid(
    properties: PropertyCollectionItem[],
    targetTenant: TenantCollectionItem,
    method: PaymentMethodType
  ): PropertyCollectionItem[] {
    const now = new Date().toISOString();
    const generatedStripeId = method === 'Stripe' ? `ch_${Math.random().toString(36).substring(2, 12).toUpperCase()}` : null;

    return properties.map((prop) => {
      if (prop.id !== targetTenant.propertyId) return prop;

      const updatedTenants = prop.tenants.map((t) => {
        if (t.id !== targetTenant.id) return t;
        return {
          ...t,
          status: 'paid' as PaymentStatus,
          paidDate: now,
          paymentMethod: method,
          stripePaymentId: generatedStripeId,
        };
      });

      const paidCount = updatedTenants.filter((t) => t.status === 'paid').length;
      const outstandingCount = updatedTenants.length - paidCount;
      const collected = updatedTenants.reduce((acc, t) => (t.status === 'paid' ? acc + t.monthlyRent : acc), 0);
      const outstanding = prop.totalMonthlyRent - collected;

      return {
        ...prop,
        amountCollected: collected,
        amountOutstanding: outstanding,
        tenantsPaidCount: paidCount,
        tenantsOutstandingCount: outstandingCount,
        tenants: updatedTenants,
      };
    });
  },

  sendReminder(
    properties: PropertyCollectionItem[],
    targetTenant: TenantCollectionItem
  ): PropertyCollectionItem[] {
    const now = new Date().toISOString();

    return properties.map((prop) => {
      if (prop.id !== targetTenant.propertyId) return prop;
      return {
        ...prop,
        tenants: prop.tenants.map((t) => {
          if (t.id !== targetTenant.id) return t;
          return {
            ...t,
            lastReminderSentAt: now,
            reminderMethod: 'SMS' as const,
          };
        }),
      };
    });
  },
};
