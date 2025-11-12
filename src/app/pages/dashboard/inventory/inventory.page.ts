import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertController, LoadingController } from '@ionic/angular';
import { ProductService, Product } from '../../../services/product.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.page.html',
  styleUrls: ['./inventory.page.scss'],
  standalone: false,
})
export class InventoryPage implements OnInit, OnDestroy {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchTerm: string = '';
  selectedCategory: string = 'all';
  isModalOpen: boolean = false;
  isEditing: boolean = false;
  editingProductId: string | null = null;
  productForm: FormGroup;
  isBarcodeScannerAvailable: boolean = false;
  
  private productsSubscription: Subscription | undefined;

  constructor(
    private formBuilder: FormBuilder,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private productService: ProductService
  ) {
    this.productForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      price: [0, [Validators.required, Validators.min(0)]],
      quantity: [0, [Validators.required, Validators.min(0)]],
      category: ['', Validators.required],
      barcode: [''],
      image: ['']
    });

    this.isBarcodeScannerAvailable = !!(window as any).cordova || !!(window as any).Capacitor;
  }

  async ngOnInit() {
    const loading = await this.loadingController.create({
      message: 'Loading products...'
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

  getStockStatus(quantity: number): { label: string, color: string } {
    if (quantity === 0) {
      return { label: 'Out of Stock', color: 'danger' };
    } else if (quantity < 10) {
      return { label: 'Low Stock', color: 'warning' };
    } else {
      return { label: 'In Stock', color: 'success' };
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
    this.filteredProducts = this.products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(this.searchTerm) ||
                           product.barcode.includes(this.searchTerm);
      const matchesCategory = this.selectedCategory === 'all' || product.category === this.selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }

  openAddProductModal() {
    this.isEditing = false;
    this.editingProductId = null;
    this.productForm.reset({
      name: '',
      price: 0,
      quantity: 0,
      category: '',
      barcode: '',
      image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=150'
    });
    this.isModalOpen = true;
  }

  editProduct(product: Product) {
    this.isEditing = true;
    this.editingProductId = product.id || null;
    this.productForm.patchValue({
      name: product.name,
      price: product.price,
      quantity: product.quantity,
      category: product.category,
      barcode: product.barcode,
      image: product.image
    });
    this.isModalOpen = true;
  }

  async deleteProduct(productId: string, productName?: string) {
    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: productName 
        ? `Are you sure you want to delete "${productName}"? This action cannot be undone.`
        : 'Are you sure you want to delete this product? This action cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Delete',
          role: 'destructive',
          cssClass: 'danger-button',
          handler: async () => {
            await this.performDelete(productId);
          }
        }
      ]
    });

    await alert.present();
  }

  private async performDelete(productId: string) {
    const loading = await this.loadingController.create({
      message: 'Deleting product...',
      spinner: 'crescent',
      cssClass: 'delete-loading'
    });
    
    await loading.present();

    try {
      await this.productService.deleteProduct(productId);
      await loading.dismiss();
      
      const successAlert = await this.alertController.create({
        header: 'Success',
        message: 'Product deleted successfully',
        buttons: ['OK'],
        cssClass: 'alert-success'
      });
      await successAlert.present();
      
    } catch (error) {
      console.error('Error deleting product:', error);
      await loading.dismiss();
      
      const errorAlert = await this.alertController.create({
        header: 'Delete Failed',
        message: 'Failed to delete product. Please try again.',
        buttons: ['OK'],
        cssClass: 'alert-error'
      });
      await errorAlert.present();
    }
  }

  closeModal() {
    this.isModalOpen = false;
    this.productForm.reset();
  }

  async saveProduct() {
    if (this.productForm.valid) {
      const loading = await this.loadingController.create({
        message: this.isEditing ? 'Updating product...' : 'Adding product...'
      });
      await loading.present();

      try {
        const formValue = this.productForm.value;

        if (this.isEditing && this.editingProductId) {
          await this.productService.updateProduct(this.editingProductId, formValue);
        } else {
          const newProduct: Product = {
            name: formValue.name,
            price: formValue.price,
            quantity: formValue.quantity,
            category: formValue.category,
            barcode: formValue.barcode || this.generateBarcode(),
            image: formValue.image
          };
          await this.productService.addProduct(newProduct);
        }

        await loading.dismiss();
        this.closeModal();
      } catch (error) {
        console.error('Error saving product:', error);
        await loading.dismiss();
        this.presentErrorAlert('Failed to save product');
      }
    }
  }

  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.productForm.patchValue({
          image: e.target.result
        });
      };
      reader.readAsDataURL(file);
    }
  }

  scanBarcode() {
    if (this.isBarcodeScannerAvailable) {
      const simulatedBarcode = '8' + Math.random().toString().substr(2, 11);
      this.productForm.patchValue({
        barcode: simulatedBarcode
      });
    } else {
      const randomBarcode = this.generateBarcode();
      this.productForm.patchValue({
        barcode: randomBarcode
      });
    }
  }

  private generateBarcode(): string {
    return Math.random().toString().substr(2, 12);
  }

  private async presentErrorAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }
}