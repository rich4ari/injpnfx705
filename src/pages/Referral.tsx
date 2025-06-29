import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useFirebaseAuth';
import { AffiliateProvider, useAffiliate } from '@/hooks/useAffiliate';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AffiliateStats from '@/components/affiliate/AffiliateStats';
import ReferralLinkCard from '@/components/affiliate/ReferralLinkCard';
import ReferralsTable from '@/components/affiliate/ReferralsTable';
import CommissionsTable from '@/components/affiliate/CommissionsTable';
import FollowersTable from '@/components/affiliate/FollowersTable';
import PayoutsTable from '@/components/affiliate/PayoutsTable';
import PayoutRequestForm from '@/components/affiliate/PayoutRequestForm';
import JoinAffiliateCard from '@/components/affiliate/JoinAffiliateCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ReferralContent = () => {
  const { affiliate, loading } = useAffiliate();

  // Enhanced scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded w-full"></div>
          <div className="h-64 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Program Affiliate</h1>
          <JoinAffiliateCard />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard Affiliate</h1>
      
      <div className="mb-8">
        <AffiliateStats />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2">
          <ReferralLinkCard />
        </div>
        <div className="lg:col-span-1">
          <PayoutRequestForm />
        </div>
      </div>
      
      <Tabs defaultValue="referrals" className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="referrals">Referral</TabsTrigger>
          <TabsTrigger value="commissions">Komisi</TabsTrigger>
          <TabsTrigger value="followers">Pengikut</TabsTrigger>
          <TabsTrigger value="payouts">Pencairan</TabsTrigger>
        </TabsList>
        
        <TabsContent value="referrals">
          <ReferralsTable />
        </TabsContent>
        
        <TabsContent value="commissions">
          <CommissionsTable />
        </TabsContent>
        
        <TabsContent value="followers">
          <FollowersTable />
        </TabsContent>
        
        <TabsContent value="payouts">
          <PayoutsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Referral = () => {
  const { user, loading: authLoading } = useAuth();

  // Redirect to auth if not logged in
  if (!authLoading && !user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AffiliateProvider>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <ReferralContent />
        <Footer />
      </div>
    </AffiliateProvider>
  );
};

export default Referral;