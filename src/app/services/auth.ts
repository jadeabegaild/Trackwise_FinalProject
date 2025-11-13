import { Injectable, inject } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
  authState,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
} from '@angular/fire/auth';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';

export interface UserData {
  uid: string;
  email: string;
  businessName: string;
  phone: string;
  createdAt: Date;
  emailVerified: boolean;
  role: string;
  displayName?: string;
  photoURL?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  private user = new BehaviorSubject<User | null>(null);
  user$ = this.user.asObservable();

  constructor() {
    // Listen to authentication state changes
    authState(this.auth).subscribe(async (user) => {
      this.user.next(user);

      // If user is logged in, check if we need to update their verification status
      if (user) {
        await this.checkAndUpdateEmailVerification(user);
      }
    });
  }

  async register(email: string, password: string, userData: any) {
    try {
      const result = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      const user = result.user;

      // Store additional user data in Firestore
      const userDoc: UserData = {
        uid: user.uid,
        email: user.email!,
        businessName: userData.businessName,
        phone: userData.phone,
        createdAt: new Date(),
        emailVerified: false,
        role: 'business_owner',
      };

      await this.saveUserData(user.uid, userDoc);

      // Update user profile with business name
      await updateProfile(user, {
        displayName: userData.businessName,
      });

      // Send email verification
      await this.sendEmailVerification();

      return result;
    } catch (error) {
      throw error;
    }
  }

  async login(email: string, password: string) {
    try {
      const result = await signInWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      const user = result.user;

      // Check if email is verified - but don't block login
      if (!user.emailVerified) {
        // You can choose to:
        // Option 1: Allow login but show a warning
        console.warn('Email not verified');
        // Option 2: Throw an error to block login
        // throw new Error('EMAIL_NOT_VERIFIED');
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  async sendEmailVerification(): Promise<void> {
    const user = this.auth.currentUser;
    if (user) {
      await sendEmailVerification(user);
    } else {
      throw new Error('No user is currently logged in');
    }
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  async resendEmailVerification(): Promise<void> {
    return this.sendEmailVerification();
  }

  private async saveUserData(uid: string, userData: UserData): Promise<void> {
    const userDocRef = doc(this.firestore, 'users', uid);
    await setDoc(userDocRef, userData);
  }

  async getUserData(uid: string): Promise<UserData | null> {
    try {
      const userDocRef = doc(this.firestore, 'users', uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        return userDoc.data() as UserData;
      }
      return null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  async updateUserData(uid: string, updates: Partial<UserData>): Promise<void> {
    try {
      const userDocRef = doc(this.firestore, 'users', uid);
      await setDoc(userDocRef, updates, { merge: true });
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
  }

  private async checkAndUpdateEmailVerification(user: User): Promise<void> {
    // Refresh the user to get the latest email verification status
    await user.reload();

    // Get current user data from Firestore
    const userData = await this.getUserData(user.uid);

    if (userData && userData.emailVerified !== user.emailVerified) {
      // Update Firestore with latest verification status
      await this.updateUserData(user.uid, {
        emailVerified: user.emailVerified,
      });
    }
  }

  // Check if current user's email is verified
  isEmailVerified(): boolean {
    return this.auth.currentUser?.emailVerified || false;
  }

  // Get current user with fresh data
  async getCurrentUserWithData(): Promise<{
    user: User | null;
    userData: UserData | null;
  }> {
    const user = this.auth.currentUser;
    if (!user) {
      return { user: null, userData: null };
    }

    // Refresh user to get latest verification status
    await user.reload();
    const userData = await this.getUserData(user.uid);

    return { user, userData };
  }

  getCurrentUser(): User | null {
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

  getDisplayName(): string | null {
    return this.auth.currentUser?.displayName || null;
  }

  // Check if user has specific role
  async hasRole(role: string): Promise<boolean> {
    const user = this.auth.currentUser;
    if (!user) return false;

    const userData = await this.getUserData(user.uid);
    return userData?.role === role;
  }

  // Auth guard helper
  async canActivate(): Promise<boolean> {
    const user = this.auth.currentUser;
    if (!user) {
      this.router.navigate(['/login']);
      return false;
    }

    // Check if email is verified (optional - you can remove this if you want to allow unverified users)
    if (!user.emailVerified) {
      // You can redirect to a verification reminder page
      this.router.navigate(['/email-verification']);
      return false;
    }

    return true;
  }
}
