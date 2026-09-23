import { describe, it, expect } from 'vitest';

// E1-T1: prueba de que el arnes de Vitest esta operativo (alias @/, transform TS)
// antes de escribir ningun test real sobre el motor.
describe('arnes de verificacion', () => {
  it('ejecuta Vitest con soporte de TypeScript', () => {
    const suma = (a: number, b: number): number => a + b;
    expect(suma(2, 3)).toBe(5);
  });
});
