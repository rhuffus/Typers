export interface NestBuildOptions {
  cwd?: string;
  project?: string;
  config?: string;
  path?: string;
  compilerPackage?: "typescript" | "@typers/compiler";
}

export interface NestBuildDiagnostic {
  readonly fileName?: string;
  readonly pos: number;
  readonly end: number;
  readonly code: number;
  readonly category: number;
  readonly text: string;
  readonly messageChain?: readonly NestBuildDiagnostic[];
  readonly relatedInformation?: readonly NestBuildDiagnostic[];
}

export interface NestBuildResult {
  readonly success: boolean;
  readonly emitSkipped: boolean;
  readonly diagnostics: readonly NestBuildDiagnostic[];
  readonly configFile: string | null;
  readonly tsconfig: string;
  readonly project: string | undefined;
  readonly compiler: { readonly name: string; readonly version: string; readonly packagePath: string };
  readonly emittedFiles: readonly string[];
  readonly assetFiles: readonly string[];
}

/** Build one Nest project with its installed Typers compiler. Configuration and IO failures throw. */
export function buildNest(options?: NestBuildOptions): Promise<NestBuildResult>;
