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
  where
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Product {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  barcode: string;
  image: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private firestore = inject(Firestore); // ✅ Use inject() in field initializer

  getProducts(): Observable<Product[]> {
    const productsCollection = collection(this.firestore, 'products');
    return collectionData(productsCollection, { idField: 'id' }) as Observable<Product[]>;
  }

  getProduct(id: string): Observable<Product> {
    const productDoc = doc(this.firestore, `products/${id}`);
    return docData(productDoc, { idField: 'id' }) as Observable<Product>;
  }

  async addProduct(product: Product): Promise<string> {
    const productsCollection = collection(this.firestore, 'products');
    const timestamp = new Date();
    const newProduct = { ...product, createdAt: timestamp, updatedAt: timestamp };
    const docRef = await addDoc(productsCollection, newProduct);
    return docRef.id;
  }

  async updateProduct(id: string, product: Partial<Product>): Promise<void> {
    const productDoc = doc(this.firestore, `products/${id}`);
    await updateDoc(productDoc, { ...product, updatedAt: new Date() });
  }

  async deleteProduct(id: string): Promise<void> {
    const productDoc = doc(this.firestore, `products/${id}`);
    await deleteDoc(productDoc);
  }

  async updateProductQuantity(id: string, newQuantity: number): Promise<void> {
    const productDoc = doc(this.firestore, `products/${id}`);
    await updateDoc(productDoc, { quantity: newQuantity, updatedAt: new Date() });
  }

  searchProducts(searchTerm: string): Observable<Product[]> {
    const productsCollection = collection(this.firestore, 'products');
    const searchQuery = query(
      productsCollection,
      where('name', '>=', searchTerm),
      where('name', '<=', searchTerm + '\uf8ff')
    );
    return collectionData(searchQuery, { idField: 'id' }) as Observable<Product[]>;
  }

  getLowStockProducts(threshold: number = 10): Observable<Product[]> {
    const productsCollection = collection(this.firestore, 'products');
    const lowStockQuery = query(
      productsCollection,
      where('quantity', '<=', threshold)
    );
    return collectionData(lowStockQuery, { idField: 'id' }) as Observable<Product[]>;
  }
}