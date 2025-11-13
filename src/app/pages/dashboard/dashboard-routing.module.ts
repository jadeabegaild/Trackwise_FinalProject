import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardPage } from './dashboard.page';

const routes: Routes = [
  {
    path: '',
    component: DashboardPage,
    children: [
      {
        path: 'customers',
        loadChildren: () => import('./customers/customers.module').then(m => m.CustomersPageModule)
      },
      {
        path: 'pos',
        loadChildren: () => import('./pos/pos.module').then(m => m.PosPageModule)
      },
      {
        path: 'inventory',
        loadChildren: () => import('./inventory/inventory.module').then(m => m.InventoryPageModule)
      },
      {
        path: 'reports',
        loadChildren: () => import('./reports/reports.module').then(m => m.ReportPageModule)
      },
      
      {
        path: '',
        redirectTo: 'customers',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DashboardPageRoutingModule {}