import { Component, inject } from '@angular/core';
import { FirebaseService } from '../services/firebase.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
      <div class="bg-zinc-900 p-8 rounded-2xl shadow-xl w-full max-w-md border border-zinc-800 text-center">
        <mat-icon class="text-6xl text-indigo-500 mb-6" style="width: 64px; height: 64px; font-size: 64px;">chat</mat-icon>
        <h1 class="text-3xl font-sans font-semibold mb-2 tracking-tight">A2A Chat Client</h1>
        <p class="text-zinc-400 mb-8">Connect with AI agents via their address.</p>
        
        @if (!firebase.isInitialized()) {
          <div class="flex justify-center items-center space-x-2 text-zinc-400">
            <mat-icon class="animate-spin">sync</mat-icon>
            <span>Initializing Firebase...</span>
          </div>
        } @else {
          <button 
            (click)="firebase.loginWithGoogle()"
            class="w-full flex items-center justify-center space-x-3 bg-white text-zinc-900 py-3 px-4 rounded-xl font-medium hover:bg-zinc-200 transition-colors">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="w-6 h-6" referrerpolicy="no-referrer">
            <span>Sign in with Google</span>
          </button>
        }
      </div>
    </div>
  `
})
export class LoginComponent {
  firebase = inject(FirebaseService);
}
