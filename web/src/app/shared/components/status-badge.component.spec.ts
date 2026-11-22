import { TestBed } from '@angular/core/testing';
import { StatusBadgeComponent } from './status-badge.component';

describe('StatusBadgeComponent', () => {
  it('renders Portuguese label for playing status', () => {
    const fixture = TestBed.createComponent(StatusBadgeComponent);
    fixture.componentRef.setInput('status', 'playing');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Jogando');
  });

  it('renders Portuguese label for completed status', () => {
    const fixture = TestBed.createComponent(StatusBadgeComponent);
    fixture.componentRef.setInput('status', 'completed');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Zerado');
  });
});
