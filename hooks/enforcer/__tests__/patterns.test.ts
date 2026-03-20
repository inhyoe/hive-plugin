import { describe, it, expect } from 'vitest';
import {
  isDirectMarkerCreation,
  isCreateMarkerCall,
  extractCreateMarkerGate,
  isGitCommit,
  isHiveStateWrite,
  hasShellChaining,
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

    it('blocks touch on .marker file', () => {
      expect(isDirectMarkerCreation('touch .hive-state/g1.marker')).toBe(true);
    });

    it('blocks cp to .marker file', () => {
      expect(isDirectMarkerCreation('cp /tmp/fake .hive-state/g2.marker')).toBe(true);
    });

    it('blocks dd to .marker file', () => {
      expect(isDirectMarkerCreation('dd if=/dev/zero of=.hive-state/p0.marker')).toBe(true);
    });

    it('blocks mv to .marker file', () => {
      expect(isDirectMarkerCreation('mv /tmp/x .hive-state/g1.marker')).toBe(true);
    });

    it('allows cat reading a marker (standalone create-marker.sh reference)', () => {
      // cat without redirect doesn't match — but the whitelist approach means
      // any .marker reference NOT from create-marker.sh is blocked
      expect(isDirectMarkerCreation('cat .hive-state/g1.marker')).toBe(true);
    });

    it('blocks create-marker.sh with subshell injection', () => {
      expect(isDirectMarkerCreation('scripts/create-marker.sh $(touch .hive-state/fake.marker)')).toBe(true);
    });

    it('blocks create-marker.sh with backtick injection', () => {
      expect(isDirectMarkerCreation('scripts/create-marker.sh `touch .hive-state/g1.marker`')).toBe(true);
    });

    it('blocks create-marker.sh with newline-appended command', () => {
      expect(isDirectMarkerCreation('scripts/create-marker.sh g1\ntouch .hive-state/fake.marker')).toBe(true);
    });

    it('blocks create-marker.sh with stdout redirect to forge marker', () => {
      expect(isDirectMarkerCreation('scripts/create-marker.sh g1 > .hive-state/p5.marker')).toBe(true);
    });

    it('blocks create-marker.sh with append redirect to forge marker', () => {
      expect(isDirectMarkerCreation('bash scripts/create-marker.sh g1 >> .hive-state/p5.marker')).toBe(true);
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

    it('extracts with extra args after gate', () => {
      expect(extractCreateMarkerGate('bash scripts/create-marker.sh g3 --evidence-file e.txt')).toBe('g3');
    });

    it('extracts gate when flags come before gate', () => {
      expect(extractCreateMarkerGate('bash scripts/create-marker.sh --team-id alpha g1')).toBe('g1');
    });

    it('extracts gate with multiple flags before gate', () => {
      expect(extractCreateMarkerGate('bash scripts/create-marker.sh --team-id alpha --evidence-file spec.md g2')).toBe('g2');
    });

    it('returns null for non-marker commands', () => {
      expect(extractCreateMarkerGate('echo test')).toBeNull();
    });

    it('returns null when only flags (no positional gate)', () => {
      expect(extractCreateMarkerGate('bash scripts/create-marker.sh --team-id alpha')).toBeNull();
    });
  });

  describe('isHiveStateWrite', () => {
    it('detects redirect to .hive-state', () => {
      expect(isHiveStateWrite('echo x > .hive-state/session.json')).toBe(true);
    });

    it('detects cp to .hive-state', () => {
      expect(isHiveStateWrite('cp fake.json .hive-state/session.json')).toBe(true);
    });

    it('detects rm of .hive-state', () => {
      expect(isHiveStateWrite('rm .hive-state/session.json')).toBe(true);
    });

    it('detects ln -sf to .hive-state', () => {
      expect(isHiveStateWrite('ln -sf /tmp/fake .hive-state/session.json')).toBe(true);
    });

    it('detects install to .hive-state', () => {
      expect(isHiveStateWrite('install -m 644 fake.json .hive-state/session.json')).toBe(true);
    });

    it('detects sed -i on .hive-state', () => {
      expect(isHiveStateWrite('sed -i \'s/HIVE/IDLE/\' .hive-state/session.json')).toBe(true);
    });

    it('detects python write to .hive-state', () => {
      expect(isHiveStateWrite('python -c "open(\'.hive-state/session.json\',\'w\')"')).toBe(true);
    });

    it('detects node write to .hive-state', () => {
      expect(isHiveStateWrite('node -e "require(\'fs\').writeFileSync(\'.hive-state/session.json\',\'{}\')"')).toBe(true);
    });

    it('detects relative path ./.hive-state', () => {
      expect(isHiveStateWrite('echo x > ./.hive-state/session.json')).toBe(true);
    });

    it('allows read of .hive-state (no write indicators)', () => {
      expect(isHiveStateWrite('cat .hive-state/session.json')).toBe(false);
    });

    it('allows jq read of .hive-state', () => {
      expect(isHiveStateWrite('jq .phase .hive-state/session.json')).toBe(false);
    });

    it('ignores commands not referencing .hive-state', () => {
      expect(isHiveStateWrite('echo hello world')).toBe(false);
    });
  });

  describe('hasShellChaining', () => {
    it('detects &&', () => {
      expect(hasShellChaining('cmd1 && cmd2')).toBe(true);
    });

    it('detects ||', () => {
      expect(hasShellChaining('cmd1 || cmd2')).toBe(true);
    });

    it('detects ;', () => {
      expect(hasShellChaining('cmd1; cmd2')).toBe(true);
    });

    it('detects pipe', () => {
      expect(hasShellChaining('cmd1 | cmd2')).toBe(true);
    });

    it('detects background &', () => {
      expect(hasShellChaining('malicious-cmd &')).toBe(true);
    });

    it('detects backtick substitution', () => {
      expect(hasShellChaining('cmd `evil`')).toBe(true);
    });

    it('detects $() substitution', () => {
      expect(hasShellChaining('cmd $(evil)')).toBe(true);
    });

    it('detects newline separation', () => {
      expect(hasShellChaining('cmd1\ncmd2')).toBe(true);
    });

    it('returns false for standalone command', () => {
      expect(hasShellChaining('bash scripts/create-marker.sh g1 --team-id alpha')).toBe(false);
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

    it('returns null when command is a number', () => {
      expect(extractCommandFromStdin(JSON.stringify({ tool_input: { command: 42 } }))).toBeNull();
    });

    it('returns null when command is an array', () => {
      expect(extractCommandFromStdin(JSON.stringify({ tool_input: { command: ['ls'] } }))).toBeNull();
    });

    it('returns null when command is an object', () => {
      expect(extractCommandFromStdin(JSON.stringify({ tool_input: { command: { cmd: 'ls' } } }))).toBeNull();
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

    it('returns null when prompt is a number', () => {
      expect(extractPromptFromStdin(JSON.stringify({ prompt: 123 }))).toBeNull();
    });

    it('returns null when prompt is an array', () => {
      expect(extractPromptFromStdin(JSON.stringify({ prompt: ['hello'] }))).toBeNull();
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

    it('returns null when prompt is a number', () => {
      const stdin = JSON.stringify({ tool_input: { prompt: 42, subagent_type: 'Explore' } });
      expect(extractAgentInfoFromStdin(stdin)).toBeNull();
    });

    it('returns null when subagent_type is an object', () => {
      const stdin = JSON.stringify({ tool_input: { prompt: 'test', subagent_type: { type: 'Explore' } } });
      expect(extractAgentInfoFromStdin(stdin)).toBeNull();
    });

    it('uses empty string when description is non-string', () => {
      const stdin = JSON.stringify({ tool_input: { prompt: 'test', subagent_type: 'Explore', description: 999 } });
      const info = extractAgentInfoFromStdin(stdin);
      expect(info).not.toBeNull();
      expect(info!.description).toBe('');
    });
  });
});
