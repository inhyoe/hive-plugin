import { describe, it, expect } from 'vitest';
import {
  isDirectMarkerCreation,
  isCreateMarkerCall,
  extractCreateMarkerGate,
  isGitCommit,
  extractCommandFromStdin,
  extractPromptFromStdin,
  extractAgentInfoFromStdin,
} from '../src/lib/patterns.js';

describe('Pattern matching', () => {
  describe('isDirectMarkerCreation', () => {
    it('detects echo to .marker file', () => {
      expect(isDirectMarkerCreation('echo "test" > .hive-state/g1.marker')).toBe(true);
    });

    it('detects cat heredoc to .marker file', () => {
      expect(isDirectMarkerCreation('cat <<EOF > .hive-state/g2.marker')).toBe(true);
    });

    it('detects printf to .marker file', () => {
      expect(isDirectMarkerCreation('printf "data" > .hive-state/p0.marker')).toBe(true);
    });

    it('detects tee to .marker file', () => {
      expect(isDirectMarkerCreation('echo "x" | tee .hive-state/g1.marker')).toBe(true);
    });

    it('allows create-marker.sh', () => {
      expect(isDirectMarkerCreation('bash scripts/create-marker.sh g1')).toBe(false);
    });

    it('allows cat reading a marker (no redirect)', () => {
      expect(isDirectMarkerCreation('cat .hive-state/g1.marker')).toBe(false);
    });

    it('ignores unrelated commands', () => {
      expect(isDirectMarkerCreation('echo hello world')).toBe(false);
    });
  });

  describe('isCreateMarkerCall', () => {
    it('detects bash scripts/create-marker.sh', () => {
      expect(isCreateMarkerCall('bash scripts/create-marker.sh g1')).toBe(true);
    });

    it('detects ./scripts/create-marker.sh', () => {
      expect(isCreateMarkerCall('./scripts/create-marker.sh g2')).toBe(true);
    });

    it('rejects other commands', () => {
      expect(isCreateMarkerCall('echo test')).toBe(false);
    });
  });

  describe('extractCreateMarkerGate', () => {
    it('extracts gate argument', () => {
      expect(extractCreateMarkerGate('bash scripts/create-marker.sh g1')).toBe('g1');
    });

    it('extracts with extra args', () => {
      expect(extractCreateMarkerGate('bash scripts/create-marker.sh g3 --evidence-file e.txt')).toBe('g3');
    });

    it('returns null for non-marker commands', () => {
      expect(extractCreateMarkerGate('echo test')).toBeNull();
    });
  });

  describe('isGitCommit', () => {
    it('detects git commit', () => {
      expect(isGitCommit('git commit -m "test"')).toBe(true);
    });

    it('detects git commit with flags', () => {
      expect(isGitCommit('git commit --amend')).toBe(true);
    });

    it('ignores git add', () => {
      expect(isGitCommit('git add .')).toBe(false);
    });

    it('ignores git status', () => {
      expect(isGitCommit('git status')).toBe(false);
    });
  });

  describe('extractCommandFromStdin', () => {
    it('extracts command from PreToolUse Bash stdin', () => {
      const stdin = JSON.stringify({ tool_input: { command: 'echo hello' } });
      expect(extractCommandFromStdin(stdin)).toBe('echo hello');
    });

    it('returns null for invalid JSON', () => {
      expect(extractCommandFromStdin('not json')).toBeNull();
    });

    it('returns null for missing tool_input', () => {
      expect(extractCommandFromStdin(JSON.stringify({ other: 'data' }))).toBeNull();
    });
  });

  describe('extractPromptFromStdin', () => {
    it('extracts prompt from UserPromptSubmit stdin', () => {
      const stdin = JSON.stringify({ prompt: '/hive implement feature' });
      expect(extractPromptFromStdin(stdin)).toBe('/hive implement feature');
    });

    it('returns null for missing prompt', () => {
      expect(extractPromptFromStdin(JSON.stringify({}))).toBeNull();
    });
  });

  describe('extractAgentInfoFromStdin', () => {
    it('extracts agent info from Agent tool stdin', () => {
      const stdin = JSON.stringify({
        tool_input: {
          prompt: 'review code',
          subagent_type: 'Explore',
          description: 'explore codebase',
        },
      });
      const info = extractAgentInfoFromStdin(stdin);
      expect(info).not.toBeNull();
      expect(info!.prompt).toBe('review code');
      expect(info!.subagentType).toBe('Explore');
      expect(info!.description).toBe('explore codebase');
    });

    it('returns null for non-agent stdin', () => {
      expect(extractAgentInfoFromStdin(JSON.stringify({ tool_input: { command: 'ls' } }))).toBeNull();
    });
  });
});
