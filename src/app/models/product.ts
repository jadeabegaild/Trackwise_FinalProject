export interface Product {
  id?: string;
  name: string;
  sku: string;
  barcode?: string;
  sellingPrice: number;
  stock: number;
  lowStockAlert?: number;
  updatedAt?: any;
}
