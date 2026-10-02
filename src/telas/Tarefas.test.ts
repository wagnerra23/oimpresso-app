import { describe, expect, it } from 'vitest';
import { idDoTodo } from './Tarefas';

describe('notificação de tarefa (tela 16) abre o detalhe (tela 28)', () => {
  it('"todo:<n>" vira o id do detalhe', () => {
    expect(idDoTodo('todo:16')).toBe('16');
  });
  it('id fora do formato, número solto ou null abre só a lista', () => {
    expect(idDoTodo(null)).toBeNull();
    expect(idDoTodo(16)).toBeNull();
    expect(idDoTodo('ponto:3')).toBeNull();
    expect(idDoTodo('todo:')).toBeNull();
  });
});
