import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  it('adds, deduplicates and dismisses toast notifications', () => {
    vi.useFakeTimers();
    const service = TestBed.inject(ToastService);

    service.show('Perfil atualizado com sucesso!', 'success', 4000);
    service.show('Perfil atualizado com sucesso!', 'success', 4000);
    expect(service.toasts()).toHaveLength(1);

    service.show('Erro ao salvar.', 'error', 5000);
    expect(service.toasts()).toHaveLength(2);

    const firstId = service.toasts()[0].id;
    service.dismiss(firstId);
    expect(service.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(5000);
    expect(service.toasts()).toHaveLength(0);
    vi.useRealTimers();
  });
});
