export interface OrderItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  sellingPrice: number;
  total: number;
  discount?: number;
}

export interface OrderCustomer {
  id: string;
  name: string;
  tier: string;
  email?: string;
  phone?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Order {
  id?: string;
  items: OrderItem[];
  customer: OrderCustomer;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: string;
  status: string;
  createdAt: any;
  updatedAt: any;
}
