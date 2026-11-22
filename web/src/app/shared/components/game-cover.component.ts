import { Component, computed, input, linkedSignal } from '@angular/core';

@Component({
  selector: 'app-game-cover',
  standalone: true,
  template: `
    <div class="cover" [class.cover--zoom]="zoomOnHover()" [style.aspect-ratio]="aspectRatio()">
      @if (activeSrc(); as url) {
        <img [src]="url" [alt]="title()" loading="lazy" (error)="onImageError()" />
      } @else {
        <div class="cover__fallback">
          <span>{{ initials() }}</span>
        </div>
      }
      @if (scrim() !== 'none') {
        <div class="cover__scrim" [class.cover__scrim--strong]="scrim() === 'strong'"></div>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .cover {
      position: relative;
      width: 100%;
      overflow: hidden;
      background: linear-gradient(145deg, var(--bg-surface-elevated), var(--bg-rail));

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 0.28s ease;
      }
    }

    .cover__fallback {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at 25% 20%, rgba(11, 105, 122, 0.38), transparent 60%),
        radial-gradient(circle at 80% 85%, rgba(181, 227, 76, 0.14), transparent 55%),
        linear-gradient(145deg, var(--bg-surface-elevated), var(--bg-rail));

      span {
        font-size: 2rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        color: var(--accent-primary);
      }
    }

    .cover__scrim {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(16, 17, 19, 0.78) 0%, transparent 55%);
      pointer-events: none;
    }

    .cover__scrim--strong {
      background: linear-gradient(to top, rgba(16, 17, 19, 0.94) 8%, rgba(16, 17, 19, 0.35) 52%, transparent 100%);
    }
  `,
})
export class GameCoverComponent {
  readonly src = input<string | null>(null);
  readonly fallbackSrc = input<string | null>(null);
  readonly title = input.required<string>();
  readonly aspectRatio = input<string>('16 / 10');
  readonly scrim = input<'subtle' | 'strong' | 'none'>('subtle');
  readonly zoomOnHover = input<boolean>(false);

  private readonly candidates = computed(() =>
    [this.src(), this.fallbackSrc()]
      .map((url) => url?.trim() ?? '')
      .filter((url): url is string => url.length > 0),
  );

  private readonly candidateIndex = linkedSignal(() => {
    this.candidates();
    return 0;
  });

  protected readonly activeSrc = computed(() => this.candidates()[this.candidateIndex()] ?? null);

  protected readonly initials = computed(
    () =>
      this.title()
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('') || 'NQ',
  );

  protected onImageError(): void {
    this.candidateIndex.update((index) => index + 1);
  }
}
