import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  collectionData, 
  addDoc,
  query,
  where,
  orderBy
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Auth } from '@angular/fire/auth';

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
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  userId: string; // ← ADD THIS FIELD
  createdAt: Date | any;
}

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  // Get only orders for current user
  getOrders(): Observable<Order[]> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const ordersCollection = collection(this.firestore, 'orders');
    const userOrdersQuery = query(
      ordersCollection,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    return collectionData(userOrdersQuery, { idField: 'id' }) as Observable<Order[]>;
  }

  async saveOrder(orderData: Partial<Order>): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const ordersCollection = collection(this.firestore, 'orders');
    const orderWithUserId: Order = {
      ...orderData as Order,
      userId: user.uid, // ← ADD USER ID
      createdAt: new Date()
    };
    
    await addDoc(ordersCollection, orderWithUserId);
  }

  // Get today's orders for current user
  getTodaysOrders(): Observable<Order[]> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const ordersCollection = collection(this.firestore, 'orders');
    const todaysOrdersQuery = query(
      ordersCollection,
      where('userId', '==', user.uid),
      where('createdAt', '>=', today),
      where('createdAt', '<', tomorrow),
      orderBy('createdAt', 'desc')
    );
    
    return collectionData(todaysOrdersQuery, { idField: 'id' }) as Observable<Order[]>;
  }
}