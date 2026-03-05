import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private platformId = inject(PLATFORM_ID);
  private app: FirebaseApp | null = null;
  public auth: Auth | null = null;

  public currentUser = signal<User | null>(null);
  public isInitialized = signal<boolean>(false);
  public isAuthEnabled = signal<boolean>(true);

  async initialize() {
    if (!isPlatformBrowser(this.platformId)) {
      this.isInitialized.set(true);
      return;
    }

    try {
      const response = await fetch('/api/firebase-config');
      const config = await response.json();

      if (!config.apiKey) {
        console.warn('Firebase config is missing. Authentication disabled.');
        this.isAuthEnabled.set(false);
        this.isInitialized.set(true);
        return;
      }

      this.app = initializeApp(config);
      this.auth = getAuth(this.app);

      this.auth.onAuthStateChanged((user) => {
        if (user && user.email && config.allowedDomainsEmails) {
          const allowedStr = config.allowedDomainsEmails.toLowerCase();
          const allowedList = allowedStr.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);

          if (allowedList.length > 0) {
            const userEmail = user.email.toLowerCase();
            const userDomain = userEmail.split('@')[1] || '';

            const isAllowed = allowedList.some((allowedItem: string) => {
              if (allowedItem.includes('@')) {
                return allowedItem === userEmail;
              } else {
                return allowedItem === userDomain;
              }
            });

            if (!isAllowed) {
              this.auth?.signOut();
              this.currentUser.set(null);
              alert(`Access denied. Your email (${userEmail}) is not on the allowlist.`);
              return;
            }
          }
        }
        this.currentUser.set(user);
      });

      this.isInitialized.set(true);
    } catch (error) {
      console.error('Failed to initialize Firebase', error);
      this.isInitialized.set(true);
    }
  }

  async loginWithGoogle() {
    if (!this.auth) return;
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(this.auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  }

  async logout() {
    if (!this.auth) return;
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error('Logout failed', error);
    }
  }
}
