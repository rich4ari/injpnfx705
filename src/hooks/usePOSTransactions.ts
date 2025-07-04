import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { POSTransaction } from '@/types';

export const usePOSTransactions = (date?: string) => {
  const [transactions, setTransactions] = useState<POSTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    
    try {
      // Set date range for query
      const selectedDate = date ? new Date(date) : new Date();
      selectedDate.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const startDateStr = selectedDate.toISOString();
      const endDateStr = nextDay.toISOString();
      
      // Create query
      const transactionsRef = collection(db, 'pos_transactions');
      const q = query(
        transactionsRef,
        where('createdAt', '>=', startDateStr),
        where('createdAt', '<', endDateStr),
        orderBy('createdAt', 'desc')
      );
      
      // Set up real-time listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const transactionData: POSTransaction[] = [];
        snapshot.forEach((doc) => {
          transactionData.push({ id: doc.id, ...doc.data() } as POSTransaction);
        });
        setTransactions(transactionData);
        setLoading(false);
      }, (err) => {
        console.error('Error fetching POS transactions:', err);
        setError(err as Error);
        setLoading(false);
      });
      
      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up POS transactions listener:', err);
      setError(err as Error);
      setLoading(false);
      return () => {};
    }
  }, [date]);

  return { transactions, loading, error };
};

export const getPOSTransactionsByDateRange = async (startDate: Date, endDate: Date) => {
  try {
    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();
    
    const transactionsRef = collection(db, 'pos_transactions');
    const q = query(
      transactionsRef,
      where('createdAt', '>=', startDateStr),
      where('createdAt', '<', endDateStr),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const transactions: POSTransaction[] = [];
    
    snapshot.forEach((doc) => {
      transactions.push({ id: doc.id, ...doc.data() } as POSTransaction);
    });
    
    return transactions;
  } catch (error) {
    console.error('Error fetching POS transactions by date range:', error);
    throw error;
  }
};

export const getPOSTransactionsSummary = async (startDate: Date, endDate: Date) => {
  try {
    const transactions = await getPOSTransactionsByDateRange(startDate, endDate);
    
    const totalSales = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const transactionCount = transactions.length;
    
    // Group by payment method
    const paymentMethodCounts: Record<string, number> = {};
    const paymentMethodTotals: Record<string, number> = {};
    
    transactions.forEach(t => {
      const method = t.paymentMethod;
      paymentMethodCounts[method] = (paymentMethodCounts[method] || 0) + 1;
      paymentMethodTotals[method] = (paymentMethodTotals[method] || 0) + t.totalAmount;
    });
    
    return {
      totalSales,
      transactionCount,
      paymentMethodCounts,
      paymentMethodTotals
    };
  } catch (error) {
    console.error('Error getting POS transactions summary:', error);
    throw error;
  }
};