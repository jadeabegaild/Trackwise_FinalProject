import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { ReportsService, Order, OrderItem } from '../../../services/reports';
import { ProductService, Product } from '../../../services/product.service';

interface SalesData {
  date: string;
  amount: number;
}

interface InventoryMovement {
  productName: string;
  currentStock: number;
  change: number;
  productId: string;
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
  private productService = inject(ProductService);
  
  @ViewChild('salesChartCanvas') salesChartCanvas!: ElementRef;
  
  isLoading: boolean = true;
  orders: Order[] = [];
  products: Product[] = [];
  topProducts: any[] = [];
  totalSales: number = 0;
  avgTransaction: number = 0;
  transactions: number = 0;
  itemsSold: number = 0;
  currentDate: Date = new Date();
  
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
        
        this.productService.getProducts().subscribe({
          next: (products) => {
            this.products = products;
            this.generateInventoryMovement(orders, products);
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
        console.error('Error loading reports:', error);
        this.isLoading = false;
      }
    });
  }

  private calculateReportData(orders: Order[]) {
    this.totalSales = orders.reduce((sum, order) => sum + order.total, 0);
    this.transactions = orders.length;
    this.avgTransaction = this.transactions > 0 ? this.totalSales / this.transactions : 0;
    this.itemsSold = orders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    );
    
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
    
    this.topProducts = Array.from(productMap.entries())
      .map(([id, product]) => ({
        id,
        name: product.name,
        quantity: product.quantity,
        total: product.total
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }

  private generateSalesTrendData() {
    const now = new Date();
    this.salesData = [];
    
    switch (this.selectedPeriod) {
      case 'daily':
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(now.getDate() - i);
          const dateStr = date.toLocaleDateString('en-US', { weekday: 'short' });
          const daySales = this.calculateSalesForDate(date);
          this.salesData.push({ date: dateStr, amount: daySales });
        }
        break;
        
      case 'weekly':
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - (i * 7));
          const weekLabel = `Week ${4 - i}`;
          const weekSales = this.calculateSalesForWeek(weekStart);
          this.salesData.push({ date: weekLabel, amount: weekSales });
        }
        break;
        
      case 'monthly':
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

  private generateInventoryMovement(orders: Order[], products: Product[]) {
    const movementData: InventoryMovement[] = [];
    
    const productSales = new Map<string, number>();
    
    orders.forEach((order: Order) => {
      order.items.forEach((item: OrderItem) => {
        const currentSales = productSales.get(item.id) || 0;
        productSales.set(item.id, currentSales + item.quantity);
      });
    });
    
    products.forEach((product: Product) => {
      if (!product.id) return;
      
      const totalSold = productSales.get(product.id) || 0;
      const currentStock = product.quantity;
      const change = -totalSold;
      
      movementData.push({
        productName: product.name,
        currentStock: currentStock,
        change: change,
        productId: product.id
      });
    });
    
    this.inventoryMovement = movementData
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 10);
  }

  private initializeChart() {
    if (!this.salesChartCanvas?.nativeElement) return;
    
    const ctx = this.salesChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    
    const canvas = this.salesChartCanvas.nativeElement;
    const maxSales = Math.max(...this.salesData.map(d => d.amount));
    const maxValue = maxSales > 0 ? maxSales : 1000;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const padding = 40;
    const chartWidth = canvas.width - (padding * 2);
    const chartHeight = canvas.height - (padding * 2);
    
    const barWidth = chartWidth / this.salesData.length;
    this.salesData.forEach((data: SalesData, index: number) => {
      const barHeight = (data.amount / maxValue) * chartHeight;
      const x = padding + (index * barWidth);
      const y = canvas.height - padding - barHeight;
      
      const gradient = ctx.createLinearGradient(0, y, 0, canvas.height - padding);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x + 5, y, barWidth - 10, barHeight);
      
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(data.date, x + barWidth / 2, canvas.height - 20);
      
      if (data.amount > 0) {
        ctx.fillText(this.formatCurrency(data.amount), x + barWidth / 2, y - 10);
      }
    });
    
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
    const csvData = this.generateCSVData();
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  // Print functionality for Excel content
  printExcelContent() {
    this.currentDate = new Date();
    
    // Wait for the next tick to ensure the print content is updated
    setTimeout(() => {
      const printContent = document.getElementById('printContent');
      if (printContent) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Sales Report</title>
                <style>
                  body { 
                    font-family: Arial, sans-serif; 
                    margin: 20px; 
                    color: #333;
                  }
                  .print-header { 
                    text-align: center; 
                    margin-bottom: 30px; 
                    border-bottom: 2px solid #333; 
                    padding-bottom: 20px; 
                  }
                  .print-header h1 { 
                    margin: 0 0 10px 0; 
                    color: #333; 
                    font-size: 24px; 
                  }
                  .print-header p { 
                    margin: 0; 
                    color: #666; 
                    font-size: 14px; 
                  }
                  .print-summary, 
                  .print-top-products, 
                  .print-recent-orders { 
                    margin-bottom: 30px; 
                  }
                  h2 { 
                    color: #333; 
                    border-bottom: 1px solid #ccc; 
                    padding-bottom: 8px; 
                    margin-bottom: 15px; 
                    font-size: 18px; 
                  }
                  table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-bottom: 15px;
                  }
                  th, td { 
                    padding: 8px 12px; 
                    text-align: left; 
                    border: 1px solid #ddd; 
                  }
                  th { 
                    background-color: #f8f9fa; 
                    font-weight: bold; 
                  }
                  tr:nth-child(even) { 
                    background-color: #f8f9fa; 
                  }
                  @media print {
                    body { margin: 0; }
                    .print-header { margin-top: 0; }
                  }
                </style>
              </head>
              <body>
                ${printContent.innerHTML}
              </body>
            </html>
          `);
          printWindow.document.close();
          
          // Wait for content to load before printing
          printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
          };
        }
      }
    }, 100);
  }

  private generateCSVData(): string {
    const headers = ['Date', 'Product', 'Quantity', 'Amount', 'Transaction ID'];
    
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

  exportInventoryToExcel() {
    const headers = ['Product Name', 'Current Stock', 'Stock Change', 'Product ID'];
    const rows = this.inventoryMovement.map(movement => [
      movement.productName,
      movement.currentStock.toString(),
      movement.change.toString(),
      movement.productId
    ]);
    
    const csvData = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory-movement-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
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

  refreshReports(event: any) {
    this.loadReports();
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }
}