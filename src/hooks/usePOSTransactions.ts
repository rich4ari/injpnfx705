import { useState, useEffect } from 'react';
import { collection, query, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { POSTransaction } from '@/types';

export const usePOSTransactions = (date?: string) => {
  const [transactions, setTransactions] = useState<POSTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    
    try {
      // Set date range for query
      const selectedDate = date ? new Date(date) : new Date();
      selectedDate.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const startDateStr = selectedDate.toISOString();
      const endDateStr = nextDay.toISOString();
      
      console.log(`Fetching POS transactions between ${startDateStr} and ${endDateStr}`);
      console.log('Date filter:', { date, selectedDate, nextDay });
      
      // Create query - using simple query to avoid index requirements
      const transactionsRef = collection(db, 'pos_transactions');
      const q = query(transactionsRef);
      
      console.log('Setting up POS transactions listener');

      // First check if collection exists and has documents
      getDocs(q).then(initialSnapshot => {
        if (initialSnapshot.empty) {
          console.log('No POS transactions found in initial check');
          setTransactions([]);
          setLoading(false);
        }
      }).catch(err => {
        console.error('Error in initial POS transactions check:', err);
        // Don't set error here, let the snapshot listener handle it
      });
      
      // Set up real-time listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        try {
          console.log(`Snapshot received with ${snapshot.size} documents`);
          if (snapshot.empty) {
            console.log('No POS transactions found');
            setTransactions([]);
            setLoading(false);
            return;
          }
          
          let transactionData: POSTransaction[] = [];
          snapshot.forEach((doc) => {
            console.log(`Processing transaction document: ${doc.id}`);
            try {
              const data = doc.data();
              // Ensure all required fields exist
              if (data && data.createdAt && Array.isArray(data.items) && typeof data.totalAmount === 'number') {
                transactionData.push({ 
                  id: doc.id, 
                  ...data 
                } as POSTransaction);
              } else {
                console.warn(`Skipping transaction ${doc.id} due to missing required fields:`, {
                  hasCreatedAt: !!data?.createdAt,
                  hasItems: !!data?.items,
                  isItemsArray: Array.isArray(data?.items),
                  hasTotalAmount: typeof data?.totalAmount === 'number'
                });
              }
            } catch (docError) {
              console.error(`Error processing transaction document ${doc.id}:`, docError);
            }
          });
          
          // Filter by date client-side instead of in the query
          if (date) {
            console.log(`Filtering transactions by date: ${date}`);
            transactionData = transactionData.filter(t => {
              if (!t.createdAt) {
                console.log(`Transaction ${t.id} has no createdAt field`);
                return false;
              }
              
              const txDate = new Date(t.createdAt);
              const isInRange = txDate >= new Date(startDateStr) && txDate < new Date(endDateStr);
              console.log(`Transaction ${t.id} date: ${txDate}, in range: ${isInRange}`);
              return isInRange;
            });
          }

          // Sort manually since we're not using orderBy
          transactionData.sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          
          console.log(`Loaded ${transactionData.length} POS transactions`);
          setTransactions(transactionData);
          
          // Log the first transaction for debugging
          if (transactionData.length > 0) {
            console.log('Sample transaction:', JSON.stringify(transactionData[0]).substring(0, 200) + '...');
          }
          
          setLoading(false);
        } catch (err) {
          console.error('Error processing transaction data:', err);
          setError(new Error(`Failed to process transaction data: ${err.message || 'Unknown error'}`));
          setLoading(false);
        }
      }, (err) => {
        console.error('Error in POS transactions snapshot:', err);
        setError(new Error(`Failed to listen to transactions: ${err.message || 'Unknown error'}`));
        setLoading(false);
      });
      
      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up POS transactions listener:', err);
      setError(new Error(`Failed to set up transaction listener: ${err.message || 'Unknown error'}`));
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
    
    console.log('Fetching POS transactions from', startDateStr, 'to', endDateStr);
    
    const transactionsRef = collection(db, 'pos_transactions');
    // Use a simpler query to avoid index requirements
    const q = query(transactionsRef);
    
    const snapshot = await getDocs(q);
    const transactions: POSTransaction[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Filter by date manually
      if (data.createdAt && data.createdAt >= startDateStr && data.createdAt < endDateStr) {
        transactions.push({ id: doc.id, ...data } as POSTransaction);
      }
    });
    
    // Sort manually by date
    transactions.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    console.log(`Found ${transactions.length} transactions in date range`);
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