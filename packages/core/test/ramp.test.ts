import { describe, expect, it } from 'vitest';
import { flowNewUnits, newUnitsFor, type DayActivity } from '../src';

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

describe('flowNewUnits', () => {
  it('con tope diario, deja de traer nuevas al agotar las rondas del día', () => {
    expect(flowNewUnits({ perRound: 8, newToday: 0, dailyRounds: 3 })).toBe(8);
    expect(flowNewUnits({ perRound: 8, newToday: 20, dailyRounds: 3 })).toBe(4);
    expect(flowNewUnits({ perRound: 8, newToday: 24, dailyRounds: 3 })).toBe(0);
  });

  it('sin tope, sigue trayendo nuevas aunque ya se hayan visto muchas hoy', () => {
    expect(flowNewUnits({ perRound: 8, newToday: 200, dailyRounds: null })).toBe(8);
    expect(flowNewUnits({ perRound: 8, newToday: 200, dailyRounds: null, lastRound: { answered: 10, correct: 8 } })).toBe(8);
  });

  it('sin tope, una ronda anterior con menos del 80 % da una ronda de refuerzo: menos nuevas, nunca cero (D-086)', () => {
    expect(flowNewUnits({ perRound: 8, newToday: 40, dailyRounds: null, lastRound: { answered: 10, correct: 7 } })).toBe(3);
    expect(flowNewUnits({ perRound: 2, newToday: 40, dailyRounds: null, lastRound: { answered: 10, correct: 0 } })).toBe(1);
  });

  it('fallar ronda tras ronda no deja el curso parado: siempre entra algo nuevo (D-086)', () => {
    let seen = 0;
    for (let r = 0; r < 6; r += 1) seen += flowNewUnits({ perRound: 8, newToday: seen, dailyRounds: null, lastRound: { answered: 12, correct: 6 } });
    expect(seen).toBeGreaterThanOrEqual(6 * 3);
  });

  it('una ronda anterior con muy pocas respuestas no cuenta', () => {
    expect(flowNewUnits({ perRound: 8, newToday: 40, dailyRounds: null, lastRound: { answered: 3, correct: 0 } })).toBe(8);
  });
});

