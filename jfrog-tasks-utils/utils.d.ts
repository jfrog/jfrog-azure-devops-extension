// utils.d.ts
import * as ifm from 'typed-rest-client/Interfaces';

declare module '@jfrog/tasks-utils' {
    export function executeCliTask(
        runTaskFunc: (cliPath: string) => void,
        cliVersion?: string,
        cliDownloadUrl?: string,
        cliAuthHandlers?: ifm.IRequestHandler[],
    ): void;
    export function quote(str: string): string;
    export function downloadCli(cliDownloadUrl?: string, cliAuthHandlers?: ifm.IRequestHandler[], cliVersion?: string): Promise<string>;
    export function cliJoin(...args: string[]): string;
    export function fixWindowsPaths(string: string): string;
    export function encodePath(str: string): string;
    export function getArchitecture(): string;
    export function determineCliWorkDir(defaultPath: string, providedPath: string): string;
    export function compareVersions(version1: string, version2: string): number;
    export function executeCliCommand(cliCommand: string, runningDir: string, options?: {}): string;
    export function handleSpecFile(cliCommand: string, specPath: string): string;
    export function addBoolParam(cliCommand: string, inputParam: string, cliParam: string): string;
    export function addStringParam(cliCommand: string, inputParam: string, cliParam: string, require: boolean): string;
    export function addIntParam(cliCommand: string, inputParam: string, cliParam: string): string;
    export function createBuildToolConfigFile(
        cliPath: string,
        cmd: string,
        requiredWorkDir: string,
        configCommand: string,
        repoResolver: string,
        repoDeploy: string,
    ): string[];
    export function addProjectOption(cliCommand: string): string;
    export function addServerIdOption(cliCommand: string, serverId: string): string;
    export function assembleUniqueServerId(usageType: string): string;
    export function configureDefaultXrayServer(usageType: string, cliPath: string, workDir: string): string;
    export function configureDefaultArtifactoryServer(usageType: string, cliPath: string, workDir: string): string;
    export function configureDefaultDistributionServer(usageType: string, cliPath: string, workDir: string): string;
    export function taskDefaultCleanup(cliPath: string, workDir: string, serverIdsArray: string[]): string;
    export function appendBuildFlagsToCliCommand(cliCommand: string): string;
    export function appendOptionsToCliCommand(cliCommand: string): string;
    export function isToolExists(tool: string): boolean;
    export function removeExtractorsDownloadVariables(cliPath: string, workDir: string);
    export function configureArtifactoryCliServer(artifactoryService: string, serverId: string, cliPath: string, buildDir: string);
    export function setJdkHomeForJavaTasks();

    export { taskSelectedCliVersionEnv };
}
