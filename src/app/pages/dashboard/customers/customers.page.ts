import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { ReportsService, Order, OrderItem } from '../../../services/reports';
import { ProductService, Product } from '../../../services/product.service';
import { AuthService, UserData } from 'src/app/services/auth'; 

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
  
  @ViewChild('salesChartCanvas') salesChartCanvas!: ElementRef;
  
  isLoading: boolean = true;
  selectedPeriod: string = 'today';
  
  salesData: SalesData = {
    totalSales: 0,
    totalOrders: 0,
    trend: 0,
    orderTrend: 0
  };
  
  inventoryData: InventoryData = {
    totalProducts: 0,
    inStock: 0,
    lowStockCount: 0,
    lowStockItems: []
  };
  
  topProducts: TopProduct[] = [];
  salesChartData: any[] = [];
  allOrders: Order[] = [];
  allProducts: Product[] = [];
  
  Math = Math;
  isSidebarOpen: boolean = false;
  isProfileModalOpen: boolean = false;
  currentPage: string = 'dashboard';
  contentId: string = 'main-content';
  user: any = {
    name: '',
    email: '',
    avatar: 'assets/images/user-avatar.png',
    role: 'user',
    phone: '',
    bio: '',
    notificationsEnabled: true
  };
  userData: UserData | null = null;

  ngOnInit() {
    this.loadCustomerData();
    this.loadUserData(); 
  }

  private loadUserData(): void {
    this.authService.user$.subscribe({
      next: async (user) => {
        if (user) {
          this.userData = await this.authService.getUserData(user.uid);
          
          this.user = {
            name: user.displayName || this.userData?.businessName || 'User Name',
            email: user.email || '',
            avatar: user.photoURL || 'assets/images/user-avatar.png',
            role: this.userData?.role || 'user',
            phone: this.userData?.phone || '',
            bio: '', 
            notificationsEnabled: true
          };
        } else {
          this.user = {
            name: '',
            email: '',
            avatar: 'assets/images/user-avatar.png',
            role: 'user',
            phone: '',
            bio: '',
            notificationsEnabled: true
          };
          this.userData = null;
        }
      },
      error: (error) => {
        console.error('Error loading user data:', error);
      }
    });
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  openProfile(): void {
    this.isProfileModalOpen = true;
    this.isSidebarOpen = false;
  }

  closeProfile(): void {
    this.isProfileModalOpen = false;
  }

  async saveProfile(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    try {
      await updateProfile(user, {
        displayName: this.user.name,
        photoURL: this.user.avatar
      });

      if (this.userData) {
        await this.authService.updateUserData(user.uid, {
          businessName: this.user.name,
          phone: this.user.phone,
          displayName: this.user.name
        });
      }

      console.log('Profile updated successfully');
      this.closeProfile();
      
      this.loadUserData();
      
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  }

  navigateTo(page: string): void {
    this.currentPage = page;
    this.isSidebarOpen = false;
    
    switch (page) {
      case 'dashboard':
        break;
      case 'products':
        break;
      case 'orders':
        break;
      case 'customers':
        break;
      case 'inventory':
        break;
      case 'reports':
        break;
    }
  }

  editProfile(): void {
    this.openProfile();
  }

  async changePassword(): Promise<void> {
    const email = this.authService.getUserEmail();
    if (email) {
      try {
        await this.authService.sendPasswordResetEmail(email);
        console.log('Password reset email sent');
      } catch (error) {
        console.error('Error sending password reset email:', error);
      }
    }
  }

  notificationSettings(): void {
    this.user.notificationsEnabled = !this.user.notificationsEnabled;
    console.log(`Notifications ${this.user.notificationsEnabled ? 'enabled' : 'disabled'}`);
    
    const user = this.authService.getCurrentUser();
    if (user && this.userData) {
      this.authService.updateUserData(user.uid, {
      } as Partial<UserData>);
    }
  }

  privacySettings(): void {
    console.log('Privacy settings clicked');
  }

  preferences(): void {
    console.log('Preferences clicked');
  }

  helpSupport(): void {
    console.log('Help & support clicked');
  }

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }

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
          }
        });
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.isLoading = false;
      }
    });
  }

  private calculateSalesData(orders: Order[]) {
    const filteredOrders = this.filterOrdersByPeriod(orders);
    const previousPeriodOrders = this.getPreviousPeriodOrders(orders);
    
    this.salesData.totalSales = filteredOrders.reduce((sum, order) => sum + order.total, 0);
    this.salesData.totalOrders = filteredOrders.length;
    
    const previousSales = previousPeriodOrders.reduce((sum, order) => sum + order.total, 0);
    const previousOrders = previousPeriodOrders.length;
    
    this.salesData.trend = previousSales > 0 
      ? ((this.salesData.totalSales - previousSales) / previousSales) * 100 
      : this.salesData.totalSales > 0 ? 100 : 0;
      
    this.salesData.orderTrend = previousOrders > 0
      ? ((this.salesData.totalOrders - previousOrders) / previousOrders) * 100
      : this.salesData.totalOrders > 0 ? 100 : 0;
  }

  private filterOrdersByPeriod(orders: Order[]): Order[] {
    const now = new Date();
    
    switch (this.selectedPeriod) {
      case 'today':
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        
        return orders.filter(order => {
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
        
        return orders.filter(order => {
          const orderDate = this.getOrderDate(order.createdAt);
          return orderDate >= weekStart && orderDate <= weekEnd;
        });
        
      case 'monthly':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        
        return orders.filter(order => {
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
        
        return orders.filter(order => {
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
        
        return orders.filter(order => {
          const orderDate = this.getOrderDate(order.createdAt);
          return orderDate >= lastWeekStart && orderDate <= lastWeekEnd;
        });
        
      case 'monthly':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        
        return orders.filter(order => {
          const orderDate = this.getOrderDate(order.createdAt);
          return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
        });
        
      default:
        return [];
    }
  }

  private calculateTopProducts(orders: Order[]) {
    const productMap = new Map<string, { name: string; quantity: number; total: number }>();
    
    orders.forEach((order: Order) => {
      order.items.forEach((item: OrderItem) => {
        const existing = productMap.get(item.id) || { 
          name: item.name, 
          quantity: 0, 
          total: 0 
        };
        
        productMap.set(item.id, {
          name: item.name,
          quantity: existing.quantity + item.quantity,
          total: existing.total + (item.price * item.quantity)
        });
      });
    });
    
    this.topProducts = Array.from(productMap.entries())
      .map(([id, product]) => ({
        name: product.name,
        quantity: product.quantity,
        total: product.total
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }

  private generateInventoryData(products: Product[]) {
    const lowStockItems = products
      .filter(product => product.quantity <= 10) 
      .map(product => ({
        name: product.name,
        currentStock: product.quantity 
      }));
    
    this.inventoryData = {
      totalProducts: products.length,
      inStock: products.reduce((sum, product) => sum + product.quantity, 0), 
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.slice(0, 5) 
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
            .filter(order => {
              const orderDate = this.getOrderDate(order.createdAt);
              return orderDate >= hour && orderDate < hourEnd;
            })
            .reduce((sum, order) => sum + order.total, 0);
            
          const label = hour.getHours().toString().padStart(2, '0') + ':00';
          this.salesChartData.push({ label, sales: hourSales });
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
            .filter(order => {
              const orderDate = this.getOrderDate(order.createdAt);
              return orderDate >= date && orderDate <= dateEnd;
            })
            .reduce((sum, order) => sum + order.total, 0);
            
          const label = days[date.getDay()];
          this.salesChartData.push({ label, sales: daySales });
        }
        break;
        
      case 'monthly':
        for (let i = 5; i >= 0; i--) {
          const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
          const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
          
          const monthSales = this.allOrders
            .filter(order => {
              const orderDate = this.getOrderDate(order.createdAt);
              return orderDate >= monthStart && orderDate <= monthEnd;
            })
            .reduce((sum, order) => sum + order.total, 0);
            
          const label = month.toLocaleDateString('en-US', { month: 'short' });
          this.salesChartData.push({ label, sales: monthSales });
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

    const maxSales = Math.max(...this.salesChartData.map(d => d.sales));
    const maxValue = maxSales > 0 ? maxSales * 1.1 : 1000; 

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = {
      top: 40,
      right: 20,
      bottom: 60,
      left: 50
    };
    
    const chartWidth = canvas.width - (padding.left + padding.right);
    const chartHeight = canvas.height - (padding.top + padding.bottom);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);

    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;
    
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (i * chartHeight / gridLines);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
    }

    const barWidth = chartWidth / this.salesChartData.length;
    const barSpacing = barWidth * 0.2;
    const actualBarWidth = barWidth - barSpacing;

    this.salesChartData.forEach((data, index) => {
      const barHeight = (data.sales / maxValue) * chartHeight;
      const x = padding.left + (index * barWidth) + (barSpacing / 2);
      const y = padding.top + chartHeight - barHeight;

      const gradient = ctx.createLinearGradient(0, y, 0, padding.top + chartHeight);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, actualBarWidth, barHeight);

      if (data.sales > 0) {
        ctx.fillStyle = '#495057';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.formatCurrency(data.sales), x + actualBarWidth / 2, y - 8);
      }

      ctx.fillStyle = '#6c757d';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(data.label, x + actualBarWidth / 2, padding.top + chartHeight + 20);
    });

    ctx.fillStyle = '#6c757d';
    ctx.font = '11px Arial';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridLines; i++) {
      const value = (maxValue * (1 - i / gridLines)).toFixed(0);
      const y = padding.top + (i * chartHeight / gridLines);
      ctx.fillText(this.formatCurrency(Number(value)), padding.left - 10, y + 4);
    }

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

    if (maxSales === 0) {
      ctx.strokeStyle = '#ccc';
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(padding.left, padding.top + chartHeight);
      ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = '#6c757d';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No sales data available', canvas.width / 2, canvas.height / 2);
    }
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
      case 'today': return 'Today';
      case 'weekly': return 'This Week';
      case 'monthly': return 'This Month';
      default: return '';
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  getOrderDate(createdAt: Date | Timestamp): Date {
    if (createdAt instanceof Timestamp) {
      return createdAt.toDate();
    }
    return createdAt;
  }
}

import { updateProfile } from '@angular/fire/auth';