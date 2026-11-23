import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { BacklogGame } from '../../../core/models/api.models';
import { PlayPlanApi, QueuedGame } from '../services/play-plan.api';
import { PlayQueueComponent } from './play-queue.component';

describe('PlayQueueComponent', () => {
  const initialQueue: QueuedGame[] = [
    { id: 'g1', title: 'Grand Theft Auto VI' },
    { id: 'g2', title: 'Elden Ring Nightreign' },
  ];

  const catalog: BacklogGame[] = [
    {
      id: 'g1',
      title: 'Grand Theft Auto VI',
      platform: 'PlayStation 5',
      status: 'planned',
      rawgId: 10,
      platformId: 187,
      coverUrl: 'https://example.com/gta6.jpg',
      createdAt: '2026-11-22T10:00:00Z',
    },
  ];

  it('renders queued games enriched with catalog cover, platform and status', () => {
    const api = {
      queue: vi.fn(() => of(initialQueue)),
      saveQueue: vi.fn(() => of(void 0)),
    };

    TestBed.configureTestingModule({
      imports: [PlayQueueComponent],
      providers: [provideRouter([]), { provide: PlayPlanApi, useValue: api }],
    });

    const fixture = TestBed.createComponent(PlayQueueComponent);
    fixture.componentRef.setInput('catalog', catalog);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.nq-mini-item');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('img')?.getAttribute('src')).toBe('https://example.com/gta6.jpg');
    expect(rows[0].textContent).toContain('PlayStation 5');
    expect(rows[0].textContent).toContain('Planejado');
    expect(rows[1].textContent).toContain('Posição #2 na fila');
  });

  it('calls saveQueue when reordering or removing an item', () => {
    const api = {
      queue: vi.fn(() => of(initialQueue)),
      saveQueue: vi.fn(() => of(void 0)),
    };

    TestBed.configureTestingModule({
      imports: [PlayQueueComponent],
      providers: [provideRouter([]), { provide: PlayPlanApi, useValue: api }],
    });

    const fixture = TestBed.createComponent(PlayQueueComponent);
    fixture.detectChanges();

    const moveDownBtn = fixture.nativeElement.querySelector(
      'button[aria-label="Descer Grand Theft Auto VI"]',
    ) as HTMLButtonElement;
    moveDownBtn.click();
    fixture.detectChanges();

    expect(api.saveQueue).toHaveBeenCalledWith([
      { id: 'g2', title: 'Elden Ring Nightreign' },
      { id: 'g1', title: 'Grand Theft Auto VI' },
    ]);

    const removeBtn = fixture.nativeElement.querySelector(
      'button[aria-label="Remover Elden Ring Nightreign"]',
    ) as HTMLButtonElement;
    removeBtn.click();
    fixture.detectChanges();

    expect(api.saveQueue).toHaveBeenLastCalledWith([
      { id: 'g1', title: 'Grand Theft Auto VI' },
    ]);
  });
});
