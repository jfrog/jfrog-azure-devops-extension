// utils.d.ts
import * as ifm from 'typed-rest-client/Interfaces';
import { IExecSyncResult } from 'azure-pipelines-task-lib/toolrunner';

declare module 'artifactory-tasks-utils' {
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
    export function deleteCliServers(cliPath: string, buildDir: string, serverIdArray: string[]): void;
    export function addDistUrlAndCredentialsParams(cliCommand: string, distributionService: string): string;
    export function handleSpecFile(cliCommand: string, specPath: string): string;
    export function addBoolParam(cliCommand: string, inputParam: string, cliParam: string): string;
    export function addStringParam(cliCommand: string, inputParam: string, cliParam: string, require: boolean): string;
    export function createBuildToolConfigFile(
        cliPath: string,
        artifactoryService: any,
        cmd: string,
        requiredWorkDir: string,
        configCommand: string,
        repoResolver: string,
        repoDeploy: string
    ): string[];
    export { taskSelectedCliVersionEnv };
}
