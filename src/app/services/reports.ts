import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  collectionData, 
  addDoc,
  query,
  orderBy,
  Timestamp
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Order {
  id?: string;
  items: OrderItem[];
  total: number;
  tax: number;
  subtotal: number;
  createdAt: Date;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private firestore = inject(Firestore); // ✅ Use inject() in field initializer

  getOrders(): Observable<Order[]> {
    const ordersCollection = collection(this.firestore, 'orders');
    const ordersQuery = query(ordersCollection, orderBy('createdAt', 'desc'));
    
    return collectionData(ordersQuery, { idField: 'id' }).pipe(
      map(orders => orders.map((order: any) => {
        const items = order.items || [];
        const processedItems = items.map((item: any) => ({
          id: item.id || '',
          name: item.name || 'Unknown Product',
          price: item.price || 0,
          quantity: item.quantity || 0,
          image: item.image || ''
        }));

        // Handle Firestore timestamp conversion
        let createdAt: Date;
        if (order.createdAt instanceof Timestamp) {
          createdAt = order.createdAt.toDate();
        } else if (order.createdAt instanceof Date) {
          createdAt = order.createdAt;
        } else {
          createdAt = new Date(order.createdAt);
        }

        return {
          id: order.id,
          items: processedItems,
          total: order.total || 0,
          tax: order.tax || 0,
          subtotal: order.subtotal || 0,
          createdAt,
          status: order.status || 'completed'
        } as Order;
      }))
    );
  }

  getSalesData(): Observable<any[]> {
    const ordersCollection = collection(this.firestore, 'orders');
    
    return collectionData(ordersCollection).pipe(
      map((orders: any[]) => this.processSalesData(orders))
    );
  }

  private processSalesData(orders: any[]): any[] {
    const salesByDate = new Map<string, number>();
    
    orders.forEach(order => {
      let date: string;
      
      if (order.createdAt instanceof Timestamp) {
        date = order.createdAt.toDate().toLocaleDateString();
      } else if (order.createdAt instanceof Date) {
        date = order.createdAt.toLocaleDateString();
      } else {
        date = new Date(order.createdAt).toLocaleDateString();
      }
      
      const existing = salesByDate.get(date) || 0;
      salesByDate.set(date, existing + (order.total || 0));
    });
    
    return Array.from(salesByDate.entries()).map(([date, sales]) => ({
      date,
      sales
    }));
  }

  async saveOrder(orderData: Partial<Order>): Promise<string> {
    const ordersCollection = collection(this.firestore, 'orders');
    
    const orderWithTimestamp = {
      ...orderData,
      createdAt: Timestamp.now(), // ✅ Use Firestore Timestamp
      status: 'completed'
    };
    
    const docRef = await addDoc(ordersCollection, orderWithTimestamp);
    return docRef.id;
  }

  getSalesStatistics(): Observable<{ totalSales: number; totalOrders: number; averageOrder: number }> {
    return this.getOrders().pipe(
      map(orders => {
        const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
        const totalOrders = orders.length;
        const averageOrder = totalOrders > 0 ? totalSales / totalOrders : 0;
        
        return {
          totalSales,
          totalOrders,
          averageOrder
        };
      })
    );
  }
}