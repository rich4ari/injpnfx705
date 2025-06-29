import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAffiliate } from '@/hooks/useAffiliate';
import { toast } from '@/hooks/use-toast';
import { DollarSign, Check, AlertCircle } from 'lucide-react';

const JoinAffiliateCard = () => {
  const { joinAffiliate, loading, settings } = useAffiliate();
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    try {
      setIsJoining(true);
      await joinAffiliate();
      toast({
        title: 'Berhasil bergabung!',
        description: 'Anda telah berhasil bergabung dengan program affiliate',
      });
    } catch (error) {
      console.error('Error joining affiliate program:', error);
      toast({
        title: 'Gagal bergabung',
        description: 'Terjadi kesalahan saat bergabung dengan program affiliate',
        variant: 'destructive',
      });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="bg-primary/5">
        <CardTitle className="flex items-center text-primary">
          <DollarSign className="w-5 h-5 mr-2" />
          Program Affiliate Injapan Food
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="text-center mb-4">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Dapatkan Penghasilan Tambahan!
          </h3>
          <p className="text-gray-600">
            Bagikan link affiliate Anda dan dapatkan komisi dari setiap pembelian
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="bg-green-100 p-1 rounded-full">
              <Check className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Komisi Menarik</h4>
              <p className="text-sm text-gray-600">
                Dapatkan komisi {settings?.defaultCommissionRate || 5}% dari setiap pembelian
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="bg-green-100 p-1 rounded-full">
              <Check className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Mudah Digunakan</h4>
              <p className="text-sm text-gray-600">
                Cukup bagikan link affiliate Anda ke teman dan keluarga
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="bg-green-100 p-1 rounded-full">
              <Check className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Pencairan Cepat</h4>
              <p className="text-sm text-gray-600">
                Cairkan komisi Anda dengan minimum ¥{settings?.minPayoutAmount?.toLocaleString() || '5,000'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-md flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">Syarat & Ketentuan</h4>
            <p className="text-sm text-blue-700 mt-1">
              Dengan bergabung, Anda menyetujui syarat dan ketentuan program affiliate Injapan Food.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleJoin} 
          disabled={isJoining || loading}
          className="w-full"
        >
          {isJoining ? 'Memproses...' : 'Gabung Program Affiliate'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default JoinAffiliateCard;