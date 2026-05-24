export type ExecutionMode = 'local' | 'api';

export type DockerMode = 'skip' | 'manage';

export type OrchestratorOptions = {
  execution: ExecutionMode;
  docker: DockerMode;
  clientsApiUrl?: string;
  runtimeApiUrl?: string;
  baseUrl?: string;
  composeFile?: string;
  projectName?: string;
  buildImages?: boolean;
};

export function parseOrchestratorOptions(argv = process.argv.slice(2)): OrchestratorOptions {
  const options: OrchestratorOptions = {
    execution: (process.env['BENCH_EXECUTION'] as ExecutionMode) ?? 'local',
    docker: (process.env['BENCH_DOCKER'] as DockerMode) ?? 'skip',
    clientsApiUrl: process.env['CLIENTS_API_URL'],
    runtimeApiUrl: process.env['RUNTIME_API_URL'],
    baseUrl: process.env['PLAYWRIGHT_BASE_URL'],
    composeFile: process.env['BENCH_COMPOSE_FILE'],
    projectName: process.env['BENCH_DOCKER_PROJECT'],
    buildImages: process.env['BENCH_DOCKER_BUILD'] !== '0',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--execution' && argv[i + 1]) {
      options.execution = argv[++i] as ExecutionMode;
    } else if (arg === '--docker' && argv[i + 1]) {
      options.docker = argv[++i] as DockerMode;
    } else if (arg === '--clients-api-url' && argv[i + 1]) {
      options.clientsApiUrl = argv[++i];
    } else if (arg === '--runtime-api-url' && argv[i + 1]) {
      options.runtimeApiUrl = argv[++i];
    } else if (arg === '--base-url' && argv[i + 1]) {
      options.baseUrl = argv[++i];
    } else if (arg === '--compose-file' && argv[i + 1]) {
      options.composeFile = argv[++i];
    } else if (arg === '--project' && argv[i + 1]) {
      options.projectName = argv[++i];
    } else if (arg === '--no-build') {
      options.buildImages = false;
    }
  }

  if (options.docker === 'manage' && !options.baseUrl && !process.env['PLAYWRIGHT_BASE_URL']) {
    options.execution = options.execution ?? 'local';
  }

  return options;
}
