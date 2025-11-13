import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { ReportsService, Order, OrderItem } from '../../../services/reports';

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
  
  @ViewChild('salesChartCanvas') salesChartCanvas!: ElementRef;
  
  isLoading: boolean = true;
  selectedPeriod: string = 'today';
  
  // Data objects
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
  
  // Make Math available in template
  Math = Math;

  ngOnInit() {
    this.loadCustomerData();
  }

  loadCustomerData() {
    this.isLoading = true;
    
    this.reportsService.getOrders().subscribe({
      next: (orders) => {
        this.allOrders = orders;
        this.calculateSalesData(orders);
        this.calculateTopProducts(orders);
        this.generateInventoryData(orders);
        this.generateChartData();
        this.isLoading = false;
        
        setTimeout(() => {
          this.initializeChart();
        }, 100);
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
    
    // Current period calculations
    this.salesData.totalSales = filteredOrders.reduce((sum, order) => sum + order.total, 0);
    this.salesData.totalOrders = filteredOrders.length;
    
    // Previous period calculations for trends
    const previousSales = previousPeriodOrders.reduce((sum, order) => sum + order.total, 0);
    const previousOrders = previousPeriodOrders.length;
    
    // Calculate trends
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

  private generateInventoryData(orders: Order[]) {
    // Calculate inventory data based on orders and product information
    const productMap = new Map<string, { name: string; sold: number; stock: number }>();
    
    // Aggregate product sales data
    orders.forEach((order: Order) => {
      order.items.forEach((item: OrderItem) => {
        const existing = productMap.get(item.id) || { 
          name: item.name, 
          sold: 0, 
          stock: 50 // Default stock level - replace with actual inventory data
        };
        
        productMap.set(item.id, {
          name: item.name,
          sold: existing.sold + item.quantity,
          stock: existing.stock
        });
      });
    });
    
    // Calculate inventory metrics
    const products = Array.from(productMap.values());
    const lowStockItems = products
      .filter(product => product.stock - product.sold <= 10) // Low stock threshold
      .map(product => ({
        name: product.name,
        currentStock: product.stock - product.sold
      }));
    
    this.inventoryData = {
      totalProducts: products.length,
      inStock: products.reduce((sum, product) => sum + (product.stock - product.sold), 0),
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.slice(0, 5) // Show top 5 low stock items
    };
  }

  private generateChartData() {
    const now = new Date();
    this.salesChartData = [];
    
    switch (this.selectedPeriod) {
      case 'today':
        // Last 12 hours
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
            
          const label = hour.getHours() + ':00';
          this.salesChartData.push({ label, sales: hourSales });
        }
        break;
        
      case 'weekly':
        // Last 7 days
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
            
          const label = date.toLocaleDateString('en-US', { weekday: 'short' });
          this.salesChartData.push({ label, sales: daySales });
        }
        break;
        
      case 'monthly':
        // Last 4 weeks
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          
          const weekSales = this.allOrders
            .filter(order => {
              const orderDate = this.getOrderDate(order.createdAt);
              return orderDate >= weekStart && orderDate <= weekEnd;
            })
            .reduce((sum, order) => sum + order.total, 0);
            
          const label = `Week ${4 - i}`;
          this.salesChartData.push({ label, sales: weekSales });
        }
        break;
    }
  }

  private initializeChart() {
    if (!this.salesChartCanvas?.nativeElement) return;
    
    const ctx = this.salesChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    
    const canvas = this.salesChartCanvas.nativeElement;
    const maxSales = Math.max(...this.salesChartData.map(d => d.sales));
    const maxValue = maxSales > 0 ? maxSales : 1000; // Default max if no sales
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw chart
    const padding = 40;
    const chartWidth = canvas.width - (padding * 2);
    const chartHeight = canvas.height - (padding * 2);
    
    // Draw bars
    const barWidth = chartWidth / this.salesChartData.length;
    this.salesChartData.forEach((data, index) => {
      const barHeight = (data.sales / maxValue) * chartHeight;
      const x = padding + (index * barWidth);
      const y = canvas.height - padding - barHeight;
      
      // Gradient fill
      const gradient = ctx.createLinearGradient(0, y, 0, canvas.height - padding);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x + 5, y, barWidth - 10, barHeight);
      
      // Draw label
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(data.label, x + barWidth / 2, canvas.height - 20);
      
      // Draw value
      if (data.sales > 0) {
        ctx.fillText(this.formatCurrency(data.sales), x + barWidth / 2, y - 10);
      }
    });
    
    // Draw zero line if no data
    if (maxSales === 0) {
      ctx.strokeStyle = '#ccc';
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(padding, canvas.height - padding);
      ctx.lineTo(canvas.width - padding, canvas.height - padding);
      ctx.stroke();
      ctx.setLineDash([]);
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