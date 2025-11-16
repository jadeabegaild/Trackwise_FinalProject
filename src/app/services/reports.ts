import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  query,
  where,
  orderBy,
  Timestamp
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
  userId: string;
  createdAt: Date | Timestamp;
  // Add optional properties for split orders
  isSplitOrder?: boolean;
  chunkIndex?: number;
  totalChunks?: number;
}

@Injectable({
  providedIn: 'root',
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
    return collectionData(userOrdersQuery, { idField: 'id' }) as Observable<
      Order[]
    >;
  }

  async saveOrder(orderData: Partial<Order>): Promise<any> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const ordersCollection = collection(this.firestore, 'orders');
    const orderWithUserId = {
      ...orderData,
      userId: user.uid,
      createdAt: Timestamp.now(),
      status: orderData.status || 'completed',
      tax: orderData.tax || 0
    };

    const docRef = await addDoc(ordersCollection, orderWithUserId);
    return { id: docRef.id, ...orderWithUserId };
  }

  async saveOrderRelationship(relationshipData: any): Promise<any> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const relationshipsCollection = collection(this.firestore, 'orderRelationships');
    const relationshipWithUser = {
      ...relationshipData,
      userId: user.uid,
      createdAt: Timestamp.now()
    };

    const docRef = await addDoc(relationshipsCollection, relationshipWithUser);
    return { id: docRef.id, ...relationshipWithUser };
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
      where('createdAt', '>=', Timestamp.fromDate(today)),
      where('createdAt', '<', Timestamp.fromDate(tomorrow)),
      orderBy('createdAt', 'desc')
    );

    return collectionData(todaysOrdersQuery, { idField: 'id' }) as Observable<
      Order[]
    >;
  }

  // Helper method to add documents to any collection
  private async addDoc(collectionName: string, data: any): Promise<any> {
    const collectionRef = collection(this.firestore, collectionName);
    const docRef = await addDoc(collectionRef, {
      ...data,
      createdAt: Timestamp.now()
    });
    return { id: docRef.id, ...data };
  }
}