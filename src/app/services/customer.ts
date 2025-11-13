import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  collectionData, 
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Auth } from '@angular/fire/auth';

export interface Customer {
  id?: string;
  name: string;
  phone: string;
  email: string;
  userId: string; // ← ADD THIS FIELD
  createdAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  // Get only customers for current user
  getCustomers(): Observable<Customer[]> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const customersCollection = collection(this.firestore, 'customers');
    const userCustomersQuery = query(
      customersCollection,
      where('userId', '==', user.uid)
    );
    return collectionData(userCustomersQuery, { idField: 'id' }) as Observable<Customer[]>;
  }

  async addCustomer(customer: Omit<Customer, 'id' | 'userId' | 'createdAt'>): Promise<string> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const customersCollection = collection(this.firestore, 'customers');
    const newCustomer: Customer = {
      ...customer,
      userId: user.uid,
      createdAt: new Date()
    };

    const docRef = await addDoc(customersCollection, newCustomer);
    return docRef.id;
  }
}