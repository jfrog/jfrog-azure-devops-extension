// utils.d.ts
import * as ifm from 'typed-rest-client/Interfaces';
import { IExecSyncResult } from 'azure-pipelines-task-lib/toolrunner';

declare module '@jfrog/tasks-utils' {
    export function executeCliTask(
        runTaskFunc: (cliPath: string) => void,
        cliVersion?: string,
        cliDownloadUrl?: string,
        cliAuthHandlers?: ifm.IRequestHandler[]
    ): void;
    export function quote(str: string): string;
    export function downloadCli(cliDownloadUrl?: string, cliAuthHandlers?: ifm.IRequestHandler[], cliVersion?: string): Promise<string>;
    export function cliJoin(...args: string[]): string;
    export function fixWindowsPaths(string: string): string;
    export function encodePath(str: string): string;
    export function getArchitecture(): string;
    export function determineCliWorkDir(defaultPath: string, providedPath: string): string;
    export function compareVersions(version1: string, version2: string): number;
    export function executeCliCommand(cliCommand: string, runningDir: string, stdio?: string | any[]): IExecSyncResult;
    export function handleSpecFile(cliCommand: string, specPath: string): string;
    export function addBoolParam(cliCommand: string, inputParam: string, cliParam: string): string;
    export function addStringParam(cliCommand: string, inputParam: string, cliParam: string, require: boolean): string;
    export function createBuildToolConfigFile(
        cliPath: string,
        cmd: string,
        requiredWorkDir: string,
        configCommand: string,
        repoResolver: string,
        repoDeploy: string
    ): string[];
    export function addProjectOption(cliCommand: string): string;
    export function addServerIdOption(cliCommand: string, serverId: string): string;
    export function assembleUniqueServerId(usageType: string): string;
    export function configureDefaultXrayServer(usageType: string, cliPath: string, workDir: string): string;
    export function configureDefaultDistributionServer(usageType: string, cliPath: string, workDir: string): string;
    export function taskDefaultCleanup(cliPath: string, workDir: string, serverIdsArray: string[]): string;
    export { taskSelectedCliVersionEnv };
}
