import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  addDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { 
  AffiliateUser, 
  AffiliateReferral, 
  AffiliateCommission, 
  AffiliateSettings,
  AffiliatePayout,
  AffiliateFollower
} from '@/types/affiliate';

// Collection names
const AFFILIATES_COLLECTION = 'affiliates';
const REFERRALS_COLLECTION = 'affiliate_referrals';
const COMMISSIONS_COLLECTION = 'affiliate_commissions';
const SETTINGS_COLLECTION = 'affiliate_settings';
const PAYOUTS_COLLECTION = 'affiliate_payouts';

// Generate a unique referral code
export const generateReferralCode = (userId: string, name: string): string => {
  // Take first 3 characters of name (or less if name is shorter)
  const namePrefix = name.substring(0, 3).toUpperCase();
  
  // Take last 4 characters of userId
  const userSuffix = userId.substring(userId.length - 4);
  
  // Generate random 3 characters
  const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();
  
  return `${namePrefix}${randomChars}${userSuffix}`;
};

// Create or update affiliate user
export const createOrUpdateAffiliateUser = async (
  userId: string, 
  email: string, 
  displayName: string
): Promise<AffiliateUser> => {
  try {
    const affiliateRef = doc(db, AFFILIATES_COLLECTION, userId);
    const affiliateDoc = await getDoc(affiliateRef);
    
    if (affiliateDoc.exists()) {
      // Update existing affiliate
      const updateData = {
        email,
        displayName,
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(affiliateRef, updateData);
      
      return {
        id: affiliateDoc.id,
        ...affiliateDoc.data(),
        ...updateData
      } as AffiliateUser;
    } else {
      // Create new affiliate
      const referralCode = generateReferralCode(userId, displayName);
      
      const newAffiliate: Omit<AffiliateUser, 'id'> = {
        userId,
        email,
        displayName,
        referralCode,
        totalClicks: 0,
        totalReferrals: 0,
        totalCommission: 0,
        pendingCommission: 0,
        paidCommission: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(affiliateRef, newAffiliate);
      
      return {
        id: userId,
        ...newAffiliate
      };
    }
  } catch (error) {
    console.error('Error creating/updating affiliate user:', error);
    throw error;
  }
};

// Get affiliate user by ID
export const getAffiliateUser = async (userId: string): Promise<AffiliateUser | null> => {
  try {
    const affiliateRef = doc(db, AFFILIATES_COLLECTION, userId);
    const affiliateDoc = await getDoc(affiliateRef);
    
    if (affiliateDoc.exists()) {
      return {
        id: affiliateDoc.id,
        ...affiliateDoc.data()
      } as AffiliateUser;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting affiliate user:', error);
    throw error;
  }
};

// Get affiliate user by referral code
export const getAffiliateByReferralCode = async (referralCode: string): Promise<AffiliateUser | null> => {
  try {
    const affiliatesRef = collection(db, AFFILIATES_COLLECTION);
    const q = query(affiliatesRef, where('referralCode', '==', referralCode), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const affiliateDoc = querySnapshot.docs[0];
      return {
        id: affiliateDoc.id,
        ...affiliateDoc.data()
      } as AffiliateUser;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting affiliate by referral code:', error);
    throw error;
  }
};

// Track referral click
export const trackReferralClick = async (referralCode: string, visitorId: string): Promise<string> => {
  try {
    console.log('Tracking referral click:', { referralCode, visitorId });
    
    // Create a fallback ID in case of errors
    const fallbackId = `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Check if referral code exists
    const affiliate = await getAffiliateByReferralCode(referralCode);
    if (!affiliate) {
      console.warn('Invalid referral code:', referralCode);
      throw new Error('Invalid referral code');
    }
    
    // Check if this visitor has already clicked this referral link
    const referralsRef = collection(db, REFERRALS_COLLECTION);
    const q = query(
      referralsRef,
      where('referralCode', '==', referralCode)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Check if this visitor has already clicked in the results
    const existingClick = querySnapshot.docs.find(doc => 
      doc.data().visitorId === visitorId
    );
    
    if (existingClick) {
      // Already clicked, just return the ID
      return existingClick.id;
    }
    
    // Create new referral click
    const newReferral: Partial<AffiliateReferral> = {
      referralCode,
      referrerId: affiliate.id,
      visitorId,
      status: 'clicked',
      clickedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add to referrals collection
    let referralDocRef;
    try {
      referralDocRef = await addDoc(collection(db, REFERRALS_COLLECTION), newReferral);
    } catch (addDocError) {
      console.error('Error adding referral document:', addDocError);
      // Return fallback ID instead of throwing
      return fallbackId;
    }
    
    
    // Update affiliate stats
    await updateDoc(doc(db, AFFILIATES_COLLECTION, affiliate.id), {
      totalClicks: increment(1),
      updatedAt: new Date().toISOString()
    });
    
    return referralDocRef.id;
  } catch (error) {
    console.error('Error tracking referral click:', error);
    // Return a fallback ID instead of throwing to prevent app crashes
    // This allows the app to continue functioning even if tracking fails
    return `error-${Date.now()}`;
  }
};

// Register user with referral
export const registerWithReferral = async (
  referralCode: string, 
  userId: string, 
  email: string,
  displayName: string
): Promise<void> => {
  try {
    console.log(`Registering user ${userId} with referral code ${referralCode}`);
    
    // Get affiliate by referral code
    const affiliate = await getAffiliateByReferralCode(referralCode);
    if (!affiliate) {
      console.warn('Invalid referral code during registration, using fallback:', referralCode);
      // Don't throw, just return to allow registration to continue
      return;
    }
    
    // Find the most recent click for this referral code
    const referralsRef = collection(db, REFERRALS_COLLECTION);
    const q = query(
      referralsRef,
      where('referralCode', '==', referralCode),
      where('status', '==', 'clicked')
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('No click found for this referral code, creating new referral');
      // Create a new referral record if no click found
      const newReferral: Partial<AffiliateReferral> = {
        referralCode,
        referrerId: affiliate.id,
        referredUserId: userId,
        referredUserEmail: email,
        referredUserName: displayName,
        status: 'registered',
        registeredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, REFERRALS_COLLECTION), newReferral);
    } else {
      // Update existing referral with user info
      // Sort manually to get the most recent one
      const sortedDocs = querySnapshot.docs.sort((a, b) => {
        const aDate = new Date(a.data().createdAt || 0);
        const bDate = new Date(b.data().createdAt || 0);
        return bDate.getTime() - aDate.getTime();
      });
      
      const referralDoc = sortedDocs[0];
      
      console.log(`Updating referral ${referralDoc.id} with user info`);
      
      await updateDoc(referralDoc.ref, {
        referredUserId: userId,
        referredUserEmail: email,
        referredUserName: displayName,
        status: 'registered',
        registeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    // Update affiliate stats
    await updateDoc(doc(db, AFFILIATES_COLLECTION, affiliate.id), {
      totalReferrals: increment(1),
      updatedAt: new Date().toISOString()
    });
    
    console.log(`Successfully registered user ${userId} with referral code ${referralCode}`);
  } catch (error) {
    console.error('Error registering with referral:', error);
    // Don't rethrow to prevent app crashes
  }
};

// Create order with referral
export const createOrderWithReferral = async (
  userId: string,
  orderId: string,
  orderTotal: number,
  referralCode?: string
): Promise<void> => {
  try {
    console.log(`Creating order ${orderId} with referral for user ${userId}`);
    
    if (!referralCode) {
      // Check if user was referred
      const referralsRef = collection(db, REFERRALS_COLLECTION);
      const q = query(
        referralsRef,
        where('referredUserId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // No referral found
        console.log(`No referral found for user ${userId}`);
        return;
      }
      
      const referralDoc = querySnapshot.docs[0];
      const referral = referralDoc.data() as AffiliateReferral;
      referralCode = referral.referralCode;
      
      console.log(`Found referral code ${referralCode} for user ${userId}`);
    }
    
    // Get affiliate by referral code
    const affiliate = await getAffiliateByReferralCode(referralCode);
    if (!affiliate) {
      throw new Error('Invalid referral code');
    }
    
    // Get commission rate from settings
    const settingsRef = doc(db, SETTINGS_COLLECTION, 'default');
    const settingsDoc = await getDoc(settingsRef);
    
    if (!settingsDoc.exists()) {
      throw new Error('Affiliate settings not found');
    }
    
    const settings = settingsDoc.data() as AffiliateSettings;
    const commissionRate = settings.defaultCommissionRate;
    
    // Calculate commission amount
    const commissionAmount = Math.floor(orderTotal * (commissionRate / 100));
    
    // Create commission record
    const commissionData: Omit<AffiliateCommission, 'id'> = {
      affiliateId: affiliate.id,
      referralId: '',
      orderId,
      orderTotal,
      commissionAmount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const commissionRef = await addDoc(collection(db, COMMISSIONS_COLLECTION), commissionData);
    
    // Find and update referral if exists
    const referralsRef = collection(db, REFERRALS_COLLECTION);
    
    // First try to find by userId
    let q = query(
      referralsRef,
      where('referralCode', '==', referralCode),
      where('referredUserId', '==', userId),
      limit(1)
    );
    
    let querySnapshot = await getDocs(q);
    
    // If not found by userId, try to find by visitorId or just referralCode
    if (querySnapshot.empty) {
      q = query(
        referralsRef,
        where('referralCode', '==', referralCode),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      querySnapshot = await getDocs(q);
    }
    
    if (!querySnapshot.empty) {
      const referralDoc = querySnapshot.docs[0];
      const referral = referralDoc.data() as AffiliateReferral;
      
      // Get user info if available
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      const userName = userDoc.exists() ? userDoc.data().displayName || userDoc.data().email : '';
      const userEmail = userDoc.exists() ? userDoc.data().email : '';
      
      // Update referral with order info
      await updateDoc(referralDoc.ref, {
        orderId,
        orderTotal,
        commissionAmount,
        status: 'ordered',
        referredUserId: userId,
        referredUserEmail: userEmail || referral.referredUserEmail,
        referredUserName: userName || referral.referredUserName,
        orderedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Update commission with referral ID
      await updateDoc(commissionRef, {
        referralId: referralDoc.id
      });
      
      console.log(`Updated referral ${referralDoc.id} with order info`);
    } else {
      // Create new referral record if none exists
      console.log(`No existing referral found, creating new one for order ${orderId}`);
      
      // Get user info
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      const userName = userDoc.exists() ? userDoc.data().displayName || userDoc.data().email : '';
      const userEmail = userDoc.exists() ? userDoc.data().email : '';
      
      const newReferral: Partial<AffiliateReferral> = {
        referralCode,
        referrerId: affiliate.id,
        referredUserId: userId,
        referredUserEmail: userEmail,
        referredUserName: userName,
        orderId,
        orderTotal,
        commissionAmount,
        status: 'ordered',
        orderedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const referralDocRef = await addDoc(collection(db, REFERRALS_COLLECTION), newReferral);
      
      // Update commission with referral ID
      await updateDoc(commissionRef, {
        referralId: referralDocRef.id
      });
    }
    
    // Update affiliate stats
    await updateDoc(doc(db, AFFILIATES_COLLECTION, affiliate.id), {
      totalCommission: increment(commissionAmount),
      pendingCommission: increment(commissionAmount),
      updatedAt: new Date().toISOString()
    });
    
    console.log(`Successfully created order ${orderId} with referral, commission: ${commissionAmount}`);
  } catch (error) {
    console.error('Error creating order with referral:', error);
    throw error;
  }
};

// Get affiliate referrals
export const getAffiliateReferrals = async (affiliateId: string): Promise<AffiliateReferral[]> => {
  try {
    const referralsRef = collection(db, REFERRALS_COLLECTION);
    const q = query(
      referralsRef,
      where('referrerId', '==', affiliateId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AffiliateReferral));
  } catch (error) {
    console.error('Error getting affiliate referrals:', error);
    throw error;
  }
};

// Get affiliate commissions
export const getAffiliateCommissions = async (affiliateId: string): Promise<AffiliateCommission[]> => {
  try {
    const commissionsRef = collection(db, COMMISSIONS_COLLECTION);
    const q = query(
      commissionsRef,
      where('affiliateId', '==', affiliateId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AffiliateCommission));
  } catch (error) {
    console.error('Error getting affiliate commissions:', error);
    throw error;
  }
};

// Get affiliate settings
export const getAffiliateSettings = async (): Promise<AffiliateSettings> => {
  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, 'default');
    const settingsDoc = await getDoc(settingsRef);
    
    if (!settingsDoc.exists()) {
      // Create default settings if not exists
      const defaultSettings: Omit<AffiliateSettings, 'id'> = {
        defaultCommissionRate: 5, // 5%
        minPayoutAmount: 5000, // ¥5000
        payoutMethods: ['Bank Transfer'],
        termsAndConditions: 'Default terms and conditions for the affiliate program.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(settingsRef, defaultSettings);
      
      return {
        id: 'default',
        ...defaultSettings
      };
    }
    
    return {
      id: settingsDoc.id,
      ...settingsDoc.data()
    } as AffiliateSettings;
  } catch (error) {
    console.error('Error getting affiliate settings:', error);
    throw error;
  }
};

// Update affiliate settings
export const updateAffiliateSettings = async (settings: Partial<AffiliateSettings>): Promise<void> => {
  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, 'default');
    
    await updateDoc(settingsRef, {
      ...settings,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating affiliate settings:', error);
    throw error;
  }
};

// Get all affiliates (for admin)
export const getAllAffiliates = async (): Promise<AffiliateUser[]> => {
  try {
    const affiliatesRef = collection(db, AFFILIATES_COLLECTION);
    const querySnapshot = await getDocs(affiliatesRef);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AffiliateUser));
  } catch (error) {
    console.error('Error getting all affiliates:', error);
    throw error;
  }
};

// Approve commission
export const approveCommission = async (
  commissionId: string, 
  adminId: string
): Promise<void> => {
  try {
    const commissionRef = doc(db, COMMISSIONS_COLLECTION, commissionId);
    const commissionDoc = await getDoc(commissionRef);
    
    if (!commissionDoc.exists()) {
      throw new Error('Commission not found');
    }
    
    const commission = commissionDoc.data() as AffiliateCommission;
    
    // Update commission status
    await updateDoc(commissionRef, {
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: adminId,
      updatedAt: new Date().toISOString()
    });
    
    // Update referral if exists
    if (commission.referralId) {
      await updateDoc(doc(db, REFERRALS_COLLECTION, commission.referralId), {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: adminId,
        updatedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error approving commission:', error);
    throw error;
  }
};

// Reject commission
export const rejectCommission = async (
  commissionId: string, 
  adminId: string,
  reason: string
): Promise<void> => {
  try {
    const commissionRef = doc(db, COMMISSIONS_COLLECTION, commissionId);
    const commissionDoc = await getDoc(commissionRef);
    
    if (!commissionDoc.exists()) {
      throw new Error('Commission not found');
    }
    
    const commission = commissionDoc.data() as AffiliateCommission;
    
    // Update commission status
    await updateDoc(commissionRef, {
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: adminId,
      notes: reason,
      updatedAt: new Date().toISOString()
    });
    
    // Update referral if exists
    if (commission.referralId) {
      await updateDoc(doc(db, REFERRALS_COLLECTION, commission.referralId), {
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: adminId,
        updatedAt: new Date().toISOString()
      });
    }
    
    // Update affiliate stats
    await updateDoc(doc(db, AFFILIATES_COLLECTION, commission.affiliateId), {
      pendingCommission: increment(-commission.commissionAmount),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error rejecting commission:', error);
    throw error;
  }
};

// Request payout
export const requestPayout = async (
  affiliateId: string,
  amount: number,
  method: string,
  bankInfo?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  }
): Promise<string> => {
  try {
    // Validate amount against minimum payout
    const settings = await getAffiliateSettings();
    if (amount < settings.minPayoutAmount) {
      throw new Error(`Minimum payout amount is ¥${settings.minPayoutAmount}`);
    }
    
    // Check if affiliate has enough pending commission
    const affiliateRef = doc(db, AFFILIATES_COLLECTION, affiliateId);
    const affiliateDoc = await getDoc(affiliateRef);
    
    if (!affiliateDoc.exists()) {
      throw new Error('Affiliate not found');
    }
    
    const affiliate = affiliateDoc.data() as AffiliateUser;
    
    if (affiliate.pendingCommission < amount) {
      throw new Error('Insufficient pending commission');
    }
    
    // Create payout request
    const payoutData: Omit<AffiliatePayout, 'id'> = {
      affiliateId,
      amount,
      method,
      status: 'pending',
      bankInfo,
      requestedAt: new Date().toISOString()
    };
    
    const payoutRef = await addDoc(collection(db, PAYOUTS_COLLECTION), payoutData);
    
    // Update affiliate stats
    await updateDoc(affiliateRef, {
      pendingCommission: increment(-amount),
      updatedAt: new Date().toISOString()
    });
    
    return payoutRef.id;
  } catch (error) {
    console.error('Error requesting payout:', error);
    throw error;
  }
};

// Process payout (admin)
export const processPayout = async (
  payoutId: string,
  adminId: string,
  status: 'processing' | 'completed' | 'rejected',
  notes?: string
): Promise<void> => {
  try {
    const payoutRef = doc(db, PAYOUTS_COLLECTION, payoutId);
    const payoutDoc = await getDoc(payoutRef);
    
    if (!payoutDoc.exists()) {
      throw new Error('Payout not found');
    }
    
    const payout = payoutDoc.data() as AffiliatePayout;
    
    if (payout.status !== 'pending' && status === 'processing') {
      throw new Error('Payout is not in pending status');
    }
    
    if (payout.status !== 'processing' && status === 'completed') {
      throw new Error('Payout is not in processing status');
    }
    
    const updateData: any = {
      status,
      notes,
      updatedAt: new Date().toISOString()
    };
    
    if (status === 'processing') {
      updateData.processedAt = new Date().toISOString();
      updateData.processedBy = adminId;
    } else if (status === 'completed') {
      updateData.completedAt = new Date().toISOString();
      updateData.completedBy = adminId;
      
      // Update affiliate stats
      await updateDoc(doc(db, AFFILIATES_COLLECTION, payout.affiliateId), {
        paidCommission: increment(payout.amount),
        updatedAt: new Date().toISOString()
      });
    } else if (status === 'rejected') {
      updateData.rejectedAt = new Date().toISOString();
      updateData.rejectedBy = adminId;
      
      // Return amount to pending commission
      await updateDoc(doc(db, AFFILIATES_COLLECTION, payout.affiliateId), {
        pendingCommission: increment(payout.amount),
        updatedAt: new Date().toISOString()
      });
    }
    
    await updateDoc(payoutRef, updateData);
  } catch (error) {
    console.error('Error processing payout:', error);
    throw error;
  }
};

// Get affiliate payouts
export const getAffiliatePayouts = async (affiliateId: string): Promise<AffiliatePayout[]> => {
  try {
    const payoutsRef = collection(db, PAYOUTS_COLLECTION);
    const q = query(
      payoutsRef,
      where('affiliateId', '==', affiliateId),
      orderBy('requestedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AffiliatePayout));
  } catch (error) {
    console.error('Error getting affiliate payouts:', error);
    throw error;
  }
};

// Get all payouts (admin)
export const getAllPayouts = async (): Promise<AffiliatePayout[]> => {
  try {
    const payoutsRef = collection(db, PAYOUTS_COLLECTION);
    const q = query(payoutsRef, orderBy('requestedAt', 'desc'));
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AffiliatePayout));
  } catch (error) {
    console.error('Error getting all payouts:', error);
    throw error;
  }
};

// Subscribe to affiliate stats (real-time)
export const subscribeToAffiliateStats = (
  affiliateId: string,
  callback: (affiliate: AffiliateUser) => void 
) => {
  try {
    const affiliateRef = doc(db, AFFILIATES_COLLECTION, affiliateId);
    
    return onSnapshot(affiliateRef, (doc) => {
      if (doc.exists()) {
        callback({
          id: doc.id,
          ...doc.data()
        } as AffiliateUser);
      }
    }, (error) => {
      console.error('Error in affiliate stats snapshot:', error);
    });
  } catch (error) {
    console.error('Error setting up affiliate stats subscription:', error);
    // Return a no-op function to avoid errors when unsubscribing
    return () => {};
  }
};

// Subscribe to affiliate referrals (real-time)
export const subscribeToAffiliateReferrals = (
  affiliateId: string,
  callback: (referrals: AffiliateReferral[]) => void 
): (() => void) => {
  try {
    const referralsRef = collection(db, REFERRALS_COLLECTION);
    
    // Use a simpler query to avoid index requirements
    const q = query(
      referralsRef,
      where('referrerId', '==', affiliateId)
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const referrals = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AffiliateReferral));
      
      // Sort manually in memory
      referrals.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime; // Descending order
      });
      
      console.log(`Received ${referrals.length} referrals for affiliate ${affiliateId}`);
      callback(referrals);
    }, (error) => {
      console.error('Error in referrals snapshot:', error);
    });
  } catch (error) {
    console.error('Error setting up referrals subscription:', error);
    // Return a no-op function to avoid errors when unsubscribing
    return () => {};
  }
};

// Subscribe to affiliate commissions (real-time)
export const subscribeToAffiliateCommissions = (
  affiliateId: string,
  callback: (commissions: AffiliateCommission[]) => void 
): (() => void) => {
  try {
    const commissionsRef = collection(db, COMMISSIONS_COLLECTION);
    
    // Use a simpler query to avoid index requirements
    const q = query(
      commissionsRef,
      where('affiliateId', '==', affiliateId)
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const commissions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AffiliateCommission));
      
      // Sort manually in memory
      commissions.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime; // Descending order
      });
      
      callback(commissions);
    }, (error) => {
      console.error('Error in commissions snapshot:', error);
    });
  } catch (error) {
    console.error('Error setting up commissions subscription:', error);
    // Return a no-op function to avoid errors when unsubscribing
    return () => {};
  }
};

// Subscribe to affiliate payouts (real-time)
export const subscribeToAffiliatePayouts = (
  affiliateId: string,
  callback: (payouts: AffiliatePayout[]) => void 
): (() => void) => {
  try {
    const payoutsRef = collection(db, PAYOUTS_COLLECTION);
    
    // Use a simpler query to avoid index requirements
    const q = query(
      payoutsRef,
      where('affiliateId', '==', affiliateId)
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const payouts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AffiliatePayout));
      
      // Sort manually in memory
      payouts.sort((a, b) => {
        const aTime = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
        const bTime = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
        return bTime - aTime; // Descending order
      });
      
      callback(payouts);
    }, (error) => {
      console.error('Error in payouts snapshot:', error);
    });
  } catch (error) {
    console.error('Error setting up payouts subscription:', error);
    // Return a no-op function to avoid errors when unsubscribing
    return () => {};
  }
};

// Update affiliate bank info
export const updateAffiliateBankInfo = async (
  affiliateId: string,
  bankInfo: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  }
): Promise<void> => {
  try {
    const affiliateRef = doc(db, AFFILIATES_COLLECTION, affiliateId);
    
    await updateDoc(affiliateRef, {
      bankInfo,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating affiliate bank info:', error);
    throw error;
  }
};

// Get affiliate followers
export const getAffiliateFollowers = async (affiliateId: string): Promise<AffiliateFollower[]> => {
  try {
    console.log(`Getting followers for affiliate ${affiliateId}`);
    
    const referralsRef = collection(db, REFERRALS_COLLECTION);
    const q = query(
      referralsRef,
      where('referrerId', '==', affiliateId),
      where('status', 'in', ['registered', 'ordered', 'approved', 'purchased']),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    console.log(`Found ${querySnapshot.size} referrals with registered/ordered status`);
    
    // Group by referred user ID to get unique followers
    const followersMap = new Map<string, AffiliateFollower>();
    
    for (const doc of querySnapshot.docs) {
      const referral = doc.data() as AffiliateReferral;
      
      if (referral.referredUserId && !followersMap.has(referral.referredUserId)) {
        console.log(`Adding follower from referral: ${JSON.stringify({
          id: referral.referredUserId,
          email: referral.referredUserEmail,
          name: referral.referredUserName
        })}`);
        
        followersMap.set(referral.referredUserId, {
          id: doc.id,
          affiliateId,
          userId: referral.referredUserId,
          email: referral.referredUserEmail || '',
          displayName: referral.referredUserName || referral.referredUserEmail?.split('@')[0] || '',
          totalOrders: referral.orderId ? 1 : 0,
          totalSpent: referral.orderTotal || 0,
          firstOrderDate: referral.orderedAt || '',
          lastOrderDate: referral.orderedAt || '',
          createdAt: referral.createdAt
        });
      }
    }
    
    // Get order information for each follower
    const followers = Array.from(followersMap.values());
    console.log(`Returning ${followers.length} unique followers`);
    
    return followers;
  } catch (error) {
    console.error('Error getting affiliate followers:', error);
    throw error;
  }
};

// Initialize affiliate settings if not exists
export const initializeAffiliateSettings = async (): Promise<void> => {
  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, 'default');
    const settingsDoc = await getDoc(settingsRef);
    
    if (!settingsDoc.exists()) {
      const defaultSettings: Omit<AffiliateSettings, 'id'> = {
        defaultCommissionRate: 5, // 5%
        minPayoutAmount: 5000, // ¥5000
        payoutMethods: ['Bank Transfer'],
        termsAndConditions: 'Default terms and conditions for the affiliate program.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(settingsRef, defaultSettings);
    }
  } catch (error) {
    console.error('Error initializing affiliate settings:', error);
    throw error;
  }
};