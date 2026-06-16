import type { ProjectDiscoveryOptions } from "../core/discoverProject.js";

export type CliCommand = "show" | "index" | "export";

export type CliOptions = {
  command: CliCommand;
  targetPath?: string;
  projectPath?: string;
  outPath?: string;
  help: boolean;
};

const commands = new Set<string>(["show", "index", "export"]);

function readFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("-")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

export function parseCliArgs(args: string[]): CliOptions {
  if (args.includes("--help") || args.includes("-h")) {
    return {
      command: "show",
      help: true
    };
  }

  const first = args[0];
  const command: CliCommand =
    first !== undefined && commands.has(first) ? (first as CliCommand) : "show";
  const rest = command === first ? args.slice(1) : args;
  const positional: string[] = [];
  let projectPath: string | undefined;
  let outPath: string | undefined;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--project") {
      projectPath = readFlagValue(rest, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--out") {
      outPath = readFlagValue(rest, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positional.push(arg);
  }

  if (positional.length > 1) {
    throw new Error(`Expected at most one target path, received ${positional.length}`);
  }

  return {
    command,
    ...(positional[0] === undefined ? {} : { targetPath: positional[0] }),
    ...(projectPath === undefined ? {} : { projectPath }),
    ...(outPath === undefined ? {} : { outPath }),
    help: false
  };
}

export function toProjectDiscoveryOptions(
  options: CliOptions
): ProjectDiscoveryOptions {
  return {
    ...(options.targetPath === undefined ? {} : { targetPath: options.targetPath }),
    ...(options.projectPath === undefined ? {} : { projectPath: options.projectPath })
  };
}
