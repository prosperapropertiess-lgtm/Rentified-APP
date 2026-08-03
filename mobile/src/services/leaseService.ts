import { format, addYears } from 'date-fns';

export type LeaseAgreement = {
  id: string;
  propertyName: string;
  unit: string;
  tenantName: string;
  tenantEmail: string;
  monthlyRent: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'renewal_pending' | 'renewed';
  noticeDaysRemaining: number;
};

export const leaseService = {
  getSampleLease(): LeaseAgreement {
    return {
      id: 'lease-500k',
      propertyName: 'King Street West Condos',
      unit: 'Unit 4B',
      tenantName: 'Sarah Jenkins',
      tenantEmail: 'sarah.j@example.com',
      monthlyRent: 2450,
      startDate: '2025-10-01',
      endDate: '2026-09-30',
      status: 'renewal_pending',
      noticeDaysRemaining: 58,
    };
  },

  generateRenewalOffer(lease: LeaseAgreement, increasePercent: number = 2.5) {
    const newRent = Math.round(lease.monthlyRent * (1 + increasePercent / 100));
    const newStartDate = format(addYears(new Date(lease.startDate), 1), 'yyyy-MM-dd');
    const newEndDate = format(addYears(new Date(lease.endDate), 1), 'yyyy-MM-dd');

    return {
      leaseId: lease.id,
      tenantName: lease.tenantName,
      unit: lease.unit,
      currentRent: lease.monthlyRent,
      proposedRent: newRent,
      increasePercent,
      newStartDate,
      newEndDate,
      guidelineCompliant: increasePercent <= 2.5, // 2026 Ontario Rent Increase Guideline Limit is 2.5%
    };
  },
};
