import { useState, useEffect } from 'react';
import { useCurrencyConverter } from '@/hooks/useCurrencyConverter';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CreditCard, RefreshCw, QrCode, Info, ArrowRight } from 'lucide-react';

interface PaymentMethodInfoProps {
  paymentMethod: string;
  totalAmount: number;
}

const PaymentMethodInfo = ({ paymentMethod, totalAmount }: PaymentMethodInfoProps) => {
  const { convertedRupiah, isLoading, error, refreshRate, lastUpdated } = useCurrencyConverter(totalAmount, paymentMethod);
  const [showRefreshAnimation, setShowRefreshAnimation] = useState(false);

  const handleRefreshRate = () => {
    setShowRefreshAnimation(true);
    refreshRate();
    setTimeout(() => setShowRefreshAnimation(false), 1000);
  };

  if (!paymentMethod) return null;

  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <div className="flex items-center space-x-2 mb-3">
          <CreditCard className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-gray-800">{t('checkout.paymentInfo')}</h3>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">{t('payment.method')}:</span>
            <span className="font-medium">{paymentMethod}</span>
          </div>

          {paymentMethod === 'Bank Transfer (Rupiah)' && (
            <>
              <Separator />
              
              <div className="bg-blue-50 p-3 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 font-medium">{t('checkout.totalInRupiah')}</span>
                  <div className="flex items-center">
                    {isLoading ? (
                      <span className="text-gray-500">{t('checkout.converting')}</span>
                    ) : (
                      <span className="font-bold text-blue-700">
                        Rp {convertedRupiah?.toLocaleString('id-ID') || '-'}
                      </span>
                    )}
                    <button 
                      onClick={handleRefreshRate}
                      className="ml-2 text-blue-500 hover:text-blue-700"
                      title="Refresh kurs"
                    >
                      <RefreshCw className={`w-4 h-4 ${showRefreshAnimation ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
                
                {error ? (
                  <p className="text-xs text-yellow-600 mt-2">
                    {error}
                  </p>
                ) : (
                  <div className="mt-2">
                    {isLoading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-blue-600">Mengkonversi mata uang...</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-bold text-blue-700 text-lg">
                          ¥{totalAmount.toLocaleString()} / Rp {convertedRupiah?.toLocaleString('id-ID') || '-'}
                        </p>
                        {lastUpdated && (
                          <p className="text-xs text-blue-500 flex items-center justify-center">
                            <Info className="w-3 h-3 mr-1" />
                            {t('checkout.automaticRate')} {lastUpdated}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-3 text-sm text-blue-600">
                  <p className="font-medium">{t('checkout.accountInfo')}</p>
                  <p>{t('checkout.bank')} BCA</p>
                  <p>{t('checkout.accountNumber')} 1234567890</p>
                  <p>{t('checkout.accountName')} PT. Injapan Shop</p>
                </div>
              </div>
            </>
          )}

          {paymentMethod === 'Bank Transfer (Yucho / ゆうちょ銀行)' && (
            <>
              <Separator />
              
              <div className="bg-blue-50 p-3 rounded-md">
                <div className="text-sm text-blue-600">
                  <p className="font-medium">{t('checkout.accountInfo')}</p>
                  <p>{t('checkout.bank')} Yucho Bank (ゆうちょ銀行)</p>
                  <p>{t('checkout.accountNumber')} 22210551</p>
                  <p>{t('checkout.accountName')} Heri Kurnianta</p>
                  <p>Bank code: 11170</p>
                  <p>Branch code: 118</p>
                </div>
              </div>
            </>
          )}

          {paymentMethod === 'QRIS / QR Code' && (
            <>
              <Separator />
              
              <div className="bg-blue-50 p-3 rounded-md">
                <div className="flex flex-col items-center space-y-3">
                  <p className="font-medium text-blue-700">{t('checkout.scanQrCode')}</p>
                  
                  {/* Display both currencies prominently */}
                  <div className="bg-blue-100 p-3 rounded-lg w-full text-center">
                    <p className="font-bold text-blue-800 text-lg">
                      {isLoading ? (
                        <span className="flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                          {t('checkout.converting')}
                        </span>
                      ) : (
                        <>¥{totalAmount.toLocaleString()} / Rp{convertedRupiah?.toLocaleString('id-ID') || '-'}</>
                      )}
                    </p>
                    {lastUpdated && !isLoading && (
                      <p className="text-xs text-blue-600 mt-1 flex items-center justify-center">
                        <Info className="w-3 h-3 mr-1" />
                        {t('checkout.automaticRate')} {lastUpdated}
                      </p>
                    )}
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <img
                      src="/lovable-uploads/aiease_1751319905737 (1) copy.jpg"
                      alt="QRIS Payment QR Code"
                      className="w-[200px] h-auto"
                    />
                  </div>
                  
                  <p className="text-sm text-blue-700 font-medium">
                    {t('checkout.scanWithApp')}
                  </p>
                </div>
                
                <div className="mt-4 text-sm text-blue-600">
                  <p className="font-medium">{t('checkout.paymentInstructions')}</p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>{t('checkout.scanQrCodeStep')}</li>
                    <li>{t('checkout.enterAmountStep')} <strong>(¥{totalAmount.toLocaleString()} / Rp{convertedRupiah?.toLocaleString('id-ID') || '-'})</strong></li>
                    <li>{t('checkout.completePaymentStep')}</li>
                    <li>{t('checkout.uploadProofStep')}</li>
                  </ol>
                </div>
                
                {error && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md text-xs text-yellow-700">
                    <p className="flex items-center">
                      <Info className="w-3 h-3 mr-1 flex-shrink-0" />
                      Konversi mata uang menggunakan kurs perkiraan. Silakan konfirmasi kurs terbaru.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {paymentMethod === 'COD (Cash on Delivery)' && (
            <>
              <Separator />
              
              <div className="bg-green-50 p-3 rounded-md">
                <p className="text-sm text-green-600">
                  {t('checkout.codMessage')}
                </p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentMethodInfo;