
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

export const useOrderOperations = () => {
  const queryClient = useQueryClient();
  const db = getFirestore();

  const confirmOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'confirmed',
        updated_at: new Date().toISOString()
      });
      return orderId;
    },
    onSuccess: () => {
      // Invalidate multiple query keys to ensure data refresh
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
      
      // Force refetch immediately
      queryClient.refetchQueries({ queryKey: ['orders'] });
      queryClient.refetchQueries({ queryKey: ['pending-orders'] });
      
      toast({
        title: "Order Confirmed",
        description: "Order has been confirmed successfully.",
      });
    },
    onError: (error) => {
      console.error('Order confirmation failed:', error);
      toast({
        title: "Error",
        description: "Failed to confirm order. Please try again.",
        variant: "destructive",
      });
    }
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'cancelled',
        updated_at: new Date().toISOString()
      });
      return orderId;
    },
    onSuccess: () => {
      // Invalidate multiple query keys to ensure data refresh
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
      
      // Force refetch immediately
      queryClient.refetchQueries({ queryKey: ['orders'] });
      queryClient.refetchQueries({ queryKey: ['pending-orders'] });
      
      toast({
        title: "Order Cancelled",
        description: "Order has been cancelled successfully.",
      });
    },
    onError: (error) => {
      console.error('Order cancellation failed:', error);
      toast({
        title: "Error",
        description: "Failed to cancel order. Please try again.",
        variant: "destructive",
      });
    }
  });

  return {
    confirmOrder: confirmOrderMutation.mutate,
    cancelOrder: cancelOrderMutation.mutate,
    isLoading: confirmOrderMutation.isPending || cancelOrderMutation.isPending
  };
};
