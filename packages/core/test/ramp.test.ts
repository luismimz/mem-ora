import { describe, expect, it } from 'vitest';
import { newUnitsFor, type DayActivity } from '../src';

const day = (attempts: number, correct: number): DayActivity => ({ introduced: 0, reviews: 0, attempts, correct });

describe('rampa de unidades nuevas', () => {
  it('empieza con 8 sin historial', () => {
    expect(newUnitsFor({}, 15)).toBe(8);
  });

  it('sube de 2 en 2 con aciertos altos y se detiene en el objetivo', () => {
    expect(newUnitsFor({ 1: day(20, 18) }, 15)).toBe(10);
    expect(newUnitsFor({ 1: day(20, 18), 2: day(10, 9), 3: day(10, 10), 4: day(10, 10), 5: day(10, 10) }, 15)).toBe(15);
  });

  it('baja un escalón al fallar, sin bajar del inicio', () => {
    expect(newUnitsFor({ 1: day(10, 9), 2: day(10, 9), 3: day(10, 4) }, 15)).toBe(10);
    expect(newUnitsFor({ 1: day(10, 2) }, 15)).toBe(8);
  });

  it('se mantiene con aciertos intermedios e ignora días con pocos intentos', () => {
    expect(newUnitsFor({ 1: day(10, 7) }, 15)).toBe(8);
    expect(newUnitsFor({ 1: day(3, 3) }, 15)).toBe(8);
  });

  it('un objetivo menor que el inicio manda', () => {
    expect(newUnitsFor({}, 5)).toBe(5);
    expect(newUnitsFor({ 1: day(10, 10) }, 5)).toBe(5);
  });

  it('aplica los días en orden aunque las claves lleguen desordenadas', () => {
    expect(newUnitsFor({ 10: day(10, 2), 2: day(10, 10) }, 15)).toBe(8);
  });
});
