// src/app/report/report.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { ReportsPageRoutingModule } from './reports-routing.module';
import { ReportsPage } from './reports.page';

// ✅ Only import the Firestore module (not the initialization)
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReportsPageRoutingModule,
    AngularFirestoreModule, // Just import the module
  ],
  declarations: [ReportsPage],
})
export class ReportPageModule {}