import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useFirebaseAuth';
import { useProducts } from '@/hooks/useProducts';
import { collection, addDoc, runTransaction, doc, onSnapshot, query, setDoc } from 'firebase/firestore';
import RealtimeClock from '@/components/admin/RealtimeClock';
import { db } from '@/config/firebase';
import { toast } from '@/hooks/use-toast';
import AdminLayout from '@/components/admin/AdminLayout';
import { Product } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { usePOSTransactions } from '@/hooks/usePOSTransactions';

// UI Components
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Clock, 
  Calendar, 
  Filter, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  DollarSign,
  Receipt,
  Printer,
  AlertOctagon
} from 'lucide-react';

// Cart item interface
interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  price: number;
  totalPrice: number;
}

const POSSystem = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products = [], isLoading: productsLoading, error: productsError } = useProducts();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState<number | ''>('');
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isTransactionComplete, setIsTransactionComplete] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentTransaction, setCurrentTransaction] = useState<any>(null);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  
  // Get transactions for the selected date
  const { transactions, loading: transactionsLoading, error: transactionsError } = usePOSTransactions(selectedDate);

  // Get unique categories from products
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];

  // Filter products based on search term and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculate cart total
  const cartTotal = cart.reduce((total, item) => total + item.totalPrice, 0);
  
  // Calculate change amount
  const changeAmount = typeof cashReceived === 'number' ? Math.max(0, cashReceived - cartTotal) : 0;

  // Add product to cart
  const addToCart = (product: Product) => {
    // Check if product is already in cart
    const existingItemIndex = cart.findIndex(item => item.id === product.id);
    
    if (existingItemIndex !== -1) {
      // Update quantity of existing item
      const updatedCart = [...cart];
      updatedCart[existingItemIndex].quantity += 1;
      updatedCart[existingItemIndex].totalPrice = updatedCart[existingItemIndex].quantity * updatedCart[existingItemIndex].price;
      setCart(updatedCart);
    } else {
      // Add new item to cart
      setCart([...cart, {
        id: product.id,
        product,
        quantity: 1,
        price: product.price,
        totalPrice: product.price
      }]);
    }
  };

  // Update cart item quantity
  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(id);
      return;
    }
    
    const updatedCart = cart.map(item => {
      if (item.id === id) {
        return {
          ...item,
          quantity: newQuantity,
          totalPrice: newQuantity * item.price
        };
      }
      return item;
    });
    
    setCart(updatedCart);
  };

  // Remove item from cart
  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
  };

  // Handle checkout
  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: "Keranjang Kosong",
        description: "Tambahkan produk ke keranjang terlebih dahulu",
        variant: "destructive"
      });
      return;
    }
    
    setIsCheckoutDialogOpen(true);
  };

  // Process payment
  const processPayment = async () => {
    if (cart.length === 0) return;
    
    if (paymentMethod === 'cash' && (typeof cashReceived !== 'number' || cashReceived < cartTotal)) {
      toast({
        title: "Jumlah Uang Tidak Cukup",
        description: "Jumlah uang yang diterima harus lebih besar atau sama dengan total belanja",
        variant: "destructive"
      });
      return;
    }
    
    setIsProcessingPayment(true);
    
    try {
      // Create transaction object
      const transaction = {
        items: cart.map(item => ({
          id: item.id,
          product: {
            id: item.product.id,
            name: item.product.name,
            price: item.product.price,
            category: item.product.category,
            image_url: item.product.image_url
          },
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice
        })),
        totalAmount: cartTotal,
        paymentMethod,
        cashReceived: paymentMethod === 'cash' ? cashReceived : undefined,
        change: paymentMethod === 'cash' ? changeAmount : undefined,
        status: 'completed',
        createdAt: new Date().toISOString(),
        cashierId: user?.uid || 'unknown',
        cashierName: user?.displayName || user?.email || 'Unknown Cashier'
      };
      
      // Save transaction to Firestore
      const transactionRef = await addDoc(collection(db, 'pos_transactions'), transaction);
      console.log('Transaction saved with ID:', transactionRef.id);
      
      // Update product stock (optional)
      // This would require a transaction to ensure atomicity
      
      // Set current transaction for receipt
      setCurrentTransaction({
        ...transaction,
        id: transactionRef.id
      });
      
      // Show success message
      toast({
        title: "Transaksi Berhasil",
        description: "Pembayaran telah diproses dan transaksi disimpan",
      });
      
      // Reset state
      setIsTransactionComplete(true);
      
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: "Transaksi Gagal",
        description: "Terjadi kesalahan saat memproses pembayaran",
        variant: "destructive"
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Complete transaction and reset
  const completeTransaction = () => {
    setIsCheckoutDialogOpen(false);
    setIsTransactionComplete(false);
    setCart([]);
    setCashReceived('');
    setPaymentMethod('cash');
  };

  // Show receipt
  const showReceipt = (transaction: any) => {
    setCurrentTransaction(transaction);
    setIsReceiptDialogOpen(true);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Print receipt
  const printReceipt = () => {
    window.print();
  };

  // Render error state
  if (productsError) {
    return (
      <AdminLayout>
        <div className="p-8 flex flex-col items-center justify-center">
          <AlertOctagon className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Products</h2>
          <p className="text-gray-600 mb-4">Terjadi kesalahan saat memuat data produk.</p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Halaman
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">POS Kasir</h1>
            <p className="text-gray-600">Point of Sale untuk transaksi langsung</p>
          </div>
          <div className="flex items-center space-x-4">
            <RealtimeClock showIcon={true} showDate={true} showSeconds={true} />
          </div>
        </div>

        <Tabs defaultValue="pos" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="pos" className="flex items-center">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Kasir
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center">
              <Receipt className="w-4 h-4 mr-2" />
              Riwayat Transaksi
            </TabsTrigger>
          </TabsList>

          {/* POS Tab */}
          <TabsContent value="pos">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Product Selection */}
              <div className="lg:col-span-2">
                <Card className="mb-6">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                      <CardTitle>Pilih Produk</CardTitle>
                      <div className="flex space-x-2">
                        <div className="relative w-full sm:w-64">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input
                            placeholder="Cari produk..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Kategori" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category === 'all' ? 'Semua Kategori' : category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {productsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="text-center py-12">
                        <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Produk Tidak Ditemukan
                        </h3>
                        <p className="text-gray-500">
                          Coba gunakan kata kunci lain atau pilih kategori yang berbeda
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {filteredProducts.map((product) => (
                          <motion.div
                            key={product.id}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => addToCart(product)}
                            className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                          >
                            <div className="p-2 text-center">
                              <div className="w-full h-24 bg-gray-100 rounded-md mb-2 flex items-center justify-center overflow-hidden">
                                {product.image_url ? (
                                  <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ShoppingCart className="w-8 h-8 text-gray-400" />
                                )}
                              </div>
                              <h3 className="font-medium text-sm text-gray-900 line-clamp-2 h-10">
                                {product.name}
                              </h3>
                              <p className="text-primary font-bold mt-1">
                                {formatCurrency(product.price)}
                              </p>
                              <Badge variant="outline" className="mt-1 text-xs">
                                Stok: {product.stock}
                              </Badge>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Cart */}
              <div className="lg:col-span-1">
                <Card className="sticky top-24">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center">
                        <ShoppingCart className="w-5 h-5 mr-2" />
                        Keranjang
                      </CardTitle>
                      <Badge variant="outline">
                        {cart.length} item
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="max-h-[calc(100vh-350px)] overflow-y-auto">
                    {cart.length === 0 ? (
                      <div className="text-center py-8">
                        <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Keranjang Kosong
                        </h3>
                        <p className="text-gray-500">
                          Tambahkan produk ke keranjang untuk memulai transaksi
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {cart.map((item) => (
                          <div key={item.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{item.product.name}</h4>
                              <p className="text-sm text-gray-500">{formatCurrency(item.price)} x {item.quantity}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => removeFromCart(item.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="text-right font-medium w-20">
                              {formatCurrency(item.totalPrice)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex flex-col">
                    <div className="w-full py-4 border-t border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-medium">{formatCurrency(cartTotal)}</span>
                      </div>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-gray-600">Total</span>
                        <span className="text-xl font-bold text-primary">{formatCurrency(cartTotal)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          onClick={clearCart}
                          disabled={cart.length === 0}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Bersihkan
                        </Button>
                        <Button
                          onClick={handleCheckout}
                          disabled={cart.length === 0}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Bayar
                        </Button>
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                  <CardTitle>Riwayat Transaksi</CardTitle>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-40"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  </div>
                ) : transactionsError ? (
                  <div className="text-center py-12">
                    <AlertOctagon className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Error Loading Transactions
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {transactionsError.message || "Terjadi kesalahan saat memuat data transaksi"}
                    </p>
                    <Button onClick={() => window.location.reload()}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Belum Ada Transaksi
                    </h3>
                    <p className="text-gray-500">
                      Belum ada transaksi POS pada tanggal ini
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ID Transaksi
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Waktu
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Kasir
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Metode Pembayaran
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Aksi
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {transactions.map((transaction) => (
                          <tr key={transaction.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {transaction.id.slice(0, 8)}...
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(transaction.createdAt)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {transaction.cashierName}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              <Badge variant="outline">
                                {transaction.paymentMethod === 'cash' ? 'Tunai' : 
                                 transaction.paymentMethod === 'card' ? 'Kartu' : 
                                 transaction.paymentMethod === 'qris' ? 'QRIS' : 
                                 transaction.paymentMethod}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                              {formatCurrency(transaction.totalAmount)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => showReceipt(transaction)}
                              >
                                <Receipt className="w-4 h-4 mr-2" />
                                Struk
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutDialogOpen} onOpenChange={setIsCheckoutDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
            <DialogDescription>
              Pilih metode pembayaran dan selesaikan transaksi
            </DialogDescription>
          </DialogHeader>
          
          {!isTransactionComplete ? (
            <>
              <div className="grid gap-4 py-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Belanja:</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(cartTotal)}</span>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  <label className="text-sm font-medium">Metode Pembayaran</label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih metode pembayaran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Tunai</SelectItem>
                      <SelectItem value="card">Kartu</SelectItem>
                      <SelectItem value="qris">QRIS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {paymentMethod === 'cash' && (
                  <div className="grid grid-cols-1 gap-2">
                    <label className="text-sm font-medium">Jumlah Uang Diterima</label>
                    <Input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                    />
                    
                    {typeof cashReceived === 'number' && cashReceived >= cartTotal && (
                      <div className="bg-green-50 p-3 rounded-md mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-green-700 font-medium">Kembalian:</span>
                          <span className="text-green-700 font-bold">{formatCurrency(changeAmount)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {paymentMethod === 'qris' && (
                  <div className="flex flex-col items-center justify-center py-4">
                    <QRCode />
                    <p className="text-sm text-gray-500 mt-2">Scan QR code untuk pembayaran</p>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCheckoutDialogOpen(false)}>
                  Batal
                </Button>
                <Button 
                  onClick={processPayment} 
                  disabled={isProcessingPayment || (paymentMethod === 'cash' && (typeof cashReceived !== 'number' || cashReceived < cartTotal))}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isProcessingPayment ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Selesaikan Pembayaran
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center justify-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Transaksi Berhasil!</h3>
                <p className="text-gray-600 text-center mb-4">
                  Pembayaran telah diproses dan transaksi telah disimpan
                </p>
                
                {paymentMethod === 'cash' && (
                  <div className="bg-green-50 p-4 rounded-md w-full mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-green-700">Total:</span>
                      <span className="text-green-700 font-bold">{formatCurrency(cartTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-green-700">Diterima:</span>
                      <span className="text-green-700 font-bold">{formatCurrency(cashReceived as number)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-green-200">
                      <span className="text-green-700 font-medium">Kembalian:</span>
                      <span className="text-green-700 font-bold">{formatCurrency(changeAmount)}</span>
                    </div>
                  </div>
                )}
              </div>
              
              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  className="sm:flex-1"
                  onClick={() => {
                    setIsReceiptDialogOpen(true);
                    setIsCheckoutDialogOpen(false);
                  }}
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  Lihat Struk
                </Button>
                <Button 
                  className="sm:flex-1 bg-green-600 hover:bg-green-700"
                  onClick={completeTransaction}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Transaksi Baru
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={isReceiptDialogOpen} onOpenChange={setIsReceiptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Struk Pembayaran</DialogTitle>
          </DialogHeader>
          
          {currentTransaction && (
            <div className="py-4" id="receipt-to-print">
              <div className="text-center mb-4">
                <h3 className="font-bold text-lg">Injapan Food</h3>
                <p className="text-sm text-gray-600">Makanan Indonesia di Jepang</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(currentTransaction.createdAt)}
                </p>
                <p className="text-xs text-gray-500">
                  ID: {currentTransaction.id.slice(0, 8)}
                </p>
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-2 mb-4">
                {currentTransaction.items.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between text-sm">
                    <div>
                      <span>{item.product.name}</span>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(item.price)} x {item.quantity}
                      </div>
                    </div>
                    <span className="font-medium">{formatCurrency(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Total:</span>
                  <span className="font-bold">{formatCurrency(currentTransaction.totalAmount)}</span>
                </div>
                
                {currentTransaction.paymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Tunai:</span>
                      <span>{formatCurrency(currentTransaction.cashReceived)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Kembalian:</span>
                      <span>{formatCurrency(currentTransaction.change)}</span>
                    </div>
                  </>
                )}
                
                <div className="flex justify-between text-sm">
                  <span>Metode Pembayaran:</span>
                  <span>
                    {currentTransaction.paymentMethod === 'cash' ? 'Tunai' : 
                     currentTransaction.paymentMethod === 'card' ? 'Kartu' : 
                     currentTransaction.paymentMethod === 'qris' ? 'QRIS' : 
                     currentTransaction.paymentMethod}
                  </span>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div className="text-center text-xs text-gray-500">
                <p>Terima kasih telah berbelanja di Injapan Food</p>
                <p>Kasir: {currentTransaction.cashierName}</p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReceiptDialogOpen(false)}>
              Tutup
            </Button>
            <Button onClick={printReceipt}>
              <Printer className="w-4 h-4 mr-2" />
              Print Struk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

// Simple QR Code component for demo
const QRCode = () => (
  <div className="w-40 h-40 mx-auto bg-white p-2 rounded-lg border">
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <div className="grid grid-cols-5 grid-rows-5 gap-1 w-4/5 h-4/5">
        {/* QR Code corners */}
        <div className="col-span-1 row-span-1 bg-white rounded-tl-lg"></div>
        <div className="col-span-1 row-span-1 bg-white"></div>
        <div className="col-span-1 row-span-1 bg-white"></div>
        <div className="col-span-1 row-span-1 bg-white"></div>
        <div className="col-span-1 row-span-1 bg-white rounded-tr-lg"></div>
        
        <div className="col-span-1 row-span-1 bg-white"></div>
        <div className="col-span-1 row-span-1 bg-black rounded-lg"></div>
        <div className="col-span-1 row-span-1 bg-white"></div>
        <div className="col-span-1 row-span-1 bg-black rounded-lg"></div>
        <div className="col-span-1 row-span-1 bg-white"></div>
        
        <div className="col-span-1 row-span-1 bg-white"></div>
        <div className="col-span-1 row-span-1 bg-white"></div>
        <div className="col-span-1 row-span-1 bg-black rounded-lg"></div>
        <div className="col-span-1 row-span-1 bg-white"></div>
        <div className="col-span-1 row-span-1 bg-white"></div>
        
        <div className="col-span-1 row-span-1 bg-white"></div>
        <div className="col-span-1 row-span-1 bg-black rounded-lg"></div>
        <div className="col-span-1 row-span-1 bg-white"></div>
        <div className="col-span-1 row-span-1 bg-black rounded-lg"></div>
        <div className="col-span-1 row-span-1 bg-white"></div>
        
        <div className="col-span-1 row-span-1 bg-white rounded-bl-lg"></div>
        <div className="col-span-1 row-span-1 bg-white"></div>
        <div className="col-span-1 row-span-1 bg-white"></div>
        <div className="col-span-1 row-span-1 bg-white"></div>
        <div className="col-span-1 row-span-1 bg-white rounded-br-lg"></div>
      </div>
    </div>
  </div>
);

export default POSSystem;