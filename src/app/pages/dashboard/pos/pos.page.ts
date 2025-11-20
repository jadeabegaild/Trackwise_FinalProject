import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, LoadingController } from '@ionic/angular';
import { ProductService, Product } from '../../../services/product.service';
import { ReportsService, Order } from '../../../services/reports';
import { Subscription } from 'rxjs';

interface CartItem extends Product {
  cartQuantity: number;
}

// Extended Order interface to include split order properties
interface ExtendedOrder extends Order {
  isSplitOrder?: boolean;
  chunkIndex?: number;
  totalChunks?: number;
}

@Component({
  selector: 'app-pos',
  templateUrl: './pos.page.html',
  styleUrls: ['./pos.page.scss'],
  standalone: false,
})
export class PosPage implements OnInit, OnDestroy {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  cartItems: CartItem[] = [];
  selectedCategory: string = 'all';
  searchTerm: string = '';
  isCartOpen: boolean = false;
  categories: string[] = [];
  customerPayment: number = 0;
  changeAmount: number = 0;
  isReceiptOpen: boolean = false;
  receiptData: any;

  private productsSubscription: Subscription | undefined;

  constructor(
    private alertController: AlertController,
    private loadingController: LoadingController,
    private productService: ProductService,
    private reportsService: ReportsService
  ) {}

  async ngOnInit() {
    const loading = await this.loadingController.create({
      message: 'Loading products...',
    });
    await loading.present();

    this.productsSubscription = this.productService.getProducts().subscribe(
      (products) => {
        this.products = products;
        this.filteredProducts = [...this.products];

        // Load categories dynamically
        this.loadCategories();

        loading.dismiss();
      },
      async (error) => {
        console.error('Error loading products:', error);
        await loading.dismiss();
        this.presentErrorAlert('Failed to load products');
      }
    );
  }

  ngOnDestroy() {
    if (this.productsSubscription) {
      this.productsSubscription.unsubscribe();
    }
  }

  loadCategories() {
    this.productService.getCategories().subscribe((cats: string[]) => {
      this.categories = [...cats]; // remove 'all'
    });
  }

  searchProducts(event: any) {
    this.searchTerm = event.detail.value.toLowerCase();
    this.applyFilters();
  }

  filterByCategory(event: any) {
    this.selectedCategory = event.detail.value;
    this.applyFilters();
  }

  applyFilters() {
    this.filteredProducts = this.products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(this.searchTerm);
      const matchesCategory =
        this.selectedCategory === 'all' ||
        product.category === this.selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }

  addToCart(product: Product) {
    const existingItem = this.cartItems.find((item) => item.id === product.id);

    if (existingItem) {
      if (existingItem.cartQuantity < product.quantity) {
        // Use quantity field for stock
        existingItem.cartQuantity++;
      } else {
        this.presentErrorAlert('Not enough stock available');
      }
    } else {
      if (product.quantity > 0) {
        // Use quantity field for stock
        this.cartItems.push({ ...product, cartQuantity: 1 });
      } else {
        this.presentErrorAlert('Product is out of stock');
      }
    }
  }

  removeFromCart(index: number) {
    this.cartItems.splice(index, 1);
  }

  increaseQuantity(index: number) {
    const item = this.cartItems[index];
    const product = this.products.find((p) => p.id === item.id);
    if (product && item.cartQuantity < product.quantity) {
      // Use quantity field for stock
      item.cartQuantity++;
    } else {
      this.presentErrorAlert('Not enough stock available');
    }
  }

  decreaseQuantity(index: number) {
    const item = this.cartItems[index];
    if (item.cartQuantity > 1) {
      item.cartQuantity--;
    } else {
      this.removeFromCart(index);
    }
  }

  clearCart() {
    this.cartItems = [];
  }

  getSubtotal(): number {
    return this.cartItems.reduce(
      (total, item) => total + item.price * item.cartQuantity,
      0
    );
  }

  getTotal(): number {
    return this.getSubtotal();
  }

  calculateChange() {
    const total = this.getTotal();
    this.changeAmount = this.customerPayment - total;
  }

  openCart() {
    this.isCartOpen = true;
  }

  closeCart() {
    this.isCartOpen = false;
  }

