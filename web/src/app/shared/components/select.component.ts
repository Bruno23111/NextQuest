import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

export interface SelectOption<T = string | number> {
  value: T;
  label: string;
}

@Component({
  selector: 'app-select',
  standalone: true,
  template: `
    <div class="nq-select" [class.is-open]="open()">
      <button
        type="button"
        class="nq-select__trigger"
        [class.is-open]="open()"
        [disabled]="disabled()"
        aria-haspopup="listbox"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="ariaLabel() || null"
        (click)="toggle()"
      >
        <span class="nq-select__label">{{ selectedLabel() }}</span>
        <span
          class="ms-icon nq-select__chevron"
          [class.is-open]="open()"
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>

      @if (open()) {
        <div
          class="nq-select__menu"
          role="listbox"
          [attr.aria-label]="ariaLabel() || null"
        >
          @for (option of options(); track option.value) {
            <button
              type="button"
              class="nq-select__option"
              role="option"
              [class.is-selected]="option.value === value()"
              [attr.aria-selected]="option.value === value()"
              (click)="selectOption(option.value)"
            >
              <span>{{ option.label }}</span>
              @if (option.value === value()) {
                <span class="ms-icon" aria-hidden="true">check</span>
              }
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class SelectComponent<T = string | number> {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input.required<readonly SelectOption<T>[]>();
  readonly value = input<T | null>(null);
  readonly placeholder = input<string>('Selecionar...');
  readonly ariaLabel = input<string>('');
  readonly disabled = input<boolean>(false);

  readonly valueChange = output<T>();

  protected readonly open = signal(false);

  protected readonly selectedLabel = computed(() => {
    const current = this.value();
    const match = this.options().find((opt) => opt.value === current);
    return match?.label ?? this.placeholder();
  });

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  protected toggle(): void {
    if (this.disabled()) return;
    this.open.update((current) => !current);
  }

  protected selectOption(nextValue: T): void {
    this.valueChange.emit(nextValue);
    this.open.set(false);
  }
}
