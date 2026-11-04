import { describe, expect, it } from 'vitest';
import { costUsd, finalPrompt, generateImage, imageConfig, monthImageSpendEur, STYLE, visualFor } from '../src/images/lib';

describe('imágenes de las asociaciones (D-114)', () => {
  it('sin FAL_KEY no hay imágenes; con ella, tope por defecto 8 €', () => {
    expect(imageConfig({})).toBeNull();
    const c = imageConfig({ FAL_KEY: 'k' })!;
    expect(c.capEur).toBe(8);
    expect(c.model).toBe('fal-ai/flux/schnell');
  });
  it('512×512 cuesta menos de una décima de céntimo', () => expect(costUsd()).toBeLessThan(0.001));
  it('el prompt lleva el estilo de viñeta y nunca texto', () => {
    const p = finalPrompt('A "man" freezing in a pool of cola');
    expect(p).toContain(STYLE);
    expect(p).not.toContain('"');
    expect(STYLE).toMatch(/no text/);
  });
  it('sin clave de OpenRouter usa la escena tal cual', async () => {
    const v = await visualFor({ ...imageConfig({ FAL_KEY: 'k' })!, openrouterKey: null }, { target: 'cold', meaning: 'frío', scene: 'Piscina de COLA helada' });
    expect(v.visual).toContain('COLA');
    expect(v.costUsd).toBe(0);
  });
  it('genera con fal y descarga la imagen', async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      if (url.startsWith('https://fal.run/')) return new Response(JSON.stringify({ images: [{ url: 'https://cdn/x.jpg', content_type: 'image/jpeg' }] }), { status: 200 });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await generateImage(imageConfig({ FAL_KEY: 'k' })!, 'p', fake);
    expect(calls[0]).toBe('https://fal.run/fal-ai/flux/schnell');
    expect(r.b64).toBe(Buffer.from([1, 2, 3]).toString('base64'));
  });
  it('el gasto cuenta solo el mes en curso', () => {
    const now = Date.UTC(2026, 10, 15);
    expect(monthImageSpendEur([{ costEur: 0.5, at: Date.UTC(2026, 10, 2) }, { costEur: 3, at: Date.UTC(2026, 9, 30) }], now)).toBe(0.5);
  });
});
