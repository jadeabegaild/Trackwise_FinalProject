import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { PosPage } from './pos.page';

describe('PosPage', () => {
  let component: PosPage;
  let fixture: ComponentFixture<PosPage>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ PosPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(PosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with all products', () => {
    expect(component.filteredProducts.length).toBe(component.products.length);
  });

  it('should filter products by category', () => {
    component.filterByCategory({ detail: { value: 'electronics' } });
    expect(component.filteredProducts.every(p => p.category === 'electronics')).toBeTrue();
  });

  it('should add product to cart', () => {
    const product = component.products[0];
    component.addToCart(product);
    expect(component.cartItems.length).toBe(1);
    expect(component.cartItems[0].id).toBe(product.id);
  });

  it('should calculate correct total', () => {
    component.addToCart(component.products[0]); // $999
    component.addToCart(component.products[1]); // $1999
    const expectedSubtotal = 999 + 1999;
    const expectedTax = expectedSubtotal * 0.08;
    const expectedTotal = expectedSubtotal + expectedTax;
    
    expect(component.getSubtotal()).toBe(expectedSubtotal);
    expect(component.getTax()).toBeCloseTo(expectedTax, 2);
    expect(component.getTotal()).toBeCloseTo(expectedTotal, 2);
  });

  it('should not add out-of-stock products to cart', () => {
    const outOfStockProduct = { ...component.products[0], stock: 0 };
    component.addToCart(outOfStockProduct);
    expect(component.cartItems.length).toBe(0);
  });

  it('should update stock after checkout', () => {
    const product = component.products[0];
    const initialStock = product.stock;
    
    component.addToCart(product);
    component.addToCart(product); // Quantity 2
    component.checkout();
    
    expect(product.stock).toBe(initialStock - 2);
    expect(component.cartItems.length).toBe(0);
  });

  it('should search products correctly', () => {
    component.searchProducts({ detail: { value: 'iPhone' } });
    expect(component.filteredProducts.every(p => p.name.toLowerCase().includes('iphone'))).toBeTrue();
  });
});