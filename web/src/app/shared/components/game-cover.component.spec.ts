import { TestBed } from '@angular/core/testing';
import { GameCoverComponent } from './game-cover.component';

describe('GameCoverComponent', () => {
  it('renders primary src image when provided', () => {
    const fixture = TestBed.createComponent(GameCoverComponent);
    fixture.componentRef.setInput('src', 'https://example.com/poster.jpg');
    fixture.componentRef.setInput('fallbackSrc', 'https://example.com/header.jpg');
    fixture.componentRef.setInput('title', 'Hollow Knight');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://example.com/poster.jpg');
  });

  it('falls back to fallbackSrc when primary image errors', () => {
    const fixture = TestBed.createComponent(GameCoverComponent);
    fixture.componentRef.setInput('src', 'https://example.com/broken.jpg');
    fixture.componentRef.setInput('fallbackSrc', 'https://example.com/header.jpg');
    fixture.componentRef.setInput('title', 'Elden Ring');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    const updatedImg = fixture.nativeElement.querySelector('img') as HTMLImageElement | null;
    expect(updatedImg?.getAttribute('src')).toBe('https://example.com/header.jpg');
  });

  it('renders initials monogram fallback when all image candidates fail', () => {
    const fixture = TestBed.createComponent(GameCoverComponent);
    fixture.componentRef.setInput('src', 'https://example.com/broken.jpg');
    fixture.componentRef.setInput('fallbackSrc', 'https://example.com/broken2.jpg');
    fixture.componentRef.setInput('title', 'Hollow Knight');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.cover__fallback')?.textContent?.trim()).toBe('HK');
  });
});
