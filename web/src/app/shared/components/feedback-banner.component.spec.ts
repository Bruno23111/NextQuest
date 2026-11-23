import { TestBed } from '@angular/core/testing';
import { ToastService } from '../../core/notifications/toast.service';
import { FeedbackBannerComponent } from './feedback-banner.component';

describe('FeedbackBannerComponent', () => {
  it('shows a toast when message is set and does not resurrect after dismiss', () => {
    const toast = TestBed.inject(ToastService);
    const fixture = TestBed.createComponent(FeedbackBannerComponent);

    fixture.componentRef.setInput('message', 'Salvo com sucesso!');
    fixture.componentRef.setInput('tone', 'success');
    fixture.detectChanges();

    expect(toast.toasts()).toHaveLength(1);
    const id = toast.toasts()[0].id;

    toast.dismiss(id);
    fixture.detectChanges();

    expect(toast.toasts()).toHaveLength(0);
  });
});
