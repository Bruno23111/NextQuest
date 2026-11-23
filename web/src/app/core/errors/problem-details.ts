import { HttpErrorResponse } from '@angular/common/http';
import { ProblemDetails } from '../models/api.models';

export interface ParsedApiError {
  status: number;
  message: string;
  fieldErrors: Record<string, string[]>;
}

export function parseApiError(error: unknown): ParsedApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return {
      status: 0,
      message: 'Erro inesperado ao processar a solicitação.',
      fieldErrors: {},
    };
  }

  if (error.status === 0) {
    return {
      status: 0,
      message: 'Não foi possível conectar à API. Verifique se o servidor está ativo.',
      fieldErrors: {},
    };
  }

  if (error.status === 413) {
    return {
      status: 413,
      message: 'Os arquivos enviados são grandes demais. Reduza o tamanho e tente novamente.',
      fieldErrors: {},
    };
  }

  const body = error.error as ProblemDetails | string | null;
  if (body && typeof body === 'object') {
    const fieldErrors = body.errors ?? {};
    const validationMessages = Object.values(fieldErrors).flat();
    const message =
      validationMessages[0] ??
      body.detail ??
      body.title ??
      defaultStatusMessage(error.status);

    return {
      status: error.status,
      message,
      fieldErrors,
    };
  }

  return {
    status: error.status,
    message: typeof body === 'string' && body.trim() ? body : defaultStatusMessage(error.status),
    fieldErrors: {},
  };
}

function defaultStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Dados inválidos. Revise os campos informados.';
    case 401:
      return 'Sessão expirada ou credenciais inválidas.';
    case 403:
      return 'Você não tem permissão para acessar este recurso.';
    case 404:
      return 'Recurso não encontrado.';
    case 409:
      return 'Conflito: este registro já existe ou já está vinculado.';
    case 429:
      return 'Muitas requisições em sequência. Aguarde alguns segundos.';
    case 503:
      return 'Serviço externo temporariamente indisponível.';
    default:
      return 'Ocorreu uma falha no servidor.';
  }
}
