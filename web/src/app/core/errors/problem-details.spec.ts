import { HttpErrorResponse } from '@angular/common/http';
import { parseApiError } from './problem-details';

describe('parseApiError', () => {
  it('extracts first validation error from HttpValidationProblemDetails', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        title: 'Validation failed',
        errors: {
          title: ['Informe o título do jogo.'],
        },
      },
    });

    const parsed = parseApiError(error);
    expect(parsed.status).toBe(400);
    expect(parsed.message).toBe('Informe o título do jogo.');
  });

  it('falls back to status-based Portuguese message when body is empty', () => {
    const error = new HttpErrorResponse({ status: 409, error: null });
    const parsed = parseApiError(error);
    expect(parsed.status).toBe(409);
    expect(parsed.message).toContain('Conflito');
  });
});
