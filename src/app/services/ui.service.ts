import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface TokenConsentData {
  agentName: string;
  scopes: string[];
  resolve: (consent: boolean) => void;
}

@Injectable({
  providedIn: 'root'
})
export class UiService {
  private platformId = inject(PLATFORM_ID);
  
  public isSidebarOpen = signal<boolean>(true);
  public isNewConversationModalOpen = signal<boolean>(false);
  public isManageAgentsModalOpen = signal<boolean>(false);
  public isTokenConsentModalOpen = signal<boolean>(false);
  public tokenConsentData = signal<TokenConsentData | null>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.isSidebarOpen.set(window.innerWidth > 768);
    }
  }

  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }
}
