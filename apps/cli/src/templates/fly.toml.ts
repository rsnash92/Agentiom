export function getFlyToml(name: string, appName: string): string {
  // Volume name must use underscores (Fly.io requirement)
  const volumeName = `vol_${name.replace(/-/g, '_')}`;

  return `# Fly.io configuration for ${name}
# https://fly.io/docs/reference/configuration/

app = "${appName}"
primary_region = "iad"

[build]
# Uses Dockerfile in current directory

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[mounts]
  source = "${volumeName}"
  destination = "/data"

[env]
  AGENT_NAME = "${name}"
  LOG_LEVEL = "INFO"
`;
}
