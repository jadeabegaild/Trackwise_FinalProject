import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  loginForm: FormGroup;
  showPassword: boolean = false;

  private authService = inject(AuthService);
  private router = inject(Router);
  private loadingController = inject(LoadingController);
  private alertController = inject(AlertController);
  private fb = inject(FormBuilder);

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  ngOnInit() {}

  async login() {
    if (this.loginForm.valid) {
      const loading = await this.loadingController.create({
        message: 'Logging in...',
        spinner: 'crescent',
      });
      await loading.present();

      try {
        const { email, password } = this.loginForm.value;
        await this.authService.login(email, password);

        await loading.dismiss();

  
        this.router.navigate(['/dashboard/pos']);
      } catch (error: any) {
        await loading.dismiss();


        let errorMessage = 'Login failed. Please try again.';
        let showResendButton = false;

        switch (error.code) {
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address.';
            break;
          case 'auth/user-not-found':
            errorMessage =
              'No account found with this email. Please register first.';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Incorrect password. Please try again.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many failed attempts. Please try again later.';
            break;
          case 'auth/user-disabled':
            errorMessage =
              'This account has been disabled. Please contact support.';
            break;
          case 'EMAIL_NOT_VERIFIED': 
            errorMessage =
              'Please verify your email address before logging in. Check your inbox for the verification email.';
            showResendButton = true;
            break;
          default:
            errorMessage = error.message || errorMessage;
        }

        const buttons: any[] = ['OK'];

        if (showResendButton) {
          buttons.push({
            text: 'Resend Verification',
            handler: () => {
              this.resendVerificationEmail();
            },
          });
        }

        const alert = await this.alertController.create({
          header: 'Login Failed',
          message: errorMessage,
          buttons: buttons,
        });
        await alert.present();
      }
    } else {
      Object.keys(this.loginForm.controls).forEach((key) => {
        this.loginForm.get(key)?.markAsTouched();
      });
    }
  }

  async resendVerificationEmail() {
    const loading = await this.loadingController.create({
      message: 'Sending verification email...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      const email = this.loginForm.get('email')?.value;
      if (!email) {
        throw new Error('Email is required');
      }
      await this.authService.resendEmailVerification();

      await loading.dismiss();

      const alert = await this.alertController.create({
        header: 'Verification Email Sent',
        message: `A new verification email has been sent to ${email}. Please check your inbox and spam folder.`,
        buttons: ['OK'],
      });
      await alert.present();
    } catch (error) {
      await loading.dismiss();

      const alert = await this.alertController.create({
        header: 'Error',
        message: 'Failed to send verification email. Please try again.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }
  async forgotPassword() {
    const alert = await this.alertController.create({
      header: 'Reset Password',
      message: 'Enter your email address to receive a password reset link:',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Email address',
          value: this.loginForm.get('email')?.value,
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Send Reset Link',
          handler: async (data) => {
            if (data.email) {
              await this.sendPasswordResetEmail(data.email);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async sendPasswordResetEmail(email: string) {
    const loading = await this.loadingController.create({
      message: 'Sending reset link...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      await this.authService.sendPasswordResetEmail(email);
      await loading.dismiss();

      const alert = await this.alertController.create({
        header: 'Reset Link Sent',
        message: `Password reset instructions have been sent to ${email}. Please check your inbox.`,
        buttons: ['OK'],
      });
      await alert.present();
    } catch (error) {
      await loading.dismiss();

      const alert = await this.alertController.create({
        header: 'Error',
        message:
          'Failed to send reset link. Please check the email address and try again.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  get email() {
    return this.loginForm.get('email');
  }
  get password() {
    return this.loginForm.get('password');
  }
}
