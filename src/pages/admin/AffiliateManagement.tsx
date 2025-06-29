import { useEffect } from 'react';
import { AffiliateAdminProvider, useAffiliateAdmin } from '@/hooks/useAffiliateAdmin';
import AdminLayout from '@/components/admin/AdminLayout';
import AffiliateStatsOverview from '@/components/affiliate/admin/AffiliateStatsOverview';
import AffiliatesTable from '@/components/affiliate/admin/AffiliatesTable';
import CommissionsAdminTable from '@/components/affiliate/admin/CommissionsAdminTable';
import PayoutsAdminTable from '@/components/affiliate/admin/PayoutsAdminTable';
import AffiliateSettingsForm from '@/components/affiliate/admin/AffiliateSettingsForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AffiliateManagementContent = () => {
  // Enhanced scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Manajemen Affiliate</h1>
        <p className="text-gray-600">Kelola program affiliate, komisi, dan pencairan</p>
      </div>
      
      <div className="mb-8">
        <AffiliateStatsOverview />
      </div>
      
      <Tabs defaultValue="affiliates" className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="affiliates">Daftar Affiliate</TabsTrigger>
          <TabsTrigger value="commissions">Komisi</TabsTrigger>
          <TabsTrigger value="payouts">Pencairan</TabsTrigger>
          <TabsTrigger value="settings">Pengaturan</TabsTrigger>
        </TabsList>
        
        <TabsContent value="affiliates">
          <AffiliatesTable />
        </TabsContent>
        
        <TabsContent value="commissions">
          <CommissionsAdminTable />
        </TabsContent>
        
        <TabsContent value="payouts">
          <PayoutsAdminTable />
        </TabsContent>
        
        <TabsContent value="settings">
          <AffiliateSettingsForm />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const AffiliateManagement = () => {
  return (
    <AffiliateAdminProvider>
      <AdminLayout>
        <AffiliateManagementContent />
      </AdminLayout>
    </AffiliateAdminProvider>
  );
};

export default AffiliateManagement;