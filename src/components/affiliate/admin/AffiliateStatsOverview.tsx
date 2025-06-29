import { useAffiliateAdmin } from '@/hooks/useAffiliateAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, ShoppingCart, DollarSign } from 'lucide-react';

const AffiliateStatsOverview = () => {
  const { affiliates, commissions, loading } = useAffiliateAdmin();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-5 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Calculate total stats
  const totalAffiliates = affiliates.length;
  
  const totalClicks = affiliates.reduce((sum, affiliate) => sum + affiliate.totalClicks, 0);
  
  const totalReferrals = affiliates.reduce((sum, affiliate) => sum + affiliate.totalReferrals, 0);
  
  const totalCommission = affiliates.reduce((sum, affiliate) => sum + affiliate.totalCommission, 0);
  
  const pendingCommission = affiliates.reduce((sum, affiliate) => sum + affiliate.pendingCommission, 0);
  
  const pendingCommissions = commissions.filter(commission => commission.status === 'pending').length;

  const stats = [
    {
      title: 'Total Affiliate',
      value: totalAffiliates,
      icon: Users,
      color: 'bg-blue-500',
      description: 'Jumlah user yang bergabung program affiliate'
    },
    {
      title: 'Total Klik',
      value: totalClicks,
      icon: TrendingUp,
      color: 'bg-green-500',
      description: 'Jumlah klik pada link affiliate'
    },
    {
      title: 'Komisi Pending',
      value: `¥${pendingCommission.toLocaleString()}`,
      icon: ShoppingCart,
      color: 'bg-yellow-500',
      description: `${pendingCommissions} komisi menunggu persetujuan`
    },
    {
      title: 'Total Komisi',
      value: `¥${totalCommission.toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-red-500',
      description: 'Total komisi yang dihasilkan'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${stat.color}`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AffiliateStatsOverview;