import { TestBed } from '@angular/core/testing';

import { Barcode } from './barcode';

describe('Barcode', () => {
  let service: Barcode;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Barcode);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
