import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SelectComponent, SelectOption } from './select.component';

@Component({
  standalone: true,
  imports: [SelectComponent],
  template: `
    <app-select
      [options]="options"
      [value]="selected()"
      ariaLabel="Plataforma"
      (valueChange)="selected.set($event)"
    />
  `,
})
class TestHostComponent {
  readonly options: SelectOption<number>[] = [
    { value: 1, label: 'PlayStation 5' },
    { value: 2, label: 'PC' },
    { value: 3, label: 'Nintendo Switch' },
  ];
  readonly selected = signal(1);
}

describe('SelectComponent', () => {
  it('displays the selected option label and opens the listbox on click', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.nq-select__trigger') as HTMLButtonElement;
    expect(trigger.textContent).toContain('PlayStation 5');
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();

    trigger.click();
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(3);
  });

  it('emits valueChange and closes when selecting an option', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.nq-select__trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const optionButtons = fixture.nativeElement.querySelectorAll(
      '[role="option"]',
    ) as NodeListOf<HTMLButtonElement>;
    optionButtons[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selected()).toBe(2);
    expect(trigger.textContent).toContain('PC');
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();
  });

  it('closes on Escape key and outside clicks', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.nq-select__trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();

    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).not.toBeNull();

    document.body.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();
  });
});
