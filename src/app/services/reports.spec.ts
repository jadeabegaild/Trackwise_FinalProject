import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReportsPage } from '/reports.page';
import { ReportsService } from '../services/reports';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('ReportsPage', () => {
  let component: ReportsPage;
  let fixture: ComponentFixture<ReportsPage>;

  beforeEach(async () => {
    const mockReportsService = {
      getOrders: jasmine.createSpy('getOrders').and.returnValue(of([])),
      getCustomers: jasmine.createSpy('getCustomers').and.returnValue(of([]))
    };

    await TestBed.configureTestingModule({
      declarations: [ReportsPage],
      providers: [
        { provide: ReportsService, useValue: mockReportsService }
      ],
      schemas: [NO_ERRORS_SCHEMA] // ✅ This ignores unknown elements/attributes
    }).compileComponents();

    fixture = TestBed.createComponent(ReportsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});