  async checkout() {
    if (this.cartItems.length === 0) {
      this.presentErrorAlert('Cart is empty');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Processing checkout...',
    });
    await loading.present();

    try {
      // Check if order would exceed Firestore size limit
      if (this.wouldExceedSizeLimit()) {
        await loading.dismiss();
        await this.handleLargeOrderCheckout();
        return;
      }

      // Proceed with normal checkout for smaller orders
      await this.processNormalCheckout(loading);
      
    } catch (error: any) {
      console.error('Error during checkout:', error);
      await loading.dismiss();
      this.presentErrorAlert('Failed to process checkout: ' + (error.message || 'Unknown error'));
    }
  }

  private wouldExceedSizeLimit(): boolean {
    // Create minimized order data for size estimation
    const minimizedItems = this.minimizeOrderItems(this.cartItems);
    const orderData = {
      items: minimizedItems,
      subtotal: this.getSubtotal(),
      total: this.getTotal(),
      status: 'completed',
      createdAt: new Date()
    };

    // Estimate size (Firestore limit is 1,048,576 bytes)
    const estimatedSize = JSON.stringify(orderData).length;
    const isTooLarge = estimatedSize > 900000; // Conservative buffer
    
    console.log(`Order size estimate: ${estimatedSize} bytes`);
    
    return isTooLarge;
  }

  private minimizeOrderItems(cartItems: CartItem[]): any[] {
    return cartItems.map(item => ({
      id: item.id || '',
      name: item.name,
      price: item.price,
      quantity: item.cartQuantity,
      // Remove image and other large fields to reduce size
      // image: item.image, // Comment out to reduce size
    }));
  }

  private async handleLargeOrderCheckout() {
    const alert = await this.alertController.create({
      header: 'Large Order Detected',
      message: `Your order contains ${this.cartItems.length} items and is too large to process as a single transaction. Would you like to split it into multiple smaller orders?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Split Order',
          handler: async () => {
            await this.processSplitOrder();
          }
        }
      ]
    });
    
    await alert.present();
  }

  private async processSplitOrder() {
    const loading = await this.loadingController.create({
      message: 'Processing large order...',
    });
    await loading.present();

    try {
      const maxItemsPerOrder = 30; // Conservative limit for safety
      const orderChunks = this.splitCartIntoChunks(maxItemsPerOrder);
      const orderIds = [];

      // Process each chunk as separate order
      for (let i = 0; i < orderChunks.length; i++) {
        const chunk = orderChunks[i];
        const orderId = await this.processOrderChunk(chunk, i, orderChunks.length);
        if (orderId) {
          orderIds.push(orderId);
        }
        
        // Update stock for this chunk
        await this.updateStockForChunk(chunk);
      }

      // Store relationship between split orders
      await this.storeOrderRelationship(orderIds);

      await loading.dismiss();

      // Show success with receipt for first chunk
      this.showSplitOrderSuccess(orderChunks.length);
      
    } catch (error: any) {
      await loading.dismiss();
      console.error('Error processing split order:', error);
      this.presentErrorAlert('Failed to process large order: ' + (error.message || 'Unknown error'));
    }
  }

  private splitCartIntoChunks(maxItems: number): CartItem[][] {
    const chunks: CartItem[][] = [];
    for (let i = 0; i < this.cartItems.length; i += maxItems) {
      chunks.push(this.cartItems.slice(i, i + maxItems));
    }
    return chunks;
  }

  private async processOrderChunk(chunk: CartItem[], chunkIndex: number, totalChunks: number): Promise<string | null> {
    const minimizedItems = this.minimizeOrderItems(chunk);
    
    const orderData: Partial<ExtendedOrder> = {
      items: minimizedItems,
      subtotal: this.calculateChunkSubtotal(chunk),
      total: this.calculateChunkTotal(chunk),
      status: 'completed',
      isSplitOrder: true,
      chunkIndex: chunkIndex + 1,
      totalChunks: totalChunks,
      createdAt: new Date()
    };

    try {
      const orderRef = await this.reportsService.saveOrder(orderData);
      // Assuming saveOrder returns an object with id property
      return (orderRef as any).id || null;
    } catch (error) {
      console.error('Error saving order chunk:', error);
      return null;
    }
  }

  private calculateChunkTotal(chunk: CartItem[]): number {
    return chunk.reduce((total, item) => total + (item.price * item.cartQuantity), 0);
  }

  private calculateChunkSubtotal(chunk: CartItem[]): number {
    return this.calculateChunkTotal(chunk);
  }

  private async updateStockForChunk(chunk: CartItem[]) {
    const updatePromises = chunk.map(async (cartItem) => {
      if (!cartItem.id) return;

      const product = this.products.find((p) => p.id === cartItem.id);
      if (product) {
        const newQuantity = product.quantity - cartItem.cartQuantity;
        await this.productService.updateProductQuantity(cartItem.id, newQuantity);
        
        // Update local products array
        product.quantity = newQuantity;
      }
    });

    await Promise.all(updatePromises);
  }

  private async storeOrderRelationship(orderIds: string[]) {
    // Store in a separate collection for tracking split orders
    const relationshipData = {
      orderIds: orderIds,
      createdAt: new Date(),
      totalOrders: orderIds.length,
      totalAmount: this.getTotal()
    };
    
    // Use the existing saveOrder method or create a new one
    await this.reportsService.saveOrderRelationship(relationshipData);
  }

  private async processNormalCheckout(loading: HTMLIonLoadingElement) {
    // Use minimized items to reduce size
    const minimizedItems = this.minimizeOrderItems(this.cartItems);
    
    const orderData: Partial<Order> = {
      items: minimizedItems,
      subtotal: this.getSubtotal(),
      total: this.getTotal(),
      status: 'completed',
      createdAt: new Date()
    };

    await this.reportsService.saveOrder(orderData);

    // Update stock levels
    const updatePromises = this.cartItems.map(async (cartItem) => {
      if (!cartItem.id) return;

      const product = this.products.find((p) => p.id === cartItem.id);
      if (product) {
        const newQuantity = product.quantity - cartItem.cartQuantity;
        await this.productService.updateProductQuantity(cartItem.id, newQuantity);
      }
    });

    await Promise.all(updatePromises);

    // Update local products array
    this.cartItems.forEach((cartItem) => {
      const product = this.products.find((p) => p.id === cartItem.id);
      if (product) {
        product.quantity -= cartItem.cartQuantity;
      }
    });

    await loading.dismiss();

    // Show receipt and success
    await this.showCheckoutSuccess();
  }

  private async showCheckoutSuccess() {
    // Save cart snapshot for receipt
    const receiptItems = [...this.cartItems];
    const totalAmount = this.getTotal();
    const paymentAmount = this.customerPayment;
    const changeAmount = this.changeAmount;

    // Set receipt data
    this.receiptData = {
      items: receiptItems,
      total: totalAmount,
      payment: paymentAmount,
      change: changeAmount,
      date: new Date()
    };

    // Open receipt modal
    this.isReceiptOpen = true;

    // Clear cart and reset payment
    this.clearCart();
    this.closeCart();
    this.customerPayment = 0;
    this.changeAmount = 0;

    // Show success alert
    const alert = await this.alertController.create({
      header: 'Checkout Successful',
      message: `Total: ${this.formatCurrency(totalAmount)}`,
      buttons: ['OK'],
    });
    await alert.present();
  }

  private async showSplitOrderSuccess(totalChunks: number) {
    // Save receipt data for first chunk (or you might want to handle this differently)
    const receiptItems = this.cartItems.slice(0, Math.min(30, this.cartItems.length));
    const totalAmount = this.getTotal();
    const paymentAmount = this.customerPayment;
    const changeAmount = this.changeAmount;

    this.receiptData = {
      items: receiptItems,
      total: totalAmount,
      payment: paymentAmount,
      change: changeAmount,
      date: new Date(),
      isSplitOrder: true,
      totalChunks: totalChunks
    };

    // Open receipt modal
    this.isReceiptOpen = true;

    // Clear cart and reset payment
    this.clearCart();
    this.closeCart();
    this.customerPayment = 0;
    this.changeAmount = 0;

    const alert = await this.alertController.create({
      header: 'Order Processed Successfully',
      message: `Your large order was split into ${totalChunks} separate transactions for processing.`,
      buttons: ['OK'],
    });
    await alert.present();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  }

  private async presentErrorAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message: message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}