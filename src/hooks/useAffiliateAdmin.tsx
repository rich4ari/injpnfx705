import { useState, useEffect, createContext, useContext } from 'react';
import { useAuth } from '@/hooks/useFirebaseAuth';
import { 
  getAllAffiliates,
  getAffiliateSettings,
  updateAffiliateSettings,
  getAllPayouts,
  processPayout,
  approveCommission,
  rejectCommission
} from '@/services/affiliateService';
import { 
  AffiliateUser, 
  AffiliateSettings,
  AffiliatePayout,
  AffiliateCommission
} from '@/types/affiliate';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';

interface AffiliateAdminContextType {
  affiliates: AffiliateUser[];
  settings: AffiliateSettings | null;
  payouts: AffiliatePayout[];
  commissions: AffiliateCommission[];
  loading: boolean;
  error: string | null;
  updateSettings: (settings: Partial<AffiliateSettings>) => Promise<void>;
  processPayout: (payoutId: string, status: 'processing' | 'completed' | 'rejected', notes?: string) => Promise<void>;
  approveCommission: (commissionId: string) => Promise<void>;
  rejectCommission: (commissionId: string, reason: string) => Promise<void>;
}

const AffiliateAdminContext = createContext<AffiliateAdminContextType | undefined>(undefined);

export const AffiliateAdminProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [affiliates, setAffiliates] = useState<AffiliateUser[]>([]);
  const [settings, setSettings] = useState<AffiliateSettings | null>(null);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Get affiliate settings
        const settingsData = await getAffiliateSettings();
        setSettings(settingsData);
        
        // Get all affiliates
        const affiliatesData = await getAllAffiliates();
        setAffiliates(affiliatesData);
        
        // Get all payouts
        const payoutsData = await getAllPayouts();
        setPayouts(payoutsData);
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading affiliate admin data:', err);
        setError('Failed to load affiliate admin data');
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    // Subscribe to affiliates
    const affiliatesRef = collection(db, 'affiliates');
    const unsubscribeAffiliates = onSnapshot(
      affiliatesRef,
      (snapshot) => {
        const affiliatesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as AffiliateUser));
        
        setAffiliates(affiliatesData);
      },
      (err) => {
        console.error('Error subscribing to affiliates:', err);
        setError('Failed to subscribe to affiliates');
      }
    );

    // Subscribe to commissions
    const commissionsRef = collection(db, 'affiliate_commissions');
    const commissionsQuery = query(commissionsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribeCommissions = onSnapshot(
      commissionsQuery,
      (snapshot) => {
        const commissionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as AffiliateCommission));
        
        setCommissions(commissionsData);
      },
      (err) => {
        console.error('Error subscribing to commissions:', err);
        setError('Failed to subscribe to commissions');
      }
    );

    // Subscribe to payouts
    const payoutsRef = collection(db, 'affiliate_payouts');
    const payoutsQuery = query(payoutsRef, orderBy('requestedAt', 'desc'));
    
    const unsubscribePayouts = onSnapshot(
      payoutsQuery,
      (snapshot) => {
        const payoutsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as AffiliatePayout));
        
        setPayouts(payoutsData);
      },
      (err) => {
        console.error('Error subscribing to payouts:', err);
        setError('Failed to subscribe to payouts');
      }
    );

    return () => {
      unsubscribeAffiliates();
      unsubscribeCommissions();
      unsubscribePayouts();
    };
  }, [user]);

  // Update affiliate settings
  const updateSettingsFn = async (settingsUpdate: Partial<AffiliateSettings>) => {
    if (!user) {
      throw new Error('You must be logged in to update settings');
    }

    try {
      await updateAffiliateSettings(settingsUpdate);
      
      if (settings) {
        setSettings({
          ...settings,
          ...settingsUpdate,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Error updating affiliate settings:', err);
      throw err;
    }
  };

  // Process payout
  const processPayoutFn = async (
    payoutId: string, 
    status: 'processing' | 'completed' | 'rejected',
    notes?: string
  ) => {
    if (!user) {
      throw new Error('You must be logged in to process payouts');
    }

    try {
      await processPayout(payoutId, user.uid, status, notes);
    } catch (err) {
      console.error('Error processing payout:', err);
      throw err;
    }
  };

  // Approve commission
  const approveCommissionFn = async (commissionId: string) => {
    if (!user) {
      throw new Error('You must be logged in to approve commissions');
    }

    try {
      await approveCommission(commissionId, user.uid);
    } catch (err) {
      console.error('Error approving commission:', err);
      throw err;
    }
  };

  // Reject commission
  const rejectCommissionFn = async (commissionId: string, reason: string) => {
    if (!user) {
      throw new Error('You must be logged in to reject commissions');
    }

    try {
      await rejectCommission(commissionId, user.uid, reason);
    } catch (err) {
      console.error('Error rejecting commission:', err);
      throw err;
    }
  };

  return (
    <AffiliateAdminContext.Provider
      value={{
        affiliates,
        settings,
        payouts,
        commissions,
        loading,
        error,
        updateSettings: updateSettingsFn,
        processPayout: processPayoutFn,
        approveCommission: approveCommissionFn,
        rejectCommission: rejectCommissionFn
      }}
    >
      {children}
    </AffiliateAdminContext.Provider>
  );
};

export const useAffiliateAdmin = () => {
  const context = useContext(AffiliateAdminContext);
  if (context === undefined) {
    throw new Error('useAffiliateAdmin must be used within an AffiliateAdminProvider');
  }
  return context;
};