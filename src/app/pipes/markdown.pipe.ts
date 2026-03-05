import { Pipe, PipeTransform, inject } from '@angular/core';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string | undefined | null): SafeHtml {
    if (!value) return '';
    const parsed = marked.parse(value, { async: false }) as string;
    const cleanHtml = DOMPurify.sanitize(parsed, { ADD_TAGS: ['video', 'audio', 'source'] });
    return this.sanitizer.bypassSecurityTrustHtml(cleanHtml);
  }
}
