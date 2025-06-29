import { useState } from 'react';
import { useAffiliate } from '@/hooks/useAffiliate';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Users, RefreshCw } from 'lucide-react';

const FollowersTable = () => {
  const { followers, loading, referrals } = useAffiliate();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter followers to only include those with user information
  const validFollowers = followers.filter(follower => 
    follower.email && follower.email !== 'Guest User'
  );

  const filteredFollowers = validFollowers.filter(follower => 
    follower.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    follower.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Count registered and ordered referrals
  const registeredCount = referrals.filter(ref => 
    ref.status === 'registered' || ref.status === 'ordered' || ref.status === 'approved'
  ).length;

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Pengikut Anda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded w-full"></div>
            <div className="h-40 bg-gray-200 rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Pengikut Anda ({registeredCount})
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Cari pengikut..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {validFollowers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Belum ada pengikut</h3>
            <p className="text-gray-500 text-sm mb-4">
              Pengikut akan muncul saat ada yang mendaftar melalui link affiliate Anda
            </p>
            <Button variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Jumlah Order</TableHead>
                  <TableHead>Total Belanja</TableHead>
                  <TableHead>Bergabung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFollowers.map((follower) => (
                  <TableRow key={follower.id}>
                    <TableCell className="font-medium">
                      {follower.email}
                    </TableCell>
                    <TableCell>{follower.displayName}</TableCell>
                    <TableCell>{follower.totalOrders}</TableCell>
                    <TableCell>
                      {follower.totalSpent > 0 
                        ? `¥${follower.totalSpent.toLocaleString()}`
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(follower.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FollowersTable;