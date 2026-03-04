import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class UiService {
  private platformId = inject(PLATFORM_ID);
  
  public isSidebarOpen = signal<boolean>(true);
  public isNewConversationModalOpen = signal<boolean>(false);
  public isManageAgentsModalOpen = signal<boolean>(false);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.isSidebarOpen.set(window.innerWidth > 768);
    }
  }

  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }
}
