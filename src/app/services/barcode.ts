import { Injectable } from '@angular/core';
import { AlertController, Platform } from '@ionic/angular';

// Declare jsqr to avoid TypeScript errors
declare const jsQR: any;

@Injectable({
  providedIn: 'root'
})
export class Barcode {

  constructor(
    private alertController: AlertController,
    private platform: Platform
  ) {}

  async startScan(): Promise<string> {
    if (this.platform.is('capacitor')) {
      // For mobile devices - use mock for now
      return this.startMobileScan();
    } else {
      // For web browsers - use file input with QR code scanning
      return this.startWebScan();
    }
  }

  private async startMobileScan(): Promise<string> {
    // Mock mobile scanning for now
    this.showAlert('Mobile Scan', 'Mobile barcode scanning will be implemented with Capacitor. Using demo barcode.');
    return this.generateMockBarcode();
  }

  private async startWebScan(): Promise<string> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      input.onchange = async (event: any) => {
        const file = event.target.files[0];
        if (file) {
          try {
            const barcode = await this.scanBarcodeFromImage(file);
            if (barcode) {
              resolve(barcode);
            } else {
              this.showAlert('Scan Failed', 'Could not read barcode from image. Using demo barcode.');
              resolve(this.generateMockBarcode());
            }
          } catch (error) {
            this.showAlert('Error', 'Error processing image. Using demo barcode.');
            resolve(this.generateMockBarcode());
          }
        } else {
          resolve('');
        }
      };
      
      input.click();
    });
  }

  private async scanBarcodeFromImage(file: File): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          
          try {
            // Try to use jsQR if available
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code) {
              resolve(code.data);
            } else {
              resolve('');
            }
          } catch (error) {
            resolve('');
          }
        } else {
          resolve('');
        }
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  private generateMockBarcode(): string {
    const mockBarcodes = [
      '1234567890123',
      '2345678901234', 
      '3456789012345',
      '4567890123456',
      '5678901234567',
      '6789012345678',
      '7890123456789',
      '8901234567890'
    ];
    return mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)];
  }

  isValidBarcode(barcode: string): boolean {
    return barcode.length > 0;
  }

  generateMockProduct(barcode: string): any {
    const products: { [key: string]: any } = {
      '1234567890123': { name: 'Laptop Computer', price: 899.99, category: 'Electronics' },
      '2345678901234': { name: 'Wireless Mouse', price: 25.50, category: 'Electronics' },
      '3456789012345': { name: 'Mechanical Keyboard', price: 89.99, category: 'Electronics' },
      '4567890123456': { name: 'Office Chair', price: 199.99, category: 'Furniture' },
      '5678901234567': { name: 'Desk Lamp', price: 34.75, category: 'Home' },
      '6789012345678': { name: 'Notebook Set', price: 12.99, category: 'Stationery' },
      '7890123456789': { name: 'Coffee Mug', price: 8.99, category: 'Home' },
      '8901234567890': { name: 'Water Bottle', price: 19.99, category: 'Sports' }
    };

    return products[barcode] || { 
      name: `Product ${barcode}`, 
      price: (Math.floor(Math.random() * 100) + 1),
      category: 'General'
    };
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}