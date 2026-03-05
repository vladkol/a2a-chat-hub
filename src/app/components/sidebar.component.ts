import { Component, inject, signal } from '@angular/core';
import { ChatService, Conversation } from '../services/chat.service';
import { FirebaseService } from '../services/firebase.service';
import { UiService } from '../services/ui.service';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [MatIconModule, CommonModule, FormsModule],
  host: {
    'class': 'md:w-90 shrink-0 block'
  },
  template: `
    <div
      class="fixed inset-y-0 left-0 z-40 w-90 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full text-zinc-900 dark:text-zinc-100 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0"
      [class.-translate-x-full]="!ui.isSidebarOpen()"
      [class.translate-x-0]="ui.isSidebarOpen()">

      <div class="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h2 class="font-sans font-semibold tracking-tight text-lg">Conversations</h2>
        <button (click)="ui.isNewConversationModalOpen.set(true)" class="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors" title="New Conversation">
          <mat-icon>add</mat-icon>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        @for (conv of chat.conversations(); track conv.id) {
          <div
            (click)="selectConversation(conv)"
            (keydown.enter)="selectConversation(conv)"
            tabindex="0"
            [class.bg-zinc-100]="chat.currentConversation()?.id === conv.id"
            [class.dark:bg-zinc-800]="chat.currentConversation()?.id === conv.id"
            class="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/80 cursor-pointer transition-colors group focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <div class="flex items-center space-x-3 overflow-hidden flex-1">
              <div class="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <mat-icon>chat_bubble</mat-icon>
              </div>
              <div class="truncate flex-1">
                @if (editingConvId() === conv.id) {
                  <input
                    [id]="'edit-conv-' + conv.id"
                    [(ngModel)]="editConvTitle"
                    (keydown.enter)="saveTitle(conv.id, $event)"
                    (keydown.escape)="cancelEdit($event)"
                    (click)="$event.stopPropagation()"
                    (blur)="saveTitle(conv.id, $event)"
                    class="w-full bg-white dark:bg-zinc-950 border border-indigo-500 rounded px-1 py-0.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                } @else {
                  <div class="font-medium text-sm truncate text-zinc-900 dark:text-zinc-100">{{ conv.title }}</div>
                  <div class="text-xs text-zinc-500 font-mono truncate">{{ getAgentName(conv.agentId) }}</div>
                }
              </div>
            </div>

            <div class="opacity-0 group-hover:opacity-100 flex items-center shrink-0 transition-opacity ml-2">
              <button
                (click)="startEdit(conv, $event)"
                class="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                title="Rename">
                <mat-icon class="text-[18px] w-[18px] h-[18px]">edit</mat-icon>
              </button>
              <button
                (click)="deleteConversation(conv.id, $event)"
                class="p-1.5 rounded-lg transition-colors"
                [class]="confirmDeleteConvId() === conv.id ? 'bg-red-50 text-red-600 dark:bg-red-500/20 dark:text-red-500 hover:bg-red-100 dark:hover:bg-red-500/30' : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-red-600 dark:hover:text-red-400'"
                [title]="confirmDeleteConvId() === conv.id ? 'Click again to confirm' : 'Delete'">
                <mat-icon class="text-[18px] w-[18px] h-[18px]">{{ confirmDeleteConvId() === conv.id ? 'warning' : 'delete' }}</mat-icon>
              </button>
            </div>
          </div>
        }
        @if (chat.conversations().length === 0) {
          <div class="text-center p-8 text-zinc-500 text-sm">
            No conversations yet.<br>Click the + button to start one.
          </div>
        }
      </div>

      <div class="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col gap-2">
        <div class="flex flex-col gap-2">
          <button
            (click)="ui.isManageAgentsModalOpen.set(true)"
            class="w-full flex items-center justify-center space-x-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg py-2 text-sm font-medium transition-colors">
            <mat-icon class="text-[18px] w-[18px] h-[18px]">manage_accounts</mat-icon>
            <span>Agents</span>
          </button>
        </div>

        @if (firebase.isAuthEnabled()) {
          <div class="flex items-center justify-between mt-2">
            <div class="flex items-center space-x-3 overflow-hidden">
              <img [src]="firebase.currentUser()?.photoURL || 'https://picsum.photos/seed/user/40/40'"
                   alt="User"
                   class="w-8 h-8 rounded-full shrink-0"
                   referrerpolicy="no-referrer">
              <div class="truncate text-sm text-zinc-700 dark:text-zinc-300">
                {{ firebase.currentUser()?.displayName || 'User' }}
              </div>
            </div>
            <button (click)="firebase.logout()" class="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors" title="Sign out">
              <mat-icon class="text-[20px] w-[20px] h-[20px]">logout</mat-icon>
            </button>
          </div>
        }
      </div>
    </div>

    <!-- Mobile overlay -->
    @if (ui.isSidebarOpen()) {
      <div
        (click)="ui.isSidebarOpen.set(false)"
        (keydown.enter)="ui.isSidebarOpen.set(false)"
        tabindex="0"
        role="button"
        class="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm transition-opacity">
      </div>
    }
  `
})
export class SidebarComponent {
  chat = inject(ChatService);
  firebase = inject(FirebaseService);
  ui = inject(UiService);

  editingConvId = signal<string | null>(null);
  editConvTitle = signal('');
  confirmDeleteConvId = signal<string | null>(null);

  getAgentName(agentId: string): string {
    const agent = this.chat.agents().find(a => a.id === agentId);
    return agent ? agent.name : 'Unknown Agent';
  }

  selectConversation(conv: Conversation) {
    if (this.editingConvId() === conv.id) return;
    this.chat.selectConversation(conv);
    if (window.innerWidth <= 768) {
      this.ui.isSidebarOpen.set(false);
    }
  }

  startEdit(conv: Conversation, event: Event) {
    event.stopPropagation();
    this.editingConvId.set(conv.id);
    this.editConvTitle.set(conv.title);
    setTimeout(() => {
      const input = document.getElementById(`edit-conv-${conv.id}`);
      if (input) input.focus();
    });
  }

  saveTitle(id: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const newTitle = this.editConvTitle().trim();
    if (newTitle) {
      this.chat.renameConversation(id, newTitle);
    }
    this.editingConvId.set(null);
  }

  cancelEdit(event: Event) {
    event.stopPropagation();
    this.editingConvId.set(null);
  }

  deleteConversation(id: string, event: Event) {
    event.stopPropagation();
    if (this.confirmDeleteConvId() === id) {
      this.chat.deleteConversation(id);
      this.confirmDeleteConvId.set(null);
    } else {
      this.confirmDeleteConvId.set(id);
      setTimeout(() => {
        if (this.confirmDeleteConvId() === id) {
          this.confirmDeleteConvId.set(null);
        }
      }, 3000);
    }
  }

}
