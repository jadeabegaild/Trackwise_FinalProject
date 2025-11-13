import { Component } from '@angular/core';
import { PosPage } from './pos/pos.page';
import { InventoryPage } from './inventory/inventory.page';
import { ReportsPage } from './reports/reports.page';
import { CustomerPage } from './customers/customers.page';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false
})
export class DashboardPage {
  posRoot = PosPage;
  inventoryRoot = InventoryPage;
  reportsRoot = ReportsPage;
  customerRoot = CustomerPage;

  constructor() {}
}