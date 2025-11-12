import { Component } from '@angular/core';
import { PosPage } from './pos/pos.page';
import { InventoryPage } from './inventory/inventory.page';
import { ReportsPage } from './reports/reports.page';
import { CustomersPage } from './customers/customers.page';
import { MorePage } from './more/more.page';

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
  customersRoot = CustomersPage;
  moreRoot = MorePage;

  constructor() {}
}