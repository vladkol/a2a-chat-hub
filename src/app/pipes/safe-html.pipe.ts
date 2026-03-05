import { Pipe, PipeTransform, inject } from '@angular/core';
import DOMPurify from 'dompurify';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'safeHtml',
  standalone: true
})
export class SafeHtmlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string | undefined): SafeHtml {
    if (!value) return '';
    const cleanHtml = DOMPurify.sanitize(value, { ADD_TAGS: ['video', 'audio', 'source'] });
    return this.sanitizer.bypassSecurityTrustHtml(cleanHtml);
  }
}
