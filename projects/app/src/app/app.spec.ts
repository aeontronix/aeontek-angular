import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the demos', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const titles = [...compiled.querySelectorAll('h1')].map((h) => h.textContent);
    expect(titles).toEqual([
      expect.stringContaining('ConfigurationService demo'),
      expect.stringContaining('ReloadService demo'),
      expect.stringContaining('ErrorView demo'),
      expect.stringContaining('DarkModeService demo'),
    ]);
  });
});
