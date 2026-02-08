import { describe, it, expect } from 'vitest';
import { parseEventLine } from './parsers';

describe('parseEventLine', () => {
  describe('OpenCode parsing', () => {
    it('should parse step_start as status event', () => {
      const line = JSON.stringify({ type: 'step_start', part: {} });
      const results = parseEventLine('opencode', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('status');
      expect(results[0].text).toBe('Step started');
    });

    it('should parse tool_use with title from state', () => {
      const line = JSON.stringify({
        type: 'tool_use',
        part: {
          tool: 'bash',
          state: {
            title: 'Running npm install',
            status: 'running',
            input: { command: 'npm install' }
          }
        }
      });
      const results = parseEventLine('opencode', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('tool_call');
      expect(results[0].text).toContain('Running npm install');
      expect(results[0].text).toContain('npm install');
    });

    it('should parse tool_use with status indicator when not running', () => {
      const line = JSON.stringify({
        type: 'tool_use',
        part: {
          tool: 'read',
          state: {
            status: 'completed',
            input: { path: '/src/index.ts' }
          }
        }
      });
      const results = parseEventLine('opencode', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('tool_call');
      expect(results[0].text).toContain('(completed)');
      expect(results[0].text).toContain('/src/index.ts');
    });

    it('should parse tool_use with command input', () => {
      const line = JSON.stringify({
        type: 'tool_use',
        part: {
          tool: 'bash',
          state: {
            input: { command: 'git status' }
          }
        }
      });
      const results = parseEventLine('opencode', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('tool_call');
      expect(results[0].text).toContain('bash');
      expect(results[0].text).toContain('git status');
    });

    it('should parse tool_use with file_path input', () => {
      const line = JSON.stringify({
        type: 'tool_use',
        part: {
          tool: 'read',
          state: {
            input: { file_path: '/Users/test/src/app.ts' }
          }
        }
      });
      const results = parseEventLine('opencode', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('tool_call');
      expect(results[0].text).toContain('/Users/test/src/app.ts');
    });

    it('should parse tool_use with pattern input', () => {
      const line = JSON.stringify({
        type: 'tool_use',
        part: {
          tool: 'grep',
          state: {
            input: { pattern: 'function.*export' }
          }
        }
      });
      const results = parseEventLine('opencode', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('tool_call');
      expect(results[0].text).toContain('function.*export');
    });

    it('should parse step_finish with reason', () => {
      const line = JSON.stringify({
        type: 'step_finish',
        part: {
          finish_reason: 'tool-calls',
          tokens: { input: 1000, output: 500, reasoning: 200 },
          cost: 0.05
        }
      });
      const results = parseEventLine('opencode', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('status');
      expect(results[0].text).toBe('Step completed (tool-calls)');
      expect(results[0].tokenUsage).toEqual({
        inputTokens: 1000,
        outputTokens: 700, // output + reasoning
        totalCost: 0.05
      });
    });

    it('should parse step_finish with alternative reason field', () => {
      const line = JSON.stringify({
        type: 'step_finish',
        part: {
          reason: 'stop',
          tokens: { input: 500, output: 300 }
        }
      });
      const results = parseEventLine('opencode', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('status');
      expect(results[0].text).toBe('Step completed (stop)');
    });

    it('should parse step_finish without reason', () => {
      const line = JSON.stringify({
        type: 'step_finish',
        part: {
          tokens: { input: 100, output: 50 }
        }
      });
      const results = parseEventLine('opencode', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('status');
      expect(results[0].text).toBe('Step completed');
    });

    it('should parse share URL as status event', () => {
      const line = 'https://opncd.ai/share/abc123xyz';
      const results = parseEventLine('opencode', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('status');
      expect(results[0].text).toBe('Share link: https://opncd.ai/share/abc123xyz');
    });

    it('should parse reasoning event as thinking', () => {
      const line = JSON.stringify({
        type: 'reasoning',
        part: { text: 'Let me think about this...' }
      });
      const results = parseEventLine('opencode', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('thinking');
      expect(results[0].text).toBe('Let me think about this...');
    });

    it('should parse text event', () => {
      const line = JSON.stringify({
        type: 'text',
        part: { text: 'Here is the solution...' }
      });
      const results = parseEventLine('opencode', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('text');
      expect(results[0].text).toBe('Here is the solution...');
    });

    it('should parse error event', () => {
      const line = JSON.stringify({
        type: 'error',
        message: 'API rate limit exceeded'
      });
      const results = parseEventLine('opencode', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('raw');
      expect(results[0].text).toContain('Error:');
      expect(results[0].text).toContain('API rate limit exceeded');
    });

    it('should surface unknown event types via fallback', () => {
      const line = JSON.stringify({
        type: 'some_new_event_type',
        part: { text: 'some content' }
      });
      const results = parseEventLine('opencode', line);

      expect(results).toHaveLength(1);
      // Unknown events with text content become text events
      expect(results[0].eventType).toBe('text');
      expect(results[0].text).toBe('some content');
    });

    it('should handle unknown event types without content as status', () => {
      const line = JSON.stringify({
        type: 'some_new_event_type',
        part: {}
      });
      const results = parseEventLine('opencode', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('status');
      expect(results[0].text).toBe('[some_new_event_type]');
    });

    // SDK/event-stream shape compatibility tests
    describe('SDK shape normalization', () => {
      it('should normalize message.part.updated to tool_use', () => {
        const line = JSON.stringify({
          type: 'message.part.updated',
          properties: {
            part: {
              type: 'tool_use',
              tool: 'bash',
              state: {
                input: { command: 'ls -la' }
              }
            }
          }
        });
        const results = parseEventLine('opencode', line);

        expect(results).toHaveLength(1);
        expect(results[0].eventType).toBe('tool_call');
        expect(results[0].text).toContain('ls -la');
      });

      it('should normalize message.step.started to step_start', () => {
        const line = JSON.stringify({
          type: 'message.step.started',
          properties: { part: {} }
        });
        const results = parseEventLine('opencode', line);

        expect(results).toHaveLength(1);
        expect(results[0].eventType).toBe('status');
        expect(results[0].text).toBe('Step started');
      });

      it('should normalize message.step.finished to step_finish', () => {
        const line = JSON.stringify({
          type: 'message.step.finished',
          properties: {
            part: {
              finish_reason: 'stop',
              tokens: { input: 100, output: 50 }
            }
          }
        });
        const results = parseEventLine('opencode', line);

        expect(results).toHaveLength(1);
        expect(results[0].eventType).toBe('status');
        expect(results[0].text).toBe('Step completed (stop)');
      });
    });
  });

  describe('Claude parsing', () => {
    it('should return empty for system events', () => {
      const line = JSON.stringify({ type: 'system', subtype: 'init' });
      const results = parseEventLine('claude', line);
      expect(results).toHaveLength(0);
    });

    it('should parse assistant event with tool_use blocks', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Read', input: { file_path: '/src/app.ts' } },
            { type: 'tool_use', name: 'Bash', input: { command: 'npm test' } },
          ],
          stop_reason: 'tool_use',
          usage: { input_tokens: 1000, output_tokens: 200 }
        }
      });
      const results = parseEventLine('claude', line);

      // 2 tool_call events + 1 status event ("Executing tools...")
      expect(results).toHaveLength(3);
      expect(results[0].eventType).toBe('tool_call');
      expect(results[0].text).toContain('Tool: Read');
      expect(results[0].text).toContain('/src/app.ts');
      expect(results[1].eventType).toBe('tool_call');
      expect(results[1].text).toContain('Tool: Bash');
      expect(results[1].text).toContain('npm test');
      expect(results[2].eventType).toBe('status');
      expect(results[2].text).toBe('Executing tools...');
      expect(results[2].tokenUsage).toEqual({
        inputTokens: 1000,
        outputTokens: 200,
        totalCost: null,
      });
    });

    it('should parse assistant event with thinking block', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', thinking: 'Let me analyze this code...' },
            { type: 'tool_use', name: 'Grep', input: { pattern: 'TODO' } },
          ],
          stop_reason: 'tool_use',
          usage: { input_tokens: 500, output_tokens: 100 }
        }
      });
      const results = parseEventLine('claude', line);

      // thinking + tool_call + status
      expect(results).toHaveLength(3);
      expect(results[0].eventType).toBe('thinking');
      expect(results[0].text).toBe('Let me analyze this code...');
      expect(results[1].eventType).toBe('tool_call');
      expect(results[1].text).toContain('Tool: Grep');
      expect(results[2].eventType).toBe('status');
      expect(results[2].text).toBe('Executing tools...');
    });

    it('should skip text blocks in assistant events (result event carries final text)', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Here is my analysis...' },
          ],
          stop_reason: 'end_turn',
          usage: { input_tokens: 800, output_tokens: 300 }
        }
      });
      const results = parseEventLine('claude', line);

      // Only the status event — text blocks are skipped to avoid duplication
      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('status');
      expect(results[0].text).toBe('Turn completed (end_turn)');
    });

    it('should parse assistant event with empty content as fallback status', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [],
          usage: { input_tokens: 100, output_tokens: 10 }
        }
      });
      const results = parseEventLine('claude', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('status');
      expect(results[0].text).toBe('Processing...');
    });

    it('should parse result event with text', () => {
      const line = JSON.stringify({
        type: 'result',
        result: 'Here is the final summary of changes.',
        usage: { input_tokens: 5000, output_tokens: 1500 },
        total_cost_usd: 0.12,
      });
      const results = parseEventLine('claude', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('text');
      expect(results[0].text).toBe('Here is the final summary of changes.');
      expect(results[0].tokenUsageCumulative).toBe(true);
      expect(results[0].tokenUsage?.totalCost).toBe(0.12);
    });

    it('should parse result event error subtype', () => {
      const line = JSON.stringify({
        type: 'result',
        subtype: 'error',
        result: '',
        usage: { input_tokens: 100, output_tokens: 0 },
      });
      const results = parseEventLine('claude', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('status');
      expect(results[0].text).toBe('Run failed');
      expect(results[0].tokenUsageCumulative).toBe(true);
    });

    it('should parse assistant event with cache token usage', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Edit', input: { file_path: '/src/main.ts' } },
          ],
          stop_reason: 'tool_use',
          usage: {
            input_tokens: 200,
            cache_creation_input_tokens: 500,
            cache_read_input_tokens: 300,
            output_tokens: 150,
          }
        }
      });
      const results = parseEventLine('claude', line);

      const statusEvent = results.find(e => e.eventType === 'status');
      expect(statusEvent?.tokenUsage).toEqual({
        inputTokens: 1000, // 200 + 500 + 300
        outputTokens: 150,
        totalCost: null,
      });
    });

    // Stream event tests (when stream_event deltas are present, e.g. future modes)
    describe('stream_event parsing', () => {
      it('should parse content_block_start tool_use', () => {
        const line = JSON.stringify({
          type: 'stream_event',
          event: {
            type: 'content_block_start',
            content_block: { type: 'tool_use', name: 'Write' }
          }
        });
        const results = parseEventLine('claude', line);
        expect(results).toHaveLength(1);
        expect(results[0].eventType).toBe('tool_call');
        expect(results[0].text).toBe('Tool: Write');
      });

      it('should parse content_block_delta text_delta', () => {
        const line = JSON.stringify({
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello world' }
          }
        });
        const results = parseEventLine('claude', line);
        expect(results).toHaveLength(1);
        expect(results[0].eventType).toBe('text');
        expect(results[0].text).toBe('Hello world');
      });

      it('should parse message_delta with tool_use stop_reason', () => {
        const line = JSON.stringify({
          type: 'stream_event',
          event: {
            type: 'message_delta',
            delta: { stop_reason: 'tool_use' }
          }
        });
        const results = parseEventLine('claude', line);
        expect(results).toHaveLength(1);
        expect(results[0].eventType).toBe('status');
        expect(results[0].text).toBe('Executing tools...');
      });
    });
  });

  describe('Non-JSON line handling', () => {
    it('should return raw event for non-JSON lines for non-OpenCode agents', () => {
      const line = 'Some random output text';
      const results = parseEventLine('codex', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('raw');
      expect(results[0].text).toBe('Some random output text');
    });

    it('should strip ANSI codes from non-JSON lines', () => {
      const line = '\x1B[32mGreen text\x1B[0m';
      const results = parseEventLine('codex', line);

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe('raw');
      expect(results[0].text).toBe('Green text');
    });

    it('should return empty array for empty lines', () => {
      expect(parseEventLine('opencode', '')).toHaveLength(0);
      expect(parseEventLine('opencode', '   ')).toHaveLength(0);
    });
  });
});
