import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { ReportsService, Order, OrderItem } from '../../../services/reports';

interface SalesData {
  date: string;
  amount: number;
}

interface InventoryMovement {
  productName: string;
  currentStock: number;
  change: number;
}

interface CSVRow {
  date: string;
  product: string;
  quantity: string;
  amount: string;
  transactionId: string;
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: false,
})
export class ReportsPage implements OnInit {
  private reportsService = inject(ReportsService);
  
  @ViewChild('salesChartCanvas') salesChartCanvas!: ElementRef;
  
  // Add all the missing properties
  isLoading: boolean = true;
  orders: Order[] = [];
  topProducts: any[] = [];
  totalSales: number = 0;
  avgTransaction: number = 0;
  transactions: number = 0;
  itemsSold: number = 0;
  
  // New properties for analytics
  selectedPeriod: string = 'daily';
  salesData: SalesData[] = [];
  inventoryMovement: InventoryMovement[] = [];
  private chart: any;

  ngOnInit() {
    this.loadReports();
  }

  loadReports() {
    this.isLoading = true;
    
    this.reportsService.getOrders().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.calculateReportData(orders);
        this.generateSalesTrendData();
        this.generateInventoryMovement();
        this.isLoading = false;
        
        // Initialize chart after data is loaded
        setTimeout(() => {
          this.initializeChart();
        }, 100);
      },
      error: (error) => {
        console.error('Error loading reports:', error);
        this.isLoading = false;
      }
    });
  }

  private calculateReportData(orders: Order[]) {
    // Calculate total sales
    this.totalSales = orders.reduce((sum, order) => sum + order.total, 0);
    
    // Calculate transactions count
    this.transactions = orders.length;
    
    // Calculate average transaction
    this.avgTransaction = this.transactions > 0 ? this.totalSales / this.transactions : 0;
    
    // Calculate items sold
    this.itemsSold = orders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    );
    
    // Calculate top products
    this.calculateTopProducts(orders);
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
    
    // Convert to array and sort by quantity sold
    this.topProducts = Array.from(productMap.entries())
      .map(([id, product]) => ({
        id,
        name: product.name,
        quantity: product.quantity,
        total: product.total
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10); // Top 10 products
  }

  // New methods for analytics
  private generateSalesTrendData() {
    const now = new Date();
    this.salesData = [];
    
    switch (this.selectedPeriod) {
      case 'daily':
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(now.getDate() - i);
          const dateStr = date.toLocaleDateString('en-US', { weekday: 'short' });
          const daySales = this.calculateSalesForDate(date);
          this.salesData.push({ date: dateStr, amount: daySales });
        }
        break;
        
      case 'weekly':
        // Last 4 weeks
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - (i * 7));
          const weekLabel = `Week ${4 - i}`;
          const weekSales = this.calculateSalesForWeek(weekStart);
          this.salesData.push({ date: weekLabel, amount: weekSales });
        }
        break;
        
      case 'monthly':
        // Last 6 months
        for (let i = 5; i >= 0; i--) {
          const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthLabel = month.toLocaleDateString('en-US', { month: 'short' });
          const monthSales = this.calculateSalesForMonth(month);
          this.salesData.push({ date: monthLabel, amount: monthSales });
        }
        break;
    }
  }

  private calculateSalesForDate(date: Date): number {
    return this.orders
      .filter((order: Order) => {
        const orderDate = this.getOrderDate(order.createdAt);
        return orderDate.toDateString() === date.toDateString();
      })
      .reduce((sum: number, order: Order) => sum + order.total, 0);
  }

  private calculateSalesForWeek(startDate: Date): number {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    return this.orders
      .filter((order: Order) => {
        const orderDate = this.getOrderDate(order.createdAt);
        return orderDate >= startDate && orderDate <= endDate;
      })
      .reduce((sum: number, order: Order) => sum + order.total, 0);
  }

  private calculateSalesForMonth(month: Date): number {
    return this.orders
      .filter((order: Order) => {
        const orderDate = this.getOrderDate(order.createdAt);
        return orderDate.getMonth() === month.getMonth() && 
               orderDate.getFullYear() === month.getFullYear();
      })
      .reduce((sum: number, order: Order) => sum + order.total, 0);
  }

  private generateInventoryMovement() {
    // This is a simplified version - you would typically get this from your inventory service
    const movementData: InventoryMovement[] = [];
    
    this.topProducts.forEach((product: any) => {
      movementData.push({
        productName: product.name,
        currentStock: Math.floor(Math.random() * 100) + 10, // Mock data
        change: Math.floor(Math.random() * 20) - 5 // Mock data: -5 to +15
      });
    });
    
    this.inventoryMovement = movementData.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }

  private initializeChart() {
    if (!this.salesChartCanvas?.nativeElement) return;
    
    const ctx = this.salesChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    
    // Simple chart implementation using canvas
    const canvas = this.salesChartCanvas.nativeElement;
    const maxSales = Math.max(...this.salesData.map(d => d.amount));
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw chart
    const padding = 40;
    const chartWidth = canvas.width - (padding * 2);
    const chartHeight = canvas.height - (padding * 2);
    
    // Draw bars
    const barWidth = chartWidth / this.salesData.length;
    this.salesData.forEach((data: SalesData, index: number) => {
      const barHeight = (data.amount / maxSales) * chartHeight;
      const x = padding + (index * barWidth);
      const y = canvas.height - padding - barHeight;
      
      ctx.fillStyle = '#6a11cb';
      ctx.fillRect(x + 5, y, barWidth - 10, barHeight);
      
      // Draw label
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(data.date, x + barWidth / 2, canvas.height - 20);
      
      // Draw value
      ctx.fillText(this.formatCurrency(data.amount), x + barWidth / 2, y - 10);
    });
  }

  onPeriodChange() {
    this.generateSalesTrendData();
    setTimeout(() => {
      this.initializeChart();
    }, 100);
  }

  getPeriodLabel(): string {
    switch (this.selectedPeriod) {
      case 'daily': return 'Last 7 Days';
      case 'weekly': return 'Last 4 Weeks';
      case 'monthly': return 'Last 6 Months';
      default: return '';
    }
  }

  // Export functionality
  exportToExcel() {
    // Simple CSV export implementation
    const csvData = this.generateCSVData();
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  exportToPDF() {
    // Simple PDF export using window.print() for basic implementation
    window.print();
  }

  private generateCSVData(): string {
    const headers = ['Date', 'Product', 'Quantity', 'Amount', 'Transaction ID'];
    
    // Replace flatMap with reduce for compatibility
    const rows: string[][] = this.orders.reduce((acc: string[][], order: Order) => {
      const orderRows = order.items.map((item: OrderItem) => [
        this.getOrderDate(order.createdAt).toISOString().split('T')[0],
        item.name,
        item.quantity.toString(),
        (item.price * item.quantity).toString(),
        order.id || ''
      ]);
      return acc.concat(orderRows);
    }, []);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  // Add the missing formatCurrency method
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

  // Optional: Refresh method
  refreshReports(event: any) {
    this.loadReports();
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }
}