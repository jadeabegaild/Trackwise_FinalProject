import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  collectionData, 
  doc, 
  docData,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  setDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { map } from 'rxjs/operators';


export interface Product {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  barcode: string;
  image: string;
  netWeight: '' 
  userId: string; // ← ADD THIS FIELD
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  // Get only products for current user
  getProducts(): Observable<Product[]> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const productsCollection = collection(this.firestore, 'products');
    const userProductsQuery = query(
      productsCollection,
      where('userId', '==', user.uid)
    );
    return collectionData(userProductsQuery, { idField: 'id' }) as Observable<Product[]>;
  }

  getProduct(id: string): Observable<Product> {
    const productDoc = doc(this.firestore, `products/${id}`);
    return docData(productDoc, { idField: 'id' }) as Observable<Product>;
  }

  async addProduct(product: Omit<Product, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const productsCollection = collection(this.firestore, 'products');
    const timestamp = new Date();
    
    const newProduct: Product = { 
      ...product, 
      userId: user.uid, // ← ADD USER ID
      createdAt: timestamp, 
      updatedAt: timestamp 
    };
    
    const docRef = await addDoc(productsCollection, newProduct);
    return docRef.id;
  }

  async updateProduct(id: string, product: Partial<Product>): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const productDoc = doc(this.firestore, `products/${id}`);
    await updateDoc(productDoc, { 
      ...product, 
      updatedAt: new Date() 
    });
  }

  async deleteProduct(id: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const productDoc = doc(this.firestore, `products/${id}`);
    await deleteDoc(productDoc);
  }

  async updateProductQuantity(id: string, newQuantity: number): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const productDoc = doc(this.firestore, `products/${id}`);
    await updateDoc(productDoc, { 
      quantity: newQuantity, 
      updatedAt: new Date() 
    });
  }

  searchProducts(searchTerm: string): Observable<Product[]> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const productsCollection = collection(this.firestore, 'products');
    const searchQuery = query(
      productsCollection,
      where('userId', '==', user.uid),
      where('name', '>=', searchTerm),
      where('name', '<=', searchTerm + '\uf8ff')
    );
    return collectionData(searchQuery, { idField: 'id' }) as Observable<Product[]>;
  }

  getLowStockProducts(threshold: number = 10): Observable<Product[]> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const productsCollection = collection(this.firestore, 'products');
    const lowStockQuery = query(
      productsCollection,
      where('userId', '==', user.uid),
      where('quantity', '<=', threshold)
    );
    return collectionData(lowStockQuery, { idField: 'id' }) as Observable<Product[]>;
  }

  // Get products count for current user
  async getProductsCount(): Promise<number> {
    const user = this.auth.currentUser;
    if (!user) return 0;

    return new Promise((resolve) => {
      this.getProducts().subscribe(products => {
        resolve(products.length);
      });
    });
  }
    // Add this method
  getCategories(): Observable<string[]> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const categoriesCollection = collection(this.firestore, 'categories'); 
    return collectionData(categoriesCollection, { idField: 'id' }).pipe(
      map((cats: any[]) => cats.map(c => c.name))
    );
  }

  // NEW: Add category to Firestore
async addCategory(name: string): Promise<void> {
  const user = this.auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const categoriesCollection = collection(this.firestore, 'categories');
  const categoryDoc = doc(categoriesCollection); // auto-ID

  return setDoc(categoryDoc, { 
    name: name.toLowerCase(),
    userId: user.uid  // needed for per-user rules
  });
}
}

  


