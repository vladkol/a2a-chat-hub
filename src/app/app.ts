import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { LoginComponent } from './components/login.component';
import { SidebarComponent } from './components/sidebar.component';
import { ChatAreaComponent } from './components/chat-area.component';
import { NewConversationModalComponent, ManageAgentsModalComponent } from './components/modals.component';
import { FirebaseService } from './services/firebase.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [LoginComponent, SidebarComponent, ChatAreaComponent, NewConversationModalComponent, ManageAgentsModalComponent],
  template: `
    @if (!firebase.isAuthEnabled() || firebase.currentUser()) {
      <div class="flex h-[100dvh] w-full overflow-hidden bg-zinc-950 font-sans relative">
        <app-sidebar></app-sidebar>
        <app-chat-area></app-chat-area>
        <app-new-conversation-modal></app-new-conversation-modal>
        <app-manage-agents-modal></app-manage-agents-modal>
      </div>
    } @else {
      <app-login></app-login>
    }
  `,
  styles: [`
    :host {
      display: block;
      height: 100dvh;
      width: 100vw;
    }
  `]
})
export class App implements OnInit {
  firebase = inject(FirebaseService);

  ngOnInit() {
    this.firebase.initialize();
  }
}
