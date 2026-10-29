import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  it('shows the product name in the header', async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.brand')?.textContent).toContain('Acme Invoices');
  });
});
