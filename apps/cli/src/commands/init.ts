/**
 * Init Command
 *
 * Scaffold a new agent project.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAgentYaml, getMainPy, getRequirementsTxt, getDockerfile, getFlyToml } from '../templates';
import { success, error, info, tree } from '../lib/output';

const NAME_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const FLY_APP_NAME = process.env.FLY_APP_NAME ?? 'agentiom-agents';

function validateName(name: string): boolean {
  if (name.length < 3 || name.length > 32) {
    return false;
  }
  return NAME_REGEX.test(name);
}

export async function init(name: string): Promise<void> {
  // Validate name
  const normalizedName = name.toLowerCase();

  if (!validateName(normalizedName)) {
    error('Invalid agent name');
    info('Name must be 3-32 characters, lowercase alphanumeric with hyphens');
    info('Cannot start or end with a hyphen');
    process.exit(1);
  }

  // Check if directory exists
  const dir = join(process.cwd(), normalizedName);

  if (existsSync(dir)) {
    error(`Directory "${normalizedName}" already exists`);
    process.exit(1);
  }

  // Create directory
  mkdirSync(dir, { recursive: true });

  // Write files
  const files = [
    { name: 'agent.yaml', content: getAgentYaml(normalizedName) },
    { name: 'main.py', content: getMainPy(normalizedName) },
    { name: 'requirements.txt', content: getRequirementsTxt() },
    { name: 'Dockerfile', content: getDockerfile() },
    { name: 'fly.toml', content: getFlyToml(normalizedName, FLY_APP_NAME) },
  ];

  for (const file of files) {
    writeFileSync(join(dir, file.name), file.content);
  }

  // Output
  console.log();
  success(`Created agent "${normalizedName}"`);
  console.log();

  tree(normalizedName, files.map((f) => f.name));

  console.log();
  info('Next steps:');
  console.log(`  cd ${normalizedName}`);
  console.log('  agentiom deploy');
  console.log();
}
