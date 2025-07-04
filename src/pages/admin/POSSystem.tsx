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
  Printer
} from 'lucide-react';

// Cart item interface
interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  price: number;
  totalPrice: number;
}

// Transaction interface
interface POSTransaction {
  id: string;
  items: CartItem[];
  totalAmount: number;
  paymentMethod: string;
  cashReceived?: number;
  change?: number;
  status: 'completed' | 'cancelled';
  createdAt: string;
  cashierId: string;
  cashierName: string;
}

const POSSystem = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<POSTransaction[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<POSTransaction | null>(null);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Helper function to remove undefined values from objects and arrays
  const removeUndefined = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(removeUndefined).filter(item => item !== undefined);
    } else if (obj !== null && typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = removeUndefined(value);
        }
      }
      return cleaned;
    }
    return obj;
  };

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
  const changeAmount = Number(cashReceived) > cartTotal 
    ? Number(cashReceived) - cartTotal 
    : 0;

  // Format currency as Yen
  const formatYen = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Load recent transactions
  useEffect(() => {
    if (!user) return;
    setIsLoadingTransactions(true);
    
    console.log('Loading transactions for date:', selectedDate);
    
    const today = new Date(selectedDate);
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log('Date range:', {
      from: today.toISOString(),
      to: tomorrow.toISOString()
    });
    
    const transactionsRef = collection(db, 'pos_transactions');
    
    // Use a simple query without complex filters to avoid index requirements
    const q = query(transactionsRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Snapshot received, docs count:', snapshot.size);
      const transactions: POSTransaction[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Raw transaction data:', { id: doc.id, ...data });
        
        // Filter manually by date on the client side
        try {
          const createdAt = data.createdAt;
          if (createdAt && 
              createdAt >= today.toISOString() && 
              createdAt < tomorrow.toISOString()) {
            transactions.push({ id: doc.id, ...data } as POSTransaction);
          }
        } catch (err) {
          console.error('Error processing transaction:', err);
        }
      });
      
      console.log('Filtered transactions:', transactions.length);
      setRecentTransactions(transactions);
      setIsLoadingTransactions(false);
    }, (error) => {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat transaksi terbaru',
        variant: 'destructive'
      });
      setIsLoadingTransactions(false);
    });

    return () => unsubscribe();
  }, [user, selectedDate]);

  // Add product to cart
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast({
        title: 'Stok Habis',
        description: `${product.name} tidak tersedia`,
        variant: 'destructive'
      });
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      
      if (existingItem) {
        // Check if adding one more would exceed stock
        if (existingItem.quantity + 1 > product.stock) {
          toast({
            title: 'Stok Tidak Cukup',
            description: `Stok ${product.name} tersisa ${product.stock}`,
            variant: 'destructive'
          });
          return prevCart;
        }
        
        // Update existing item
        return prevCart.map(item => 
          item.id === product.id 
            ? { 
                ...item, 
                quantity: item.quantity + 1,
                totalPrice: (item.quantity + 1) * item.price
              } 
            : item
        );
      } else {
        // Add new item
        return [...prevCart, {
          id: product.id,
          product,
          quantity: 1,
          price: product.price,
          totalPrice: product.price
        }];
      }
    });

    // Show success toast
    toast({
      title: 'Produk Ditambahkan',
      description: `${product.name} ditambahkan ke keranjang`,
    });
  };

  // Update cart item quantity
  const updateQuantity = (id: string, change: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === id) {
          const newQuantity = Math.max(0, item.quantity + change);
          
          // Check if new quantity exceeds stock
          if (change > 0 && newQuantity > item.product.stock) {
            toast({
              title: 'Stok Tidak Cukup',
              description: `Stok ${item.product.name} tersisa ${item.product.stock}`,
              variant: 'destructive'
            });
            return item;
          }
          
          // If quantity becomes 0, it will be removed in the next step
          return {
            ...item,
            quantity: newQuantity,
            totalPrice: newQuantity * item.price
          };
        }
        return item;
      }).filter(item => item.quantity > 0); // Remove items with quantity 0
    });
  };

  // Remove item from cart
  const removeFromCart = (id: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
  };

  // Process payment
  const processPayment = async () => {
    if (cart.length === 0) {
      toast({
        title: 'Keranjang Kosong',
        description: 'Tambahkan produk ke keranjang terlebih dahulu',
        variant: 'destructive'
      });
      return;
    }

    if (paymentMethod === 'cash' && (Number(cashReceived) < cartTotal)) {
      toast({
        title: 'Pembayaran Tidak Cukup',
        description: 'Jumlah uang yang diterima kurang dari total belanja',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Create transaction object with all required fields
      const transactionData = {
        items: cart.map(item => ({
          id: item.id,
          product: {
            id: item.product.id,
            name: item.product.name,
            price: item.product.price,
            image_url: item.product.image_url,
            category: item.product.category,
            stock: item.product.stock
          },
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice
        })),
        totalAmount: cartTotal,
        paymentMethod,
        status: 'completed',
        createdAt: new Date().toISOString(),
        cashierId: user?.uid || 'unknown',
        cashierName: user?.displayName || user?.email || 'Unknown Cashier'
      };

      // Add cash details if payment method is cash
      if (paymentMethod === 'cash' && cashReceived) {
        transaction.cashReceived = Number(cashReceived);
        transaction.change = changeAmount;
      }

      // Run Firestore transaction to update product stock and create transaction record
      await runTransaction(db, async (transaction) => {
        // First, check all products have sufficient stock
        for (const item of cart) {
          const productRef = doc(db, 'products', item.id);
          const productDoc = await transaction.get(productRef);
          
          if (!productDoc.exists()) {
            throw new Error(`Product ${item.product.name} not found`);
          }
          
          const productData = productDoc.data();
          if (productData.stock < item.quantity) {
            throw new Error(`Insufficient stock for ${item.product.name}`);
          }
        }
        
        // Then update all product stocks
        for (const item of cart) {
          const productRef = doc(db, 'products', item.id);
          transaction.update(productRef, {
            stock: item.product.stock - item.quantity,
            updated_at: new Date().toISOString()
          });
        }
        
        // Create a new document reference with auto-generated ID
        const newDocRef = doc(collection(db, 'pos_transactions'));
        console.log('Created new document reference:', newDocRef.id);
        
        // Clean the transaction data to remove any undefined values
        const cleanedData = removeUndefined({
          items: transactionData.items,
          totalAmount: transactionData.totalAmount,
          paymentMethod: transactionData.paymentMethod,
          status: transactionData.status,
          createdAt: transactionData.createdAt,
          cashierId: transactionData.cashierId,
          cashierName: transactionData.cashierName,
          ...(paymentMethod === 'cash' ? { cashReceived: Number(cashReceived), change: changeAmount } : {})
        };
        
        // Clean the data to remove any undefined values
        const cleanedTransactionData = removeUndefined(transactionDataToStore);
        
        console.log('Storing transaction data:', cleanedTransactionData);
        
        // Then set the document data using the cleaned transaction object
        transaction.set(newDocRef, cleanedData);
      });

      // Show success message
      toast({
        title: 'Transaksi Berhasil',
        description: 'Pembayaran telah diproses dan stok diperbarui',
      });

      // Show receipt
      setCurrentReceipt({
        ...transaction as POSTransaction,
        id: Date.now().toString() // Temporary ID for receipt display
      });
      setShowReceipt(true);

      // Reset form
      setCart([]);
      setCashReceived('');
      setIsPaymentModalOpen(false);
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: 'Error processing payment:',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Print receipt
  const printReceipt = () => {
    if (!receiptRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'Error',
        description: 'Gagal membuka jendela cetak',
        variant: 'destructive'
      });
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              width: 300px;
              margin: 0 auto;
              padding: 10px;
            }
            .header {
              text-align: center;
              margin-bottom: 10px;
            }
            .divider {
              border-top: 1px dashed #000;
              margin: 10px 0;
            }
            .item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
            }
            .total {
              font-weight: bold;
              margin-top: 10px;
              text-align: right;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
            }
            @media print {
              body {
                width: 100%;
                max-width: 300px;
              }
            }
          </style>
        </head>
        <body>
          ${receiptRef.current.innerHTML}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // If user is not authenticated, redirect to login
  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">POS Kasir</h1>
            </div>
            <div className="flex items-center mt-1">
              <span className="text-gray-600 mr-2">Kasir: {user.displayName || user.email}</span>
            </div>
          </div>
          
          <div className="mt-4 md:mt-0 flex flex-col md:flex-row items-end md:items-center space-y-2 md:space-y-0 md:space-x-4">
            <RealtimeClock showIcon={true} showDate={true} showSeconds={true} className="text-right" />
            <Tabs defaultValue="pos" className="w-full md:w-auto">
              <TabsList>
                <TabsTrigger value="pos">POS</TabsTrigger>
                <TabsTrigger value="history">Riwayat</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <Tabs defaultValue="pos">
          <TabsContent value="pos" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Product Catalog */}
              <div className="lg:col-span-2">
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0">
                      <CardTitle>Katalog Produk</CardTitle>
                      <div className="flex space-x-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input
                            placeholder="Cari produk..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-full md:w-60"
                          />
                        </div>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                          <SelectTrigger className="w-32 md:w-40">
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
                  
                  <CardContent className="flex-1 overflow-auto">
                    {productsLoading ? (
                      <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="text-center py-12">
                        <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 mb-1">Produk Tidak Ditemukan</h3>
                        <p className="text-gray-500 text-sm">
                          Coba gunakan kata kunci lain atau pilih kategori yang berbeda
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {filteredProducts.map((product) => (
                          <motion.div
                            key={product.id}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.98 }}
                            className={`cursor-pointer rounded-xl border ${
                              product.stock <= 0 ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:border-primary hover:shadow-md'
                            } overflow-hidden transition-all duration-200`}
                            onClick={() => product.stock > 0 && addToCart(product)}
                          >
                            <div className="aspect-square relative overflow-hidden bg-gray-100">
                              <img
                                src={product.image_url || '/placeholder.svg'}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                              {product.stock <= 0 && (
                                <div className="absolute inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center">
                                  <span className="text-white font-medium px-2 py-1 rounded-full text-xs bg-red-500">
                                    Stok Habis
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="p-3">
                              <h3 className="font-medium text-sm line-clamp-2 h-10">{product.name}</h3>
                              <div className="flex justify-between items-center mt-2">
                                <span className="font-bold text-primary">{formatYen(product.price)}</span>
                                <span className="text-xs text-gray-500">Stok: {product.stock}</span>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Shopping Cart Panel */}
              <div className="lg:col-span-1">
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-3 border-b">
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center">
                        <ShoppingCart className="w-5 h-5 mr-2" />
                        Keranjang
                      </CardTitle>
                      <Badge variant="outline" className="ml-2">
                        {cart.length} item
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-1 overflow-auto py-4">
                    {cart.length === 0 ? (
                      <div className="text-center py-12">
                        <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 mb-1">Keranjang Kosong</h3>
                        <p className="text-gray-500 text-sm">
                          Tambahkan produk ke keranjang untuk memulai transaksi
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {cart.map((item) => (
                          <div key={item.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                            <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-200 flex-shrink-0">
                              <img
                                src={item.product.image_url || '/placeholder.svg'}
                                alt={item.product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{item.product.name}</h4>
                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => updateQuantity(item.id, -1)}
                                    className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="text-sm font-medium">{item.quantity}</span>
                                  <button
                                    onClick={() => updateQuantity(item.id, 1)}
                                    className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="text-sm font-medium">{formatYen(item.price)}</div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <div className="font-bold text-primary mt-1">{formatYen(item.totalPrice)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                  
                  <CardFooter className="flex flex-col border-t pt-4">
                    <div className="w-full space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-medium">{formatYen(cartTotal)}</span>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold">Total</span>
                        <span className="text-xl font-bold text-primary">{formatYen(cartTotal)}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <Button
                          variant="outline"
                          onClick={clearCart}
                          disabled={cart.length === 0}
                          className="w-full"
                        >
                          Bersihkan
                        </Button>
                        <Button
                          onClick={() => setIsPaymentModalOpen(true)}
                          disabled={cart.length === 0}
                          className="w-full"
                        >
                          Bayar
                        </Button>
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0">
                  <CardTitle className="flex items-center">
                    <Clock className="w-5 h-5 mr-2" />
                    Riwayat Transaksi POS
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-40"
                    />
                    <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Hari Ini
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {recentTransactions.length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Belum Ada Transaksi</h3>
                    <p className="text-gray-500 text-sm">
                      {isLoadingTransactions ? 'Memuat data transaksi...' : 'Belum ada transaksi POS pada tanggal ini'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">ID Transaksi</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Waktu</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Kasir</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Metode Pembayaran</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Total</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Status</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {recentTransactions.map((transaction) => (
                          <tr key={transaction.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {transaction.id.slice(0, 8)}...
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(transaction.createdAt).toLocaleTimeString('id-ID')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {transaction.cashierName}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {transaction.paymentMethod === 'cash' ? 'Tunai' : 
                               transaction.paymentMethod === 'card' ? 'Kartu' : 
                               transaction.paymentMethod === 'qris' ? 'QRIS' : 
                               transaction.paymentMethod}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-right">
                              {formatYen(transaction.totalAmount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              <Badge variant={transaction.status === 'completed' ? 'default' : 'destructive'}>
                                {transaction.status === 'completed' ? 'Selesai' : 'Dibatalkan'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setCurrentReceipt(transaction);
                                  setShowReceipt(true);
                                }}
                              >
                                <Receipt className="w-4 h-4 mr-1" />
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

        {/* Payment Modal */}
        <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Proses Pembayaran</DialogTitle>
              <DialogDescription>
                Total Belanja: <span className="font-bold text-primary">{formatYen(cartTotal)}</span>
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
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
                <div className="space-y-2">
                  <label className="text-sm font-medium">Uang Diterima (¥)</label>
                  <Input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0"
                  />
                  
                  {Number(cashReceived) > 0 && (
                    <div className="bg-gray-50 p-3 rounded-lg mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Belanja:</span>
                        <span className="font-medium">{formatYen(cartTotal)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm text-gray-600">Uang Diterima:</span>
                        <span className="font-medium">{formatYen(Number(cashReceived))}</span>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Kembalian:</span>
                        <span className={`font-bold ${changeAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatYen(changeAmount)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {paymentMethod === 'qris' && (
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <QRCode />
                  <p className="text-sm text-blue-700 mt-2">Scan QR code untuk pembayaran</p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>
                Batal
              </Button>
              <Button 
                onClick={processPayment} 
                disabled={
                  isProcessing || 
                  (paymentMethod === 'cash' && (Number(cashReceived) < cartTotal))
                }
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
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
          </DialogContent>
        </Dialog>

        {/* Receipt Modal */}
        <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Struk Pembayaran</span>
                <Button variant="outline" size="sm" onClick={printReceipt}>
                  <Printer className="w-4 h-4 mr-2" />
                  Cetak
                </Button>
              </DialogTitle>
            </DialogHeader>
            
            {currentReceipt && (
              <div ref={receiptRef} className="py-4 font-mono text-sm">
                <div className="header text-center">
                  <h3 className="font-bold text-lg">Injapan Food</h3>
                  <p>Makanan Indonesia di Jepang</p>
                  <p className="text-xs mt-1">{new Date(currentReceipt.createdAt).toLocaleString('id-ID')}</p>
                  <p className="text-xs">Kasir: {currentReceipt.cashierName}</p>
                </div>
                
                <div className="divider my-3 border-t border-dashed border-gray-300"></div>
                
                <div>
                  {currentReceipt.items.map((item, index) => (
                    <div key={index} className="mb-2">
                      <div className="flex justify-between">
                        <span>{item.product.name}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>{item.quantity} x {formatYen(item.price)}</span>
                        <span>{formatYen(item.totalPrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="divider my-3 border-t border-dashed border-gray-300"></div>
                
                <div className="total">
                  <div className="flex justify-between font-bold">
                    <span>TOTAL</span>
                    <span>{formatYen(currentReceipt.totalAmount)}</span>
                  </div>
                  
                  {currentReceipt.paymentMethod === 'cash' && currentReceipt.cashReceived && (
                    <>
                      <div className="flex justify-between mt-2">
                        <span>TUNAI</span>
                        <span>{formatYen(currentReceipt.cashReceived)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>KEMBALI</span>
                        <span>{formatYen(currentReceipt.change || 0)}</span>
                      </div>
                    </>
                  )}
                  
                  <div className="text-xs mt-2">
                    <span>Metode Pembayaran: {
                      currentReceipt.paymentMethod === 'cash' ? 'Tunai' : 
                      currentReceipt.paymentMethod === 'card' ? 'Kartu' : 
                      currentReceipt.paymentMethod === 'qris' ? 'QRIS' : 
                      currentReceipt.paymentMethod
                    }</span>
                  </div>
                </div>
                
                <div className="footer text-center mt-4 text-xs">
                  <p>Terima kasih telah berbelanja</p>
                  <p>di Injapan Food</p>
                  <p className="mt-1">*** Injapan Food ***</p>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReceipt(false)}>
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
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