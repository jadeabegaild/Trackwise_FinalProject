import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false
})
export class RegisterPage implements OnInit {
  registerForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      businessName: ['', [Validators.required]],
      phone: ['', [Validators.required]]
    }, { validator: this.passwordMatchValidator });
  }

  ngOnInit() {}

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { 'mismatch': true };
  }

  async register() {
    if (this.registerForm.valid) {
      const loading = await this.loadingController.create({
        message: 'Creating account...'
      });
      await loading.present();

      try {
        const { email, password, businessName, phone } = this.registerForm.value;
        await this.authService.register(email, password, {
          businessName,
          phone,
          createdAt: new Date()
        });
        
        await loading.dismiss();
        this.router.navigate(['/dashboard']);
      } catch (error: any) {
        await loading.dismiss();
        const alert = await this.alertController.create({
          header: 'Registration failed',
          message: error.message,
          buttons: ['OK']
        });
        await alert.present();
      }
    }
  }
}