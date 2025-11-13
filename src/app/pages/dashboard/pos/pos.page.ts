import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, LoadingController } from '@ionic/angular';
import { ProductService, Product } from '../../../services/product.service';
import { ReportsService, Order } from '../../../services/reports';
import { Subscription } from 'rxjs';

interface CartItem extends Product {
  cartQuantity: number;
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

  getTax(): number {
    return this.getSubtotal() * 0.12; // 12% VAT in Philippines
  }

  getTotal(): number {
    return this.getSubtotal() + this.getTax();
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
      // Save order to reports
      const orderData: Partial<Order> = {
        items: this.cartItems.map((item) => ({
          id: item.id || '',
          name: item.name,
          price: item.price,
          quantity: item.cartQuantity,
          image: item.image,
        })),
        subtotal: this.getSubtotal(),
        tax: this.getTax(),
        total: this.getTotal(),
        status: 'completed',
        // userId will be added automatically by the service
      };

      await this.reportsService.saveOrder(orderData);

      // Update stock levels in Firebase
      const updatePromises = this.cartItems.map(async (cartItem) => {
        if (!cartItem.id) return;

        const product = this.products.find((p) => p.id === cartItem.id);
        if (product) {
          const newQuantity = product.quantity - cartItem.cartQuantity;
          await this.productService.updateProductQuantity(
            cartItem.id,
            newQuantity
          );
        }
      });

      await Promise.all(updatePromises);

      // Update local products array to reflect stock changes
      this.cartItems.forEach((cartItem) => {
        const product = this.products.find((p) => p.id === cartItem.id);
        if (product) {
          product.quantity -= cartItem.cartQuantity;
        }
      });

      await loading.dismiss();

      // Show success message
      const alert = await this.alertController.create({
        header: 'Checkout Successful',
        message: `Total: ${this.formatCurrency(this.getTotal())}`,
        buttons: ['OK'],
      });
      await alert.present();

      // Clear cart and close modal
      this.clearCart();
      this.closeCart();
    } catch (error) {
      console.error('Error during checkout:', error);
      await loading.dismiss();
      this.presentErrorAlert('Failed to process checkout');
    }
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
