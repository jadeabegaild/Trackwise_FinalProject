import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertController, LoadingController } from '@ionic/angular';
import { ProductService, Product } from '../../../services/product.service';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.page.html',
  styleUrls: ['./inventory.page.scss'],
  standalone: false,
})
export class InventoryPage implements OnInit, OnDestroy {
  @ViewChild('scannerPreview', { static: false }) scannerPreview!: ElementRef<HTMLVideoElement>;

  // Product data
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchTerm: string = '';
  selectedCategory: string = 'all';

  // Forms
  productForm: FormGroup;
  categoryForm: FormGroup;

  // Modals
  isModalOpen = false;
  isCategoryModalOpen = false;
  isEditing = false;
  editingProductId: string | null = null;

  // Categories
  categories: string[] = [];

  // Barcode scanner
  scanner = new BrowserMultiFormatReader();
  scanControls: IScannerControls | null = null;
  scanning = false;

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
      barcode: ['', Validators.required],
      image: [''],
      netWeight: [''] 
    });

    this.categoryForm = this.formBuilder.group({
      name: ['', Validators.required]
    });
  }

  // ================================
  // 🔹 INITIALIZATION
  // ================================
  async ngOnInit() {
    const loading = await this.loadingController.create({
      message: 'Loading products...'
    });
    await loading.present();

    this.productsSubscription = this.productService.getProducts().subscribe(
      (products) => {
        this.products = products;
        this.filteredProducts = [...products];
        loading.dismiss();
      },
      async () => {
        loading.dismiss();
        this.presentErrorAlert('Failed to load products');
      }
    );

    this.loadCategories();
  }

  ngOnDestroy() {
    this.stopBarcodeScan();
    if (this.productsSubscription) this.productsSubscription.unsubscribe();
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
  // ================================
  // 🔹 CATEGORY LOADING
  // ================================
  loadCategories() {
    this.productService.getCategories().subscribe((cats: string[]) => {
      this.categories = cats;
    });
  }

  // ================================
  // 🔹 FILTERING
  // ================================
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
      const matchesSearch =
        product.name.toLowerCase().includes(this.searchTerm) ||
        product.barcode.toLowerCase().includes(this.searchTerm);

      const matchesCategory =
        this.selectedCategory === 'all' ||
        product.category === this.selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }

  // ================================
  // 🔹 OPEN MODALS
  // ================================
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

    this.productForm.patchValue(product);

    this.isModalOpen = true;
  }
  

  closeModal() {
    this.stopBarcodeScan();
    this.isModalOpen = false;
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

  // ================================
  // 🔹 SAVE PRODUCT
  // ================================
  async saveProduct() {
    if (!this.productForm.valid) return;

    const loading = await this.loadingController.create({
      message: this.isEditing ? 'Updating product...' : 'Adding product...'
    });
    await loading.present();

    try {
      const formValue = this.productForm.value;

      if (this.isEditing && this.editingProductId) {
        await this.productService.updateProduct(this.editingProductId, formValue);
      } else {
        await this.productService.addProduct(formValue);
      }

      loading.dismiss();
      this.closeModal();
    } catch (error) {
      loading.dismiss();
      this.presentErrorAlert('Failed to save product');
    }
  }

  
  // ================================
  // 🔹 BARCODE SCANNING
  // ================================
  async startBarcodeScan() {
    this.scanning = true;

    const video = this.scannerPreview.nativeElement;

    this.scanControls = await this.scanner.decodeFromVideoDevice(
      undefined,
      video,
      (result, err) => {
        if (result) {
          this.productForm.patchValue({ barcode: result.getText() });
          this.stopBarcodeScan();
        }
      }
    );
  }

  stopBarcodeScan() {
    if (this.scanControls) {
      this.scanControls.stop();
      this.scanControls = null;
    }
    this.scanning = false;
  }

  // ================================
  // 🔹 CATEGORY SAVE
  // ================================
  openAddCategoryModal() {
    this.categoryForm.reset();
    this.isCategoryModalOpen = true;
  }

  closeCategoryModal() {
    this.isCategoryModalOpen = false;
  }

  async saveCategory() {
    if (!this.categoryForm.valid) return;

    const cat = this.categoryForm.value.name.toLowerCase();

    if (this.categories.includes(cat)) {
      this.presentErrorAlert('Category already exists');
      return;
    }

    try {
      await this.productService.addCategory(cat);
      this.categories.push(cat);
      this.closeCategoryModal();
    } catch {
      this.presentErrorAlert('Failed to save category');
    }
  }

  // ================================
  // 🔹 ERROR ALERT
  // ================================
  async presentErrorAlert(msg: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message: msg,
      buttons: ['OK'],
    });
    alert.present();
  }
}
