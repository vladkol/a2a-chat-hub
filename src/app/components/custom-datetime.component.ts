import { Component, input, computed, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicComponent, Renderer } from '@a2ui/angular';

@Component({
  selector: 'app-custom-datetime',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section [class]="theme.components.DateTimeInput.container">
      <label [for]="inputId" [class]="theme.components.DateTimeInput.label" (click)="focusInput()">{{ label() }}</label>

      <input
        #dateInput
        autocomplete="off"
        [attr.type]="inputType()"
        [id]="inputId"
        [class]="theme.components.DateTimeInput.element"
        [style]="theme.additionalStyles?.DateTimeInput"
        [step]="step()"
        [value]="inputValue()"
        (input)="handleInput($event)"
        (click)="handleClick($event)"
      />
    </section>
  `,
  styles: [`
    :host {
      display: block;
      flex: var(--weight);
      min-height: 0;
      overflow: auto;
    }
    input {
      display: block;
      width: 100%;
      box-sizing: border-box;
      cursor: pointer;
    }
  `]
})
export class CustomDateTimeInput extends DynamicComponent<any> {
  value = input.required<any>(); // using any to avoid import issues
  enableDate = input.required<boolean>();
  enableTime = input.required<boolean>();

  dateInput = viewChild<ElementRef<HTMLInputElement>>('dateInput');

  inputId = super.getUniqueId('a2ui-datetime-input');

  inputType = computed(() => {
    const enableDate = this.enableDate();
    const enableTime = this.enableTime();
    if (enableDate && enableTime) {
      return 'datetime-local';
    } else if (enableDate) {
      return 'date';
    } else if (enableTime) {
      return 'time';
    }
    return 'datetime-local';
  });

  step = computed(() => {
    // default step for time/datetime-local to allow seconds if needed, or stick to minutes?
    // A2UI spec doesn't specify seconds, usually minutes.
    // 'any' allows seconds. '60' forces minutes.
    return 'any';
  });

  label = computed(() => {
    const inputType = this.inputType();
    if (inputType === 'date') {
      return 'Date';
    } else if (inputType === 'time') {
      return 'Time';
    }
    return 'Date & Time';
  });

  inputValue = computed(() => {
    const inputType = this.inputType();
    const parsed = super.resolvePrimitive(this.value()) || '';
    const date = parsed ? new Date(parsed) : null;

    if (!date || isNaN(date.getTime())) {
      return '';
    }

    const year = this.padNumber(date.getFullYear());
    const month = this.padNumber(date.getMonth() + 1); // Fix: getMonth is 0-indexed!
    const day = this.padNumber(date.getDate());
    const hours = this.padNumber(date.getHours());
    const minutes = this.padNumber(date.getMinutes());
    // const seconds = this.padNumber(date.getSeconds());

    if (inputType === 'date') {
      return `${year}-${month}-${day}`;
    } else if (inputType === 'time') {
      return `${hours}:${minutes}`;
    }
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  handleInput(event: Event) {
    const path = this.value()?.path;
    if (!(event.target instanceof HTMLInputElement) || !path) {
      return;
    }
    // Update the model with the new value
    // We should parse it back to ISO string if needed?
    // A2UI usually expects ISO string.
    // The input value is local time string.
    // We need to construct a Date object and get ISO string?
    // Or just store the raw string? A2UI spec says "ISO 8601 string".
    // If we use input.value, it's YYYY-MM-DD or YYYY-MM-DDThh:mm
    // new Date(input.value) creates a date in local time (usually) or UTC?
    // YYYY-MM-DD is UTC. YYYY-MM-DDThh:mm is Local.
    // We should probably just store exactly what the input gives for now,
    // or let the helper method handle it?
    // The original code was:
    // this.processor.setData(this.component(), path, event.target.value, this.surfaceId());
    // So it stored the raw input value. We'll stick to that.

    this.processor.setData(this.component(), path, event.target.value, this.surfaceId());
  }

  handleClick(event: MouseEvent) {
    // Try to open picker programmatically if supported
    const input = event.target as HTMLInputElement;
    if (input && typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch (e) {
        // Ignore if already open or not allowed
      }
    }
  }

  focusInput() {
    this.dateInput()?.nativeElement.focus();
    // Also try to show picker?
    if (this.dateInput()?.nativeElement.showPicker) {
      try {
        this.dateInput()!.nativeElement.showPicker();
      } catch (e) { }
    }
  }

  padNumber(value: number) {
    return value.toString().padStart(2, '0');
  }
}
