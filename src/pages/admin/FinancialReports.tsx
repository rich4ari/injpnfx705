import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { DollarSign, TrendingUp, Download, Calendar, ArrowDown, ArrowUp, FileText, Plus } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useOrders } from '@/hooks/useOrders';
import { Order } from '@/types';
import { toast } from '@/hooks/use-toast';

// Financial transaction type
interface FinancialTransaction {
  id: string;
  date: string;
  category: 'sales' | 'expense' | 'refund' | 'other';
  type: 'income' | 'expense';
  amount: number;
  description: string;
}

// Monthly financial data type
interface MonthlyFinancialData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  orderCount: number;
}

const FinancialReports = () => {
  const { data: orders = [] } = useOrders();
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentYearMonth());
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyFinancialData[]>([]);
  const [newTransaction, setNewTransaction] = useState<Partial<FinancialTransaction>>({
    category: 'expense',
    type: 'expense',
    amount: 0,
    description: ''
  });
  const [showAddTransaction, setShowAddTransaction] = useState(false);

  // Get current year and month in YYYY-MM format
  function getCurrentYearMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  // Format month for display
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
  };

  // Generate available months (last 12 months)
  const getAvailableMonths = () => {
    const months = [];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push(monthStr);
    }
    
    return months;
  };

  // Format currency as Yen
  const formatYen = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Calculate financial data based on orders and selected month
  useEffect(() => {
    if (!orders.length) return;

    // Filter orders for the selected month
    const [year, month] = selectedMonth.split('-');
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0); // Last day of month
    
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= startDate && orderDate <= endDate && 
             (order.status === 'completed' || order.status === 'confirmed');
    });

    // Generate transactions from orders
    const orderTransactions: FinancialTransaction[] = filteredOrders.map(order => ({
      id: order.id,
      date: new Date(order.created_at).toISOString().split('T')[0],
      category: 'sales',
      type: 'income',
      amount: order.total_price,
      description: `Order #${order.id.slice(-8)} - ${order.customer_info.name}`
    }));

    // Add some sample expenses for demonstration
    const sampleExpenses: FinancialTransaction[] = [
      {
        id: 'exp-1',
        date: `${year}-${month}-05`,
        category: 'expense',
        type: 'expense',
        amount: 25000,
        description: 'Biaya pengiriman bulanan'
      },
      {
        id: 'exp-2',
        date: `${year}-${month}-12`,
        category: 'expense',
        type: 'expense',
        amount: 15000,
        description: 'Biaya penyimpanan produk'
      },
      {
        id: 'exp-3',
        date: `${year}-${month}-18`,
        category: 'expense',
        type: 'expense',
        amount: 8000,
        description: 'Biaya operasional'
      }
    ];

    // Combine and sort transactions by date
    const allTransactions = [...orderTransactions, ...sampleExpenses].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    setTransactions(allTransactions);

    // Calculate monthly summary
    const totalRevenue = orderTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = sampleExpenses.reduce((sum, t) => sum + t.amount, 0);
    
    // Generate monthly data for charts (last 6 months)
    const monthlyChartData: MonthlyFinancialData[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(parseInt(year), parseInt(month) - 1 - i, 1);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('ja-JP', { month: 'short' });
      
      // Generate some sample data for demonstration
      const revenue = totalRevenue * (0.7 + Math.random() * 0.6);
      const expenses = totalExpenses * (0.7 + Math.random() * 0.6);
      
      monthlyChartData.push({
        month: monthName,
        revenue: Math.round(revenue),
        expenses: Math.round(expenses),
        profit: Math.round(revenue - expenses),
        orderCount: Math.round(filteredOrders.length * (0.7 + Math.random() * 0.6))
      });
    }
    
    setMonthlyData(monthlyChartData);
  }, [orders, selectedMonth]);

  // Calculate summary statistics
  const totalRevenue = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const netProfit = totalRevenue - totalExpenses;

  // Add new transaction
  const handleAddTransaction = () => {
    if (!newTransaction.description || !newTransaction.amount) {
      toast({
        title: "Input tidak lengkap",
        description: "Deskripsi dan jumlah wajib diisi",
        variant: "destructive"
      });
      return;
    }

    const transaction: FinancialTransaction = {
      id: `manual-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      category: newTransaction.category as 'sales' | 'expense' | 'refund' | 'other',
      type: newTransaction.category === 'expense' ? 'expense' : 'income',
      amount: Number(newTransaction.amount),
      description: newTransaction.description || ''
    };

    setTransactions([transaction, ...transactions]);
    setNewTransaction({
      category: 'expense',
      type: 'expense',
      amount: 0,
      description: ''
    });
    setShowAddTransaction(false);

    toast({
      title: "Transaksi berhasil ditambahkan",
      description: "Data keuangan telah diperbarui",
    });
  };

  // Export financial data to CSV
  const exportToCSV = () => {
    const headers = ['Tanggal', 'Kategori', 'Tipe', 'Jumlah (¥)', 'Deskripsi'];
    
    const csvData = transactions.map(t => [
      t.date,
      t.category,
      t.type,
      t.amount,
      `"${t.description.replace(/"/g, '""')}"`
    ]);
    
    // Add summary row
    csvData.push(['', '', '', '', '']);
    csvData.push(['TOTAL PENDAPATAN', '', '', totalRevenue, '']);
    csvData.push(['TOTAL PENGELUARAN', '', '', totalExpenses, '']);
    csvData.push(['LABA BERSIH', '', '', netProfit, '']);
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `laporan-keuangan-${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Laporan Keuangan</h1>
          <p className="text-gray-600">Kelola dan pantau data keuangan Injapan Food</p>
        </div>

        {/* Month Selector */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <span className="font-medium">Periode:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Pilih bulan" />
              </SelectTrigger>
              <SelectContent>
                {getAvailableMonths().map((month) => (
                  <SelectItem key={month} value={month}>
                    {formatMonth(month)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={exportToCSV}
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export Laporan</span>
            </Button>
            
            <Button 
              onClick={() => setShowAddTransaction(!showAddTransaction)}
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddTransaction ? 'Batal' : 'Tambah Transaksi'}</span>
            </Button>
          </div>
        </div>

        {/* Add Transaction Form */}
        {showAddTransaction && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Tambah Transaksi Manual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <Select 
                    value={newTransaction.category} 
                    onValueChange={(value) => setNewTransaction({...newTransaction, category: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Penjualan</SelectItem>
                      <SelectItem value="expense">Pengeluaran</SelectItem>
                      <SelectItem value="refund">Refund</SelectItem>
                      <SelectItem value="other">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah (¥)</label>
                  <Input 
                    type="number" 
                    value={newTransaction.amount || ''} 
                    onChange={(e) => setNewTransaction({...newTransaction, amount: Number(e.target.value)})}
                    placeholder="0"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                  <Input 
                    value={newTransaction.description || ''} 
                    onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                    placeholder="Deskripsi transaksi"
                  />
                </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <Button onClick={handleAddTransaction}>Simpan Transaksi</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                Total Omzet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-700">{formatYen(totalRevenue)}</div>
              <p className="text-sm text-blue-600 mt-1">
                Periode {formatMonth(selectedMonth)}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" />
                Laba Bersih
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-700">{formatYen(netProfit)}</div>
              <p className="text-sm text-green-600 mt-1">
                {netProfit > 0 ? (
                  <span className="flex items-center">
                    <ArrowUp className="w-3 h-3 mr-1" />
                    Profit
                  </span>
                ) : (
                  <span className="flex items-center">
                    <ArrowDown className="w-3 h-3 mr-1" />
                    Loss
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Total Pengeluaran
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-700">{formatYen(totalExpenses)}</div>
              <p className="text-sm text-red-600 mt-1">
                Periode {formatMonth(selectedMonth)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="transactions" className="mb-8">
          <TabsList className="mb-4">
            <TabsTrigger value="transactions">Transaksi</TabsTrigger>
            <TabsTrigger value="charts">Grafik</TabsTrigger>
          </TabsList>
          
          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>Laporan Transaksi Keuangan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Masuk/Keluar</TableHead>
                        <TableHead className="text-right">Nominal</TableHead>
                        <TableHead>Keterangan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                            Tidak ada data transaksi untuk periode ini
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {transactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>{new Date(transaction.date).toLocaleDateString('ja-JP')}</TableCell>
                              <TableCell>
                                <Badge variant={transaction.category === 'sales' ? 'default' : 
                                              transaction.category === 'expense' ? 'destructive' : 
                                              transaction.category === 'refund' ? 'secondary' : 'outline'}>
                                  {transaction.category === 'sales' ? 'Penjualan' : 
                                   transaction.category === 'expense' ? 'Pengeluaran' : 
                                   transaction.category === 'refund' ? 'Refund' : 'Lainnya'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                                  {transaction.type === 'income' ? 'Masuk' : 'Keluar'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                                  {formatYen(transaction.amount)}
                                </span>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">{transaction.description}</TableCell>
                            </TableRow>
                          ))}
                          
                          {/* Summary row */}
                          <TableRow className="bg-gray-50 font-bold">
                            <TableCell colSpan={3} className="text-right">Total:</TableCell>
                            <TableCell className="text-right">{formatYen(netProfit)}</TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="charts">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tren Keuangan 6 Bulan Terakhir</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={monthlyData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis 
                          tickFormatter={(value) => `¥${value.toLocaleString()}`}
                        />
                        <Tooltip 
                          formatter={(value) => [`¥${Number(value).toLocaleString()}`, '']}
                          labelFormatter={(label) => `Bulan: ${label}`}
                        />
                        <Legend />
                        <Bar dataKey="revenue" name="Omzet" fill="#3b82f6" />
                        <Bar dataKey="expenses" name="Pengeluaran" fill="#ef4444" />
                        <Bar dataKey="profit" name="Laba Bersih" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Tren Laba Bersih</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={monthlyData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis 
                          tickFormatter={(value) => `¥${value.toLocaleString()}`}
                        />
                        <Tooltip 
                          formatter={(value) => [`¥${Number(value).toLocaleString()}`, '']}
                          labelFormatter={(label) => `Bulan: ${label}`}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="profit" name="Laba Bersih" stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="orderCount" name="Jumlah Pesanan" stroke="#8884d8" strokeWidth={2} yAxisId="right" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default FinancialReports;