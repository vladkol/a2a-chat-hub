
import { Component, signal, viewChild, ElementRef, effect, inject } from '@angular/core';
import { DynamicComponent } from '@a2ui/angular';
import { Types } from '@a2ui/lit/0.8';
import { Renderer } from '@a2ui/angular';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-custom-modal',
  standalone: true,
  imports: [Renderer],
  template: `
    @if (showDialog()) {
      <dialog #dialog [class.dark]="isDark()" (click)="handleDialogClick($event)">
        <section>
          <div class="controls">
            <button (click)="closeDialog()">
              <span class="material-icons">close</span>
            </button>
          </div>

          <ng-container
            a2ui-renderer
            [surfaceId]="surfaceId()!"
            [component]="component().properties.contentChild"
          />
        </section>
      </dialog>
    } @else {
      <!-- capture: true to ensure we catch the click? No, (click) bubbles. -->
      <section (click)="openDialog($event)" class="modal-entry-point">
        <ng-container
          a2ui-renderer
          [surfaceId]="surfaceId()!"
          [component]="component().properties.entryPointChild"
        />
      </section>
    }
  `,
  styles: `
    dialog {
      padding: 0;
      border: none;
      background: none;
      margin: auto;
      max-width: 90vw;
      max-height: 90vh;
      overflow: visible;

      &::backdrop {
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }

      & section {
        min-width: 320px;
        min-height: 200px;
        background: white;
        border: 1px solid #e4e4e7;
        border-radius: 12px;
        color: #18181b;
        padding: 24px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        transition: all 0.3s ease;

        & .controls {
          display: flex;
          justify-content: end;
          margin-bottom: 16px;

          & button {
            padding: 4px;
            background: none;
            width: 28px;
            height: 28px;
            border: none;
            cursor: pointer;
            color: #71717a;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;

            &:hover {
              color: #18181b;
              background: #f4f4f5;
            }
          }
        }
      }
    }

    /* Dark mode overrides */
    :host-context(.dark) section,
    dialog.dark section {
      background-color: #18181b;
      color: #f4f4f5;
      border-color: #27272a;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    }

    :host-context(.dark) .controls button,
    dialog.dark .controls button {
      color: #a1a1aa;
    }

    :host-context(.dark) .controls button:hover,
    dialog.dark .controls button:hover {
      background-color: #27272a;
      color: #f4f4f5;
    }

    .modal-entry-point {
      display: contents;
      cursor: pointer;
    }
  `,
})
export class CustomModal extends DynamicComponent<Types.ModalNode> {
  protected readonly showDialog = signal(false);
  protected readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly themeService = inject(ThemeService);
  protected readonly isDark = signal(false);

  constructor() {
    super();

    effect(() => {
      const t = this.themeService.currentTheme();
      if (t === 'dark') {
        this.isDark.set(true);
      } else if (t === 'light') {
        this.isDark.set(false);
      } else {
        this.isDark.set(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    });

    effect(() => {
      const dialog = this.dialog();
      const show = this.showDialog();

      if (dialog && show && !dialog.nativeElement.open) {
        try {
          dialog.nativeElement.showModal();
        } catch (e) {
          console.error('CustomModal: failed to show modal', e);
        }
      }
    });
  }

  openDialog(event: MouseEvent) {
    this.showDialog.set(true);
  }

  protected handleDialogClick(event: MouseEvent) {
    if (event.target instanceof HTMLDialogElement) {
      this.closeDialog();
    }
  }

  protected closeDialog() {
    const dialog = this.dialog();

    if (!dialog) {
      return;
    }

    if (dialog.nativeElement.open) {
      dialog.nativeElement.close();
    }

    this.showDialog.set(false);
  }
}
