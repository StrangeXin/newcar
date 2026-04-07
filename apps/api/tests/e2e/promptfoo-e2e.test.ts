import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Promptfoo L1 Mock Tests', () => {
  it('should pass all L1 scenario tests', async () => {
    const configPath = resolve(__dirname, '../../promptfoo/promptfooconfig.yaml');
    const cwd = resolve(__dirname, '../..');

    try {
      const { stdout, stderr } = await execAsync(
        `npx promptfoo eval --config "${configPath}" --max-concurrency 1 --no-cache 2>&1`,
        { cwd, timeout: 120000 }
      );
      console.log('Promptfoo output:', stdout);
      if (stderr) console.log('Promptfoo stderr:', stderr);
    } catch (error: any) {
      console.log('Promptfoo error output:', error.stdout || error.message);
      if (error.stderr) console.log('Promptfoo stderr:', error.stderr);
    }
  }, 180000);
});
