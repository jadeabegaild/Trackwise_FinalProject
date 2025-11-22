import {
  Component,
  OnInit,
  inject,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import { ReportsService, Order, OrderItem } from '../../../services/reports';
import { ProductService, Product } from '../../../services/product.service';
import { AuthService, UserData } from 'src/app/services/auth';
import {
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
} from '@angular/fire/auth';

interface SalesData {
  totalSales: number;
  totalOrders: number;
  trend: number;
  orderTrend: number;
}

interface InventoryData {
  totalProducts: number;
  inStock: number;
  lowStockCount: number;
  lowStockItems: any[];
}

interface TopProduct {
  name: string;
  quantity: number;
  total: number;
}

// Extend the UserData interface to include preferences
interface ExtendedUserData extends UserData {
  preferences?: {
    language?: string;
    theme?: string;
    notificationsEnabled?: boolean;
    emailNotifications?: boolean;
  };
  bio?: string;
}

@Component({
  selector: 'app-customers',
  templateUrl: './customers.page.html',
  styleUrls: ['./customers.page.scss'],
  standalone: false,
})
export class CustomerPage implements OnInit {
  private reportsService = inject(ReportsService);
  private productService = inject(ProductService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  @ViewChild('salesChartCanvas') salesChartCanvas!: ElementRef;

  isLoading: boolean = true;
  selectedPeriod: string = 'today';

  salesData: SalesData = {
    totalSales: 0,
    totalOrders: 0,
    trend: 0,
    orderTrend: 0,
  };

  inventoryData: InventoryData = {
    totalProducts: 0,
    inStock: 0,
    lowStockCount: 0,
    lowStockItems: [],
  };

  topProducts: TopProduct[] = [];
  salesChartData: any[] = [];
  allOrders: Order[] = [];
  allProducts: Product[] = [];

  Math = Math;
  isSidebarOpen: boolean = false; // Kept but unused
  isProfileModalOpen: boolean = false;
  currentPage: string = 'customers'; // Defaulted to 'customers'
  contentId: string = 'main-content';
  user: any = {
    name: '',
    email: '',
    avatar: 'assets/images/user-avatar.png',
    role: 'user',
    phone: '',
    bio: '',
    notificationsEnabled: true,
  };
  userData: ExtendedUserData | null = null;

  // New profile management properties
  showProfileDropdown: boolean = false;
  activeProfileSection: string = 'edit';
  isUpdatingProfile: boolean = false;
  isChangingPassword: boolean = false;
  isSavingPreferences: boolean = false;
  uploadProgress: number = 0;
  isEmailVerified: boolean = true;

  // Form groups
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  preferencesForm!: FormGroup;

  ngOnInit() {
    this.loadCustomerData();
    this.loadUserData();
    this.initializeForms();
  }

  private initializeForms(): void {
    // Profile Form
    this.profileForm = this.fb.group({
      businessName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^09\d{9}$/)]],
      bio: [''],
      avatar: [''],
    });

    // Password Form
    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', [Validators.required]],
        newPassword: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator }
    );

    // Preferences Form
    this.preferencesForm = this.fb.group({
      language: ['en'],
      theme: ['light'],
      notificationsEnabled: [true],
      emailNotifications: [true],
    });
  }

  private passwordMatchValidator(control: AbstractControl) {
    const newPassword = control.get('newPassword');
    const confirmPassword = control.get('confirmPassword');

    if (!newPassword || !confirmPassword) return null;

    return newPassword.value === confirmPassword.value
      ? null
      : { passwordMismatch: true };
  }

  private loadUserData(): void {
    this.authService.user$.subscribe({
      next: async (user) => {
        if (user) {
          const userData = await this.authService.getUserData(user.uid);
          this.userData = userData as ExtendedUserData;
          this.isEmailVerified = user.emailVerified;

          // Update user object
          this.user = {
            name:
              user.displayName || this.userData?.businessName || 'User Name',
            email: user.email || '',
            avatar: user.photoURL || 'assets/images/user-avatar.png',
            role: this.userData?.role || 'user',
            phone: this.userData?.phone || '',
            bio: this.userData?.bio || '',
            notificationsEnabled: true,
          };

          // Update forms with user data
          this.profileForm.patchValue({
            businessName: this.userData?.businessName || '',
            email: user.email || '',
            phone: this.userData?.phone || '',
            bio: this.userData?.bio || '',
            avatar: user.photoURL || 'assets/images/user-avatar.png',
          });

          // Load preferences if available
          if (this.userData?.preferences) {
            this.preferencesForm.patchValue(this.userData.preferences);
          }
        } else {
          this.user = {
            name: '',
            email: '',
            avatar: 'assets/images/user-avatar.png',
            role: 'user',
            phone: '',
            bio: '',
            notificationsEnabled: true,
          };
          this.userData = null;
        }
      },
      error: (error) => {
        console.error('Error loading user data:', error);
      },
    });
  }

  // Profile Dropdown Methods
  toggleProfileDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.showProfileDropdown = !this.showProfileDropdown;
  }

  @HostListener('document:click')
  closeProfileDropdown(): void {
    this.showProfileDropdown = false;
  }

  // Focus management for modal
  private focusTrapModal(event: KeyboardEvent): void {
    if (!this.isProfileModalOpen) return;

    const modal = document.querySelector('ion-modal');
    if (!modal) return;

    // Get all focusable elements in the modal
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    // Trap focus within modal
    if (event.key === 'Tab') {
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }

    // Close modal on Escape key
    if (event.key === 'Escape') {
      this.closeProfileModal();
    }
  }

  // Initialize focus when modal opens
  private initializeModalFocus(): void {
    setTimeout(() => {
      const modal = document.querySelector('ion-modal');
      if (modal) {
        // Focus on the first focusable element
        const firstInput = modal.querySelector(
          'input, button, [tabindex]:not([tabindex="-1"])'
        );
        if (firstInput) {
          (firstInput as HTMLElement).focus();
        }

        // Add global keydown listener for focus trapping
        document.addEventListener('keydown', this.focusTrapModal.bind(this));
      }
    }, 150);
  }

  // Clean up when modal closes
  private cleanupModalFocus(): void {
    document.removeEventListener('keydown', this.focusTrapModal.bind(this));

    // Restore focus to the profile button that opened the modal
    const profileButton = document.querySelector('.user-button');
    if (profileButton) {
      (profileButton as HTMLElement).focus();
    }
  }

  // Profile Modal Methods
  openProfileModal(section: string): void {
    this.activeProfileSection = section;
    this.isProfileModalOpen = true;
    this.showProfileDropdown = false;
    // this.isSidebarOpen = false; // Sidebar logic removed
    this.initializeModalFocus();
  }

  closeProfileModal(): void {
    this.isProfileModalOpen = false;
    this.cleanupModalFocus();
    this.resetForms();
  }

  getProfileModalTitle(): string {
    switch (this.activeProfileSection) {
      case 'edit':
        return 'Edit Profile';
      case 'password':
        return 'Change Password';
      case 'preferences':
        return 'Preferences';
      default:
        return 'Profile Management';
    }
  }

  // Profile Management Methods
  async updateProfile(): Promise<void> {
    if (this.profileForm.invalid) return;

    this.isUpdatingProfile = true;
    const user = this.authService.getCurrentUser();
    if (!user) return;

    try {
      const formData = this.profileForm.value;

      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: formData.businessName,
        photoURL: formData.avatar,
      });

      // Update Firestore user data
      if (this.userData) {
        await this.authService.updateUserData(user.uid, {
          businessName: formData.businessName,
          phone: formData.phone,
          bio: formData.bio,
          displayName: formData.businessName,
          updatedAt: new Date(),
        } as Partial<UserData>);
      }

      console.log('Profile updated successfully');
      this.isUpdatingProfile = false;
      this.closeProfileModal();
      this.loadUserData(); // Refresh user data
    } catch (error) {
      console.error('Error updating profile:', error);
      this.isUpdatingProfile = false;
    }
  }

  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) return;

    this.isChangingPassword = true;
    const user = this.authService.getCurrentUser();
    if (!user || !user.email) return;

    try {
      const formData = this.passwordForm.value;

      // Reauthenticate user
      const credential = EmailAuthProvider.credential(
        user.email,
        formData.currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, formData.newPassword);

      console.log('Password changed successfully');
      this.isChangingPassword = false;
      this.closeProfileModal();
    } catch (error: any) {
      console.error('Error changing password:', error);
      this.isChangingPassword = false;

      // Handle specific error cases
      if (error.code === 'auth/wrong-password') {
        console.error('Wrong current password');
      } else if (error.code === 'auth/weak-password') {
        console.error('Password is too weak');
      }
    }
  }

  async savePreferences(): Promise<void> {
    this.isSavingPreferences = true;
    const user = this.authService.getCurrentUser();
    if (!user) return;

    try {
      const preferences = this.preferencesForm.value;

      if (this.userData) {
        await this.authService.updateUserData(user.uid, {
          preferences: preferences,
          updatedAt: new Date(),
        } as Partial<ExtendedUserData>);
      }

      console.log('Preferences saved successfully');
      this.isSavingPreferences = false;
      this.closeProfileModal();

      // Apply theme preference
      this.applyTheme(preferences.theme);
    } catch (error) {
      console.error('Error saving preferences:', error);
      this.isSavingPreferences = false;
    }
  }

  private applyTheme(theme: string): void {
    // Implement theme switching logic here
    document.body.classList.toggle('dark', theme === 'dark');
  }

  // File Upload Methods
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.uploadImage(file);
    }
  }

  async uploadImage(file: File): Promise<void> {
    // Simulate upload process - replace with actual Firebase Storage upload
    this.uploadProgress = 0;

    const interval = setInterval(() => {
      this.uploadProgress += 10;
      if (this.uploadProgress >= 100) {
        clearInterval(interval);

        // For demo purposes, create a blob URL
        const imageUrl = URL.createObjectURL(file);
        this.profileForm.patchValue({ avatar: imageUrl });

        // In real implementation, you would:
        // 1. Upload to Firebase Storage
        // 2. Get download URL
        // 3. Update user profile with the URL
      }
    }, 200);
  }

  // Email Verification
  async verifyEmail(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    try {
      await sendEmailVerification(user);
      console.log('Verification email sent');
      this.showProfileDropdown = false;
    } catch (error) {
      console.error('Error sending verification email:', error);
    }
  }

  // Reset forms when modal closes
  private resetForms(): void {
    this.profileForm.markAsPristine();
    this.passwordForm.reset();
    this.preferencesForm.markAsPristine();
    this.uploadProgress = 0;
  }

  // Removed: toggleSidebar()
  // Removed: openProfile()
  // Removed: closeProfile()
  // Removed: saveProfile()

  // Removed: navigateTo(page: string)

  // These are now only callable via the dropdown, removing editProfile, changePasswordOld, notificationSettings, privacySettings, and preferences functions, as they are no longer accessible from the sidebar.
  // I will keep the implementations if they are used by the modal, but remove the redundant wrappers.

  // editProfile() is only used by the sidebar/old component flow, removing it.
  // changePasswordOld() is an alternative, removing it.
  // notificationSettings() is now only handled by the preferences form, removing it.
  // privacySettings() is now only a console log, removing it.
  // preferences() is now only handled by openProfileModal('preferences'), removing it.

  // Keeping the essential functions:

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }

  // The rest of the data loading and chart logic remains
  loadCustomerData() {
    this.isLoading = true;

    this.reportsService.getOrders().subscribe({
      next: (orders) => {
        this.allOrders = orders;
        this.calculateSalesData(orders);
        this.calculateTopProducts(orders);

        this.productService.getProducts().subscribe({
          next: (products) => {
            this.allProducts = products;
            this.generateInventoryData(products);
            this.generateChartData();
            this.isLoading = false;

            setTimeout(() => {
              this.initializeChart();
            }, 100);
          },
          error: (error) => {
            console.error('Error loading products:', error);
            this.isLoading = false;
          },
        });
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.isLoading = false;
      },
    });
  }

  private calculateSalesData(orders: Order[]) {
    const filteredOrders = this.filterOrdersByPeriod(orders);
    const previousPeriodOrders = this.getPreviousPeriodOrders(orders);

    this.salesData.totalSales = filteredOrders.reduce(
      (sum, order) => sum + order.total,
      0
    );
    this.salesData.totalOrders = filteredOrders.length;

    const previousSales = previousPeriodOrders.reduce(
      (sum, order) => sum + order.total,
      0
    );
    const previousOrders = previousPeriodOrders.length;

    this.salesData.trend =
      previousSales > 0
        ? ((this.salesData.totalSales - previousSales) / previousSales) * 100
        : this.salesData.totalSales > 0
        ? 100
        : 0;

    this.salesData.orderTrend =
      previousOrders > 0
        ? ((this.salesData.totalOrders - previousOrders) / previousOrders) * 100
        : this.salesData.totalOrders > 0
        ? 100
        : 0;
  }

  private filterOrdersByPeriod(orders: Order[]): Order[] {
    const now = new Date();

    switch (this.selectedPeriod) {
      case 'today':
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        return orders.filter((order) => {
          const orderDate = this.getOrderDate(order.createdAt);
          return orderDate >= todayStart && orderDate <= todayEnd;
        });

      case 'weekly':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        return orders.filter((order) => {
          const orderDate = this.getOrderDate(order.createdAt);
          return orderDate >= weekStart && orderDate <= weekEnd;
        });

      case 'monthly':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );

        return orders.filter((order) => {
          const orderDate = this.getOrderDate(order.createdAt);
          return orderDate >= monthStart && orderDate <= monthEnd;
        });

      default:
        return orders;
    }
  }

  private getPreviousPeriodOrders(orders: Order[]): Order[] {
    const now = new Date();

    switch (this.selectedPeriod) {
      case 'today':
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);

        return orders.filter((order) => {
          const orderDate = this.getOrderDate(order.createdAt);
          return orderDate >= yesterday && orderDate <= yesterdayEnd;
        });

      case 'weekly':
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
        lastWeekStart.setHours(0, 0, 0, 0);

        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        lastWeekEnd.setHours(23, 59, 59, 999);

        return orders.filter((order) => {
          const orderDate = this.getOrderDate(order.createdAt);
          return orderDate >= lastWeekStart && orderDate <= lastWeekEnd;
        });

      case 'monthly':
        const lastMonthStart = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1
        );
        const lastMonthEnd = new Date(
          now.getFullYear(),
          now.getMonth(),
          0,
          23,
          59,
          59,
          999
        );

        return orders.filter((order) => {
          const orderDate = this.getOrderDate(order.createdAt);
          return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
        });

      default:
        return [];
    }
  }

  private calculateTopProducts(orders: Order[]) {
    const productMap = new Map<
      string,
      { name: string; quantity: number; total: number }
    >();

    orders.forEach((order: Order) => {
      order.items.forEach((item: OrderItem) => {
        const existing = productMap.get(item.id) || {
          name: item.name,
          quantity: 0,
          total: 0,
        };

        productMap.set(item.id, {
          name: item.name,
          quantity: existing.quantity + item.quantity,
          total: existing.total + item.price * item.quantity,
        });
      });
    });

    this.topProducts = Array.from(productMap.entries())
      .map(([id, product]) => ({
        name: product.name,
        quantity: product.quantity,
        total: product.total,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }

  private generateInventoryData(products: Product[]) {
    const lowStockItems = products
      .filter((product) => product.quantity <= 10)
      .map((product) => ({
        name: product.name,
        currentStock: product.quantity,
        image: product.image,
      }));

    this.inventoryData = {
      totalProducts: products.length,
      inStock: products.reduce((sum, product) => sum + product.quantity, 0),
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.slice(0, 5),
    };
  }

  private generateChartData() {
    const now = new Date();
    this.salesChartData = [];

    switch (this.selectedPeriod) {
      case 'today':
        for (let i = 11; i >= 0; i--) {
          const hour = new Date(now);
          hour.setHours(now.getHours() - i, 0, 0, 0);

          const hourEnd = new Date(hour);
          hourEnd.setHours(hour.getHours() + 1, 0, 0, 0);

          const hourSales = this.allOrders
            .filter((order) => {
              const orderDate = this.getOrderDate(order.createdAt);
              return orderDate >= hour && orderDate < hourEnd;
            })
            .reduce((sum, order) => sum + order.total, 0);

          const label = hour.getHours().toString().padStart(2, '0') + ':00';
          this.salesChartData.push({
            label,
            sales: hourSales,
            color: 'rgba(30, 74, 99, 1)', // Consistent color for line chart
          });
        }
        break;

      case 'weekly':
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(now.getDate() - i);
          date.setHours(0, 0, 0, 0);

          const dateEnd = new Date(date);
          dateEnd.setHours(23, 59, 59, 999);

          const daySales = this.allOrders
            .filter((order) => {
              const orderDate = this.getOrderDate(order.createdAt);
              return orderDate >= date && orderDate <= dateEnd;
            })
            .reduce((sum, order) => sum + order.total, 0);

          const label = days[date.getDay()];
          this.salesChartData.push({
            label,
            sales: daySales,
            color: 'rgba(30, 74, 99, 1)', // Consistent color for line chart
          });
        }
        break;

      case 'monthly':
        for (let i = 5; i >= 0; i--) {
          const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
          const monthEnd = new Date(
            month.getFullYear(),
            month.getMonth() + 1,
            0,
            23,
            59,
            59,
            999
          );

          const monthSales = this.allOrders
            .filter((order) => {
              const orderDate = this.getOrderDate(order.createdAt);
              return orderDate >= monthStart && orderDate <= monthEnd;
            })
            .reduce((sum, order) => sum + order.total, 0);

          const label = month.toLocaleDateString('en-US', { month: 'short' });
          this.salesChartData.push({
            label,
            sales: monthSales,
            color: 'rgba(30, 74, 99, 1)', // Consistent color for line chart
          });
        }
        break;
    }
  }

  private initializeChart() {
    if (!this.salesChartCanvas?.nativeElement) return;

    const ctx = this.salesChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const canvas = this.salesChartCanvas.nativeElement;
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // If no data, show message
    if (
      this.salesChartData.length === 0 ||
      Math.max(...this.salesChartData.map((d) => d.sales)) === 0
    ) {
      ctx.fillStyle = '#6c757d';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        'No sales data available',
        canvas.width / 2,
        canvas.height / 2
      );
      return;
    }

    const maxSales = Math.max(...this.salesChartData.map((d) => d.sales));
    const maxValue = maxSales > 0 ? maxSales * 1.1 : 1000;

    const padding = {
      top: 40,
      right: 20,
      bottom: 40,
      left: 60, // Increased left padding for date/time labels
    };

    const chartWidth = canvas.width - (padding.left + padding.right);
    const chartHeight = canvas.height - (padding.top + padding.bottom);

    // Draw background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);

    // Draw grid lines
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;

    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (i * chartHeight) / gridLines;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
    }

    // Calculate points for the line
    const points = this.salesChartData.map((data, index) => {
      const x =
        padding.left + (index * chartWidth) / (this.salesChartData.length - 1);
      const y =
        padding.top + chartHeight - (data.sales / maxValue) * chartHeight;
      return { x, y, data };
    });

    // Create gradient for the line
    const gradient = ctx.createLinearGradient(
      0,
      padding.top,
      0,
      padding.top + chartHeight
    );
    gradient.addColorStop(0, 'rgba(30, 74, 99, 0.8)');
    gradient.addColorStop(1, 'rgba(30, 74, 99, 0.4)');

    // Draw area under the line
    ctx.fillStyle = 'rgba(30, 74, 99, 0.1)';
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);
    points.forEach((point) => {
      ctx.lineTo(point.x, point.y);
    });
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.closePath();
    ctx.fill();

    // Draw the line
    ctx.strokeStyle = 'rgba(30, 74, 99, 1)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    // Create smooth curve for the line
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1];
      const currentPoint = points[i];

      // Calculate control points for smooth curve
      const controlPoint1 = {
        x: prevPoint.x + (currentPoint.x - prevPoint.x) * 0.3,
        y: prevPoint.y,
      };

      const controlPoint2 = {
        x: currentPoint.x - (currentPoint.x - prevPoint.x) * 0.3,
        y: currentPoint.y,
      };

      ctx.bezierCurveTo(
        controlPoint1.x,
        controlPoint1.y,
        controlPoint2.x,
        controlPoint2.y,
        currentPoint.x,
        currentPoint.y
      );
    }

    ctx.stroke();

    // Draw data points
    points.forEach((point) => {
      // Point background
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Point border
      ctx.strokeStyle = 'rgba(30, 74, 99, 1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
      ctx.stroke();

      // Draw value above point (sales amount)
      if (point.data.sales > 0) {
        ctx.fillStyle = '#495057';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          this.formatCurrency(point.data.sales),
          point.x,
          point.y - 15
        );
      }
    });

    // Draw Y-axis labels (dates/times)
    ctx.fillStyle = '#6c757d';
    ctx.font = '11px Arial';
    ctx.textAlign = 'right';

    // Get the appropriate time/date labels based on selected period
    const timeLabels = this.getTimeLabelsForYAxis();

    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (i * chartHeight) / gridLines;

      // Use the corresponding time/date label for this grid line
      if (timeLabels[i]) {
        ctx.fillText(timeLabels[i], padding.left - 10, y + 4);
      }
    }

    // Draw axes
    ctx.strokeStyle = '#495057';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();
  }

  private getTimeLabelsForYAxis(): string[] {
    const now = new Date();
    const labels: string[] = [];

    switch (this.selectedPeriod) {
      case 'today':
        // For today, show hours in reverse order (most recent at top)
        for (let i = 5; i >= 0; i--) {
          const hour = new Date(now);
          hour.setHours(now.getHours() - i * 2); // Show every 2 hours
          labels.push(hour.getHours().toString().padStart(2, '0') + ':00');
        }
        break;

      case 'weekly':
        // For weekly, show days of the week
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const currentDay = now.getDay();

        for (let i = 5; i >= 0; i--) {
          const dayIndex = (currentDay - i + 7) % 7;
          labels.push(days[dayIndex]);
        }
        // Add current day at the end
        labels.push(days[currentDay]);
        break;

      case 'monthly':
        // For monthly, show months
        const months = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        const currentMonth = now.getMonth();

        for (let i = 5; i >= 0; i--) {
          const monthIndex = (currentMonth - i + 12) % 12;
          labels.push(months[monthIndex]);
        }
        // Add current month at the end
        labels.push(months[currentMonth]);
        break;

      default:
        // Fallback - use generic labels
        for (let i = 0; i <= 5; i++) {
          labels.push(`Time ${i + 1}`);
        }
    }

    return labels;
  }

  onPeriodChange() {
    this.calculateSalesData(this.allOrders);
    this.generateChartData();
    setTimeout(() => {
      this.initializeChart();
    }, 100);
  }

  refreshData() {
    this.loadCustomerData();
  }

  getPeriodLabel(): string {
    switch (this.selectedPeriod) {
      case 'today':
        return 'Today';
      case 'weekly':
        return 'This Week';
      case 'monthly':
        return 'This Month';
      default:
        return '';
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  }

  getOrderDate(createdAt: Date | Timestamp): Date {
    if (createdAt instanceof Timestamp) {
      return createdAt.toDate();
    }
    return createdAt;
  }
}
