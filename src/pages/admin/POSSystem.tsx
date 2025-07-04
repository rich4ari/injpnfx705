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
  // ... rest of the code remains the same ...
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