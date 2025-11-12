import { Injectable, inject } from '@angular/core';
import { 
  Auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  User,
  authState
} from '@angular/fire/auth';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);
  
  private user = new BehaviorSubject<User | null>(null);
  user$ = this.user.asObservable();

  constructor() {
    // Listen to authentication state changes
    authState(this.auth).subscribe(user => {
      this.user.next(user);
    });
  }

  async register(email: string, password: string, userData: any) {
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);
      // You can store additional user data in Firestore here
      return result;
    } catch (error) {
      throw error;
    }
  }

  async login(email: string, password: string) {
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  getCurrentUser() {
    return this.auth.currentUser;
  }

  // Additional helper methods
  isLoggedIn(): boolean {
    return this.auth.currentUser !== null;
  }

  getUserId(): string | null {
    return this.auth.currentUser?.uid || null;
  }

  getUserEmail(): string | null {
    return this.auth.currentUser?.email || null;
  }
}