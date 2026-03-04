import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ChatService, Agent } from '../services/chat.service';
import { UiService } from '../services/ui.service';

@Component({
  selector: 'app-new-conversation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    @if (ui.isNewConversationModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
          <div class="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
            <h2 class="font-sans font-semibold text-lg text-zinc-100">New Conversation</h2>
            <button (click)="ui.isNewConversationModalOpen.set(false)" class="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="p-4 flex-1 overflow-y-auto">
            <h3 class="text-sm font-medium text-zinc-400 mb-3 uppercase tracking-wider">Select an Agent</h3>

            <div class="space-y-2">
              @for (agent of chat.agents(); track agent.id) {
                <button
                  (click)="startConversation(agent)"
                  class="w-full flex items-center space-x-3 p-3 rounded-xl hover:bg-zinc-800 transition-colors text-left group">
                  <div class="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <mat-icon>smart_toy</mat-icon>
                  </div>
                  <div class="flex-1 overflow-hidden">
                    <div class="font-medium text-zinc-100 truncate">{{ agent.name }}</div>
                    <div class="text-xs text-zinc-500 font-mono truncate">{{ agent.description || agent.address }}</div>
                  </div>
                  <mat-icon class="text-zinc-600 group-hover:text-indigo-400 transition-colors">chevron_right</mat-icon>
                </button>
              }

              @if (chat.agents().length === 0) {
                <div class="text-center p-6 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                  No agents available.<br>Add an agent below to start.
                </div>
              }
            </div>

            <div class="mt-6 pt-6 border-t border-zinc-800">
              <h3 class="text-sm font-medium text-zinc-400 mb-3 uppercase tracking-wider">Add New Agent</h3>
              <div class="flex space-x-2">
                <input
                  [(ngModel)]="newAgentAddress"
                  placeholder="Agent Address (URL)"
                  class="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                  (keydown.enter)="addAgent()"
                />
                <button
                  (click)="addAgent()"
                  [disabled]="!newAgentAddress() || isAdding()"
                  class="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center">
                  @if (isAdding()) {
                    <mat-icon class="animate-spin text-[18px] w-[18px] h-[18px] mr-1">refresh</mat-icon>
                  } @else {
                    <mat-icon class="text-[18px] w-[18px] h-[18px] mr-1">add</mat-icon>
                  }
                  Add
                </button>
              </div>
              @if (errorMessage()) {
                <div class="mt-2 text-sm text-red-400">{{ errorMessage() }}</div>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class NewConversationModalComponent {
  ui = inject(UiService);
  chat = inject(ChatService);

  newAgentAddress = signal('');
  isAdding = signal(false);
  errorMessage = signal('');

  startConversation(agent: Agent) {
    this.chat.createConversation(agent.id);
    this.ui.isNewConversationModalOpen.set(false);
    if (window.innerWidth <= 768) {
      this.ui.isSidebarOpen.set(false);
    }
  }

  async addAgent() {
    if (this.newAgentAddress()) {
      this.isAdding.set(true);
      this.errorMessage.set('');
      try {
        const agent = await this.chat.addAgent(this.newAgentAddress());
        this.newAgentAddress.set('');
        // Automatically start conversation with newly added agent
        this.startConversation(agent);
      } catch {
        this.errorMessage.set('Failed to add agent. Please check the address and ensure the agent card is accessible.');
      } finally {
        this.isAdding.set(false);
      }
    }
  }
}

@Component({
  selector: 'app-manage-agents-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    @if (ui.isManageAgentsModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
          <div class="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
            <h2 class="font-sans font-semibold text-lg text-zinc-100">Manage Agents</h2>
            <button (click)="ui.isManageAgentsModalOpen.set(false)" class="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="p-4 flex-1 overflow-y-auto">
            <div class="mb-6">
              <h3 class="text-sm font-medium text-zinc-400 mb-3 uppercase tracking-wider">Add New Agent</h3>
              <div class="flex space-x-2">
                <input
                  [(ngModel)]="newAgentAddress"
                  placeholder="Agent Address (URL)"
                  class="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                  (keydown.enter)="addAgent()"
                />
                <button
                  (click)="addAgent()"
                  [disabled]="!newAgentAddress() || isAdding()"
                  class="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center">
                  @if (isAdding()) {
                    <mat-icon class="animate-spin text-[18px] w-[18px] h-[18px] mr-1">refresh</mat-icon>
                  } @else {
                    <mat-icon class="text-[18px] w-[18px] h-[18px] mr-1">add</mat-icon>
                  }
                  Add
                </button>
              </div>
              @if (errorMessage()) {
                <div class="mt-2 text-sm text-red-400">{{ errorMessage() }}</div>
              }
            </div>

            <h3 class="text-sm font-medium text-zinc-400 mb-3 uppercase tracking-wider">Your Agents</h3>

            <div class="space-y-2">
              @for (agent of chat.agents(); track agent.id) {
                <div class="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 border border-zinc-800">
                  <div class="flex items-center space-x-3 overflow-hidden">
                    <div class="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                      <mat-icon>smart_toy</mat-icon>
                    </div>
                    <div class="truncate">
                      <div class="font-medium text-zinc-100 truncate">{{ agent.name }}</div>
                      <div class="text-xs text-zinc-500 font-mono truncate">{{ agent.address }}</div>
                    </div>
                  </div>
                  <button
                    (click)="deleteAgent(agent)"
                    class="p-2 rounded-lg transition-colors shrink-0 ml-2"
                    [class]="confirmDeleteAgentId() === agent.id ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'hover:bg-red-500/20 text-zinc-400 hover:text-red-400'"
                    [title]="confirmDeleteAgentId() === agent.id ? 'Click again to confirm deletion (Warning: deletes all chats)' : 'Delete Agent'">
                    <mat-icon>{{ confirmDeleteAgentId() === agent.id ? 'warning' : 'delete' }}</mat-icon>
                  </button>
                </div>
              }

              @if (chat.agents().length === 0) {
                <div class="text-center p-8 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                  No agents added yet.
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class ManageAgentsModalComponent {
  ui = inject(UiService);
  chat = inject(ChatService);

  newAgentAddress = signal('');
  isAdding = signal(false);
  errorMessage = signal('');
  confirmDeleteAgentId = signal<string | null>(null);

  async addAgent() {
    if (this.newAgentAddress()) {
      this.isAdding.set(true);
      this.errorMessage.set('');
      try {
        await this.chat.addAgent(this.newAgentAddress());
        this.newAgentAddress.set('');
      } catch {
        this.errorMessage.set('Failed to add agent. Please check the address and ensure the agent card is accessible.');
      } finally {
        this.isAdding.set(false);
      }
    }
  }

  deleteAgent(agent: Agent) {
    if (this.confirmDeleteAgentId() === agent.id) {
      this.chat.removeAgent(agent.id);
      this.confirmDeleteAgentId.set(null);
    } else {
      this.confirmDeleteAgentId.set(agent.id);
      setTimeout(() => {
        if (this.confirmDeleteAgentId() === agent.id) {
          this.confirmDeleteAgentId.set(null);
        }
      }, 3000);
    }
  }
}
