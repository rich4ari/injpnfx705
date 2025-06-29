import { useState, useEffect, createContext, useContext } from 'react';
import { useAuth } from '@/hooks/useFirebaseAuth';
import { 
  createOrUpdateAffiliateUser,
  getAffiliateUser,
  subscribeToAffiliateStats,
  subscribeToAffiliateReferrals,
  subscribeToAffiliateCommissions,
  subscribeToAffiliatePayouts,
  getAffiliateFollowers,
  updateAffiliateBankInfo,
  requestPayout,
  getAffiliateSettings
} from '@/services/affiliateService';
import { 
  AffiliateUser, 
  AffiliateReferral, 
  AffiliateCommission, 
  AffiliateSettings,
  AffiliateFollower,
  AffiliatePayout
} from '@/types/affiliate';

interface AffiliateContextType {
  affiliate: AffiliateUser | null;
  loading: boolean;
  error: string | null;
  referrals: AffiliateReferral[];
  commissions: AffiliateCommission[];
  payouts: AffiliatePayout[];
  followers: AffiliateFollower[];
  settings: AffiliateSettings | null;
  joinAffiliate: () => Promise<void>;
  updateBankInfo: (bankInfo: { bankName: string; accountNumber: string; accountName: string }) => Promise<void>;
  requestPayout: (amount: number, method: string) => Promise<string>;
  copyReferralLink: () => void;
  referralLink: string;
}

const AffiliateContext = createContext<AffiliateContextType | undefined>(undefined);

export const AffiliateProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [affiliate, setAffiliate] = useState<AffiliateUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<AffiliateReferral[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [followers, setFollowers] = useState<AffiliateFollower[]>([]);
  const [settings, setSettings] = useState<AffiliateSettings | null>(null);

  // Generate referral link
  const referralLink = affiliate 
    ? `${window.location.origin}/?ref=${affiliate.referralCode}`
    : '';

  // Load affiliate data
  useEffect(() => {
    const loadAffiliateData = async () => {
      if (!user) {
        setAffiliate(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Get affiliate user
        const affiliateData = await getAffiliateUser(user.uid);
        setAffiliate(affiliateData);
        
        // Get affiliate settings
        const settingsData = await getAffiliateSettings();
        setSettings(settingsData);
        
        // Get followers if affiliate exists
        if (affiliateData) {
          const followersData = await getAffiliateFollowers(affiliateData.id);
          setFollowers(followersData);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading affiliate data:', err);
        setError('Failed to load affiliate data');
        setLoading(false);
      }
    };

    loadAffiliateData();
  }, [user]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user || !affiliate) return;

    let unsubscribeStats: (() => void) | undefined;
    let unsubscribeReferrals: (() => void) | undefined;
    let unsubscribeCommissions: (() => void) | undefined;
    let unsubscribePayouts: (() => void) | undefined;

    try {
      // Subscribe to affiliate stats
      unsubscribeStats = subscribeToAffiliateStats(
        affiliate.id,
        (updatedAffiliate) => {
          setAffiliate(updatedAffiliate);
        }
      );

      // Subscribe to referrals
      unsubscribeReferrals = subscribeToAffiliateReferrals(
        affiliate.id,
        (updatedReferrals) => {
          setReferrals(updatedReferrals);
        }
      );

      // Subscribe to commissions
      unsubscribeCommissions = subscribeToAffiliateCommissions(
        affiliate.id,
        (updatedCommissions) => {
          setCommissions(updatedCommissions);
        }
      );

      // Subscribe to payouts
      unsubscribePayouts = subscribeToAffiliatePayouts(
        affiliate.id,
        (updatedPayouts) => {
          setPayouts(updatedPayouts);
        }
      );
    } catch (err) {
      console.error('Error setting up subscriptions:', err);
      setError('Failed to set up real-time updates');
    }

    return () => {
      if (unsubscribeStats) unsubscribeStats();
      if (unsubscribeReferrals) unsubscribeReferrals();
      if (unsubscribeCommissions) unsubscribeCommissions();
      if (unsubscribePayouts) unsubscribePayouts();
    };
  }, [user, affiliate]);

  // Join affiliate program
  const joinAffiliate = async () => {
    if (!user) {
      setError('You must be logged in to join the affiliate program');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const affiliateData = await createOrUpdateAffiliateUser(
        user.uid,
        user.email || '',
        user.displayName || user.email?.split('@')[0] || 'User'
      );
      
      setAffiliate(affiliateData);
      setLoading(false);
    } catch (err) {
      console.error('Error joining affiliate program:', err);
      setError('Failed to join affiliate program');
      setLoading(false);
    }
  };

  // Update bank info
  const updateBankInfo = async (bankInfo: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) => {
    if (!user || !affiliate) {
      setError('You must be logged in and joined the affiliate program');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await updateAffiliateBankInfo(affiliate.id, bankInfo);
      
      setAffiliate({
        ...affiliate,
        bankInfo
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Error updating bank info:', err);
      setError('Failed to update bank info');
      setLoading(false);
    }
  };

  // Request payout
  const requestPayoutFn = async (amount: number, method: string) => {
    if (!user || !affiliate) {
      throw new Error('You must be logged in and joined the affiliate program');
    }

    try {
      const payoutId = await requestPayout(
        affiliate.id,
        amount,
        method,
        affiliate.bankInfo
      );
      
      return payoutId;
    } catch (err) {
      console.error('Error requesting payout:', err);
      throw err;
    }
  };

  // Copy referral link
  const copyReferralLink = () => {
    if (!referralLink) {
      setError('No referral link available');
      return;
    }

    navigator.clipboard.writeText(referralLink)
      .then(() => {
        // Success message handled by toast in component
      })
      .catch((err) => {
        console.error('Error copying referral link:', err);
        setError('Failed to copy referral link');
      });
  };

  return (
    <AffiliateContext.Provider
      value={{
        affiliate,
        loading,
        error,
        referrals,
        commissions,
        payouts,
        followers,
        settings,
        joinAffiliate,
        updateBankInfo,
        requestPayout: requestPayoutFn,
        copyReferralLink,
        referralLink
      }}
    >
      {children}
    </AffiliateContext.Provider>
  );
};

export const useAffiliate = () => {
  const context = useContext(AffiliateContext);
  if (context === undefined) {
    throw new Error('useAffiliate must be used within an AffiliateProvider');
  }
  return context;
};