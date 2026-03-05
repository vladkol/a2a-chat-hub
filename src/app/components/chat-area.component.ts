import { Component, inject, signal, ViewChild, ElementRef, effect, viewChild } from '@angular/core';
import { ChatService } from '../services/chat.service';
import { UiService } from '../services/ui.service';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MarkdownPipe } from '../pipes/markdown.pipe';
import { CommonModule } from '@angular/common';
import { Surface } from '@a2ui/angular';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-chat-area',
  standalone: true,
  imports: [MatIconModule, FormsModule, MarkdownPipe, CommonModule, Surface],
  host: {
    'class': 'flex-1 flex flex-col min-w-0'
  },
  template: `
    <div class="flex-1 flex flex-col bg-white dark:bg-zinc-950 h-full text-zinc-900 dark:text-zinc-100 relative min-w-0">
      @if (chat.currentConversation()) {
        <div class="h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 md:px-6 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10 shrink-0">
          <div class="flex items-center space-x-3 w-full">
            <button
              (click)="ui.toggleSidebar()"
              class="md:hidden p-2 -ml-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 transition-colors shrink-0">
              <mat-icon>menu</mat-icon>
            </button>
            <div class="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <mat-icon>smart_toy</mat-icon>
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="font-sans font-semibold tracking-tight truncate">{{ chat.currentConversation()?.title }}</h2>
              <div class="text-xs text-zinc-500 font-mono truncate">{{ getAgentDescription() }}</div>
            </div>
            <button
              (click)="cycleTheme()"
              class="p-2 -mr-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 transition-colors shrink-0 flex items-center justify-center cursor-pointer"
              [title]="'Theme: ' + theme.currentTheme()">
              <mat-icon>{{ getThemeIcon() }}</mat-icon>
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4 md:p-6 space-y-6" #scrollContainer>
          @for (msg of chat.messages()[chat.currentConversation()!.id] || []; track msg.id) {
            @if (msg.content || msg.artifacts?.length) {
              <div [class]="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
                <div class="max-w-[95%] md:max-w-[85%] flex space-x-3" [class.flex-row-reverse]="msg.role === 'user'">

                  @if (msg.role === 'agent') {
                    <div class="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-1">
                      <mat-icon class="text-[18px] w-[18px] h-[18px]">smart_toy</mat-icon>
                    </div>
                  }

                  <div [class]="msg.role === 'user' ? 'mr-3 items-end' : 'ml-3 items-start'" class="flex flex-col flex-1 min-w-0">
                    @if (msg.content) {
                      <div
                        [class]="msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm self-end max-w-full'
                          : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm w-full md:w-auto'">
                        <div class="font-sans text-[15px] leading-relaxed markdown-content" [innerHTML]="msg.content | markdown"></div>
                      </div>
                    }

                    @for (art of msg.artifacts || []; track art.id) {
                      <div class="mt-3 w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm text-zinc-900 dark:text-zinc-200 overflow-hidden">
                        <div class="bg-zinc-50 dark:bg-zinc-900 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center space-x-2">
                          <mat-icon class="text-zinc-400 text-[18px] w-[18px] h-[18px]">insert_drive_file</mat-icon>
                          <div class="flex-1 min-w-0">
                            <div class="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 truncate">{{ art.name || 'Artifact' }}</div>
                            @if (art.description) {
                              <div class="text-[11px] text-zinc-500 truncate">{{ art.description }}</div>
                            }
                          </div>
                        </div>
                        <div class="p-3 md:p-4 text-[14px] overflow-x-auto">
                          <div class="markdown-content" [innerHTML]="art.content | markdown"></div>
                        </div>
                      </div>
                    }
                    <div class="text-[11px] text-zinc-500 mt-1.5 font-mono px-1 flex-shrink-0" [class.self-end]="msg.role === 'user'">
                      {{ msg.timestamp | date:'shortTime' }}
                    </div>
                  </div>

                </div>
              </div>
            }
          }

          <!-- A2UI Surfaces -->
          <div class="a2ui-surfaces-container mt-4 space-y-4">
            @for (entry of chat.processor.getSurfaces(); track entry[0]) {
              <a2ui-surface [surfaceId]="entry[0]" [surface]="entry[1]"/>
            }
          </div>

          @if (chat.isTyping()[chat.currentConversation()!.id]) {
            <div class="flex justify-start" #mainThinkingBubble>
              <div class="max-w-[90%] md:max-w-[80%] flex space-x-3">
                <div class="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-1">
                  <mat-icon class="text-[18px] w-[18px] h-[18px]">smart_toy</mat-icon>
                </div>
                <div class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center space-x-1.5">
                  <div class="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                  <div class="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                  <div class="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                </div>
              </div>
            </div>
          }
        </div>

        <div class="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          <div class="max-w-4xl mx-auto flex flex-col gap-2">
            @if (attachments().length > 0) {
              <div class="flex flex-wrap gap-2 px-2">
                @for (file of attachments(); track $index) {
                  <div class="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-sm text-zinc-700 dark:text-zinc-300">
                    <mat-icon class="text-[16px] w-[16px] h-[16px] text-zinc-500">attach_file</mat-icon>
                    <span class="truncate max-w-[200px]">{{ file.name }}</span>
                    <button (click)="removeAttachment($index)" class="flex items-center justify-center p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full text-zinc-500 transition-colors cursor-pointer">
                      <mat-icon class="text-[14px] w-[14px] h-[14px]">close</mat-icon>
                    </button>
                  </div>
                }
              </div>
            }
            <div class="relative flex items-end gap-3 w-full">
              @if (chat.isTyping()[chat.currentConversation()!.id] && !isMainBubbleVisible()) {
                 <div class="mb-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm flex items-center space-x-1.5 shrink-0">
                    <div class="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                    <div class="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                    <div class="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                 </div>
              }

              <input type="file" multiple class="hidden" #fileInput (change)="onFilesSelected($event)">
              <button
                (click)="fileInput.click()"
                class="absolute left-2 bottom-2 p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center justify-center cursor-pointer z-10 w-9 h-9">
                <mat-icon class="text-[20px] w-[20px] h-[20px]">attach_file</mat-icon>
              </button>

              <textarea
                [(ngModel)]="newMessage"
                (keydown.enter)="handleEnter($event)"
                placeholder="Message..."
                class="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-12 pr-12 py-3 text-[15px] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none min-h-[52px] max-h-32 shadow-sm transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                rows="1"
                #messageInput
              ></textarea>
              <button
                (click)="sendMessage()"
                [disabled]="(!newMessage().trim() && attachments().length === 0) || chat.isTyping()[chat.currentConversation()!.id]"
                class="absolute right-2 bottom-2 p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 text-white rounded-lg transition-colors flex items-center justify-center z-10 w-9 h-9 cursor-pointer">
                <mat-icon class="text-[20px] w-[20px] h-[20px]">send</mat-icon>
              </button>
            </div>
          </div>
          <div class="text-center mt-2 text-[11px] text-zinc-500 font-mono">
            A2A Protocol &bull; A2UI Supported
          </div>
        </div>
      } @else {
        <div class="flex-1 flex flex-col items-center justify-center text-zinc-500 p-4 text-center">
          <button
            (click)="ui.toggleSidebar()"
            class="md:hidden absolute top-4 left-4 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
            <mat-icon>menu</mat-icon>
          </button>
          <button
            (click)="cycleTheme()"
            class="absolute top-4 right-4 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors flex items-center justify-center cursor-pointer"
            [title]="'Theme: ' + theme.currentTheme()">
            <mat-icon>{{ getThemeIcon() }}</mat-icon>
          </button>
          <mat-icon class="text-6xl mb-4 opacity-20" style="width: 64px; height: 64px; font-size: 64px;">forum</mat-icon>
          <h3 class="text-xl font-sans font-medium text-zinc-400 mb-2">No Conversation Selected</h3>
          <p class="text-sm">Select a conversation from the sidebar or start a new one.</p>
          <button
            (click)="ui.isNewConversationModalOpen.set(true)"
            class="mt-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-colors flex items-center">
            <mat-icon class="mr-2 text-[20px] w-[20px] h-[20px]">add</mat-icon>
            New Conversation
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    /* A2UI Global Styles for injected HTML */
    ::ng-deep .a2ui-container {
      font-family: var(--font-sans);
    }
    ::ng-deep .a2ui-container button {
      background: #4f46e5;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-weight: 500;
      transition: background 0.2s;
    }
    ::ng-deep .a2ui-container button:hover {
      background: #4338ca;
    }
    ::ng-deep .a2ui-container input {
      background: #18181b;
      border: 1px solid #3f3f46;
      padding: 0.5rem;
      border-radius: 0.5rem;
      color: white;
    }

    /* Markdown Styles */
    ::ng-deep .markdown-content p {
      margin-bottom: 0.375rem;
    }
    ::ng-deep .markdown-content p:last-child {
      margin-bottom: 0;
    }
    ::ng-deep .markdown-content a {
      color: #818cf8;
      text-decoration: underline;
    }
    ::ng-deep .markdown-content code {
      background: rgba(0,0,0,0.2);
      padding: 0.2rem 0.4rem;
      border-radius: 0.25rem;
      font-family: var(--font-mono);
      font-size: 0.85em;
    }
    ::ng-deep .markdown-content pre {
      background: rgba(0,0,0,0.3);
      padding: 1rem;
      border-radius: 0.5rem;
      overflow-x: auto;
      margin-top: 0.5rem;
      margin-bottom: 0.75rem;
    }
    ::ng-deep .markdown-content pre code {
      background: transparent;
      padding: 0;
    }
    ::ng-deep .markdown-content ul {
      list-style-type: disc;
      padding-left: 1.5rem;
      margin-bottom: 0.75rem;
    }
    ::ng-deep .markdown-content ol {
      list-style-type: decimal;
      padding-left: 1.5rem;
      margin-bottom: 0.75rem;
    }
    ::ng-deep .markdown-content h1,
    ::ng-deep .markdown-content h2,
    ::ng-deep .markdown-content h3 {
      font-weight: 600;
      margin-top: 1rem;
      margin-bottom: 0.5rem;
    }

    /* A2UI Surface Constraints */
    ::ng-deep a2ui-surface {
      display: block;
      width: 30%;
      min-width: 480px;
      max-width: 1280px;
    }
  `]
})
export class ChatAreaComponent {
  chat = inject(ChatService);
  ui = inject(UiService);
  theme = inject(ThemeService);
  newMessage = signal('');
  attachments = signal<File[]>([]);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  getAgentDescription(): string {
    const conv = this.chat.currentConversation();
    if (!conv) return '';
    const agent = this.chat.agents().find(a => a.id === conv.agentId);
    if (!agent) return '';
    return agent.description || agent.address;
  }

  getThemeIcon(): string {
    switch (this.theme.currentTheme()) {
      case 'light': return 'light_mode';
      case 'dark': return 'dark_mode';
      case 'system': return 'brightness_auto';
    }
  }

  cycleTheme() {
    const current = this.theme.currentTheme();
    if (current === 'system') this.theme.setTheme('light');
    else if (current === 'light') this.theme.setTheme('dark');
    else this.theme.setTheme('system');
  }

  isMainBubbleVisible = signal(true);
  mainThinkingBubble = viewChild<ElementRef>('mainThinkingBubble');

  constructor() {
    effect(() => {
      // Track content changes: conversation switch or messages update
      const conv = this.chat.currentConversation();
      const allMsgs = this.chat.messages();

      // If we have an active conversation, schedule a scroll
      if (conv) {
        // Use setTimeout to ensure the view has been updated (e.g. streaming content rendered)
        // 100ms delay helps ensure images/heavy content have started layout
        setTimeout(() => this.scrollToBottom(), 100);
      }
    });

    effect((onCleanup) => {
      const bubbleRef = this.mainThinkingBubble();
      if (!bubbleRef) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          this.isMainBubbleVisible.set(entry.isIntersecting);
        });
      }, { threshold: 0.1 });

      observer.observe(bubbleRef.nativeElement);

      onCleanup(() => {
        observer.disconnect();
      });
    });
  }

  private scrollToBottom(): void {
    if (this.scrollContainer) {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    }
  }

  handleEnter(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage() {
    const content = this.newMessage().trim();
    const files = this.attachments();
    const conv = this.chat.currentConversation();
    if ((content || files.length > 0) && conv && !this.chat.isTyping()[conv.id]) {
      this.chat.sendMessage(content, files);
      this.newMessage.set('');
      this.attachments.set([]);
    }
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      this.attachments.update(files => [...files, ...newFiles]);
      input.value = ''; // Reset input to allow selecting same file again
    }
  }

  removeAttachment(index: number) {
    this.attachments.update(files => files.filter((_, i) => i !== index));
  }
}
