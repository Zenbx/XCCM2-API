import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGenerateText = vi.hoisted(() => vi.fn());

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: mockGenerateText,
    tool: vi.fn((config) => config),
  };
});
vi.mock('@ai-sdk/mistral', () => ({
  mistral: vi.fn(() => 'mistral-mock-model'),
}));

import { POST } from '@/app/api/ai/agent/route';

function makeRequest(body: object) {
  return new Request('http://localhost:3000/api/ai/agent', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.MISTRAL_API_KEY;
});

afterEach(() => {
  delete process.env.MISTRAL_API_KEY;
});

describe('POST /api/ai/agent', () => {
  it('retourne 400 si MISTRAL_API_KEY est manquante', async () => {
    const res = await POST(makeRequest({
      messages: [{ role: 'user', content: 'Construis un cours' }],
      context: {},
    }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/MISTRAL_API_KEY/);
  });

  it('retourne plan, actions et agentMode', async () => {
    process.env.MISTRAL_API_KEY = 'test-key';
    mockGenerateText.mockResolvedValue({
      text: 'Plan:\n1. Partie intro',
      toolCalls: [],
      steps: [{
        toolCalls: [
          {
            toolName: 'create_structure',
            input: {
              parts: [{
                title: 'Introduction',
                chapters: [{
                  title: 'Chapitre 1',
                  paragraphs: [{
                    title: 'Para 1',
                    notions: [{ title: 'Notion 1', content: '<p>Contenu</p>' }],
                  }],
                }],
              }],
            },
          },
        ],
      }],
    });

    const res = await POST(makeRequest({
      messages: [{ role: 'user', content: 'Construis un cours sur Python' }],
      context: { projectName: 'Python' },
    }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.agentMode).toBe(true);
    expect(data.plan).toBeTruthy();
    expect(data.actions).toHaveLength(1);
    expect(data.actions[0].type).toBe('create_structure');
    expect(data.actions[0].data.parts).toHaveLength(1);
  });

  it('retry si première réponse sans structure valide', async () => {
    process.env.MISTRAL_API_KEY = 'test-key';
    mockGenerateText
      .mockResolvedValueOnce({
        text: 'Plan seulement sans outil',
        toolCalls: [{ toolName: 'create_structure', input: { parts: [] } }],
        steps: [],
      })
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [],
        steps: [{
          toolCalls: [{
            toolName: 'create_structure',
            input: {
              parts: [{
                title: 'Partie A',
                chapters: [{
                  title: 'Ch 1',
                  paragraphs: [{
                    title: 'P1',
                    notions: [{ title: 'N1', content: '<p>OK</p>' }],
                  }],
                }],
              }],
            },
          }],
        }],
      });

    const res = await POST(makeRequest({
      messages: [{ role: 'user', content: 'Cours quantique' }],
      context: {},
    }));
    const data = await res.json();

    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(data.actions[0].data.parts[0].title).toBe('Partie A');
  });
});
