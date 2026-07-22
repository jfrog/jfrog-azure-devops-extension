// utils.d.ts
import * as ifm from 'typed-rest-client/Interfaces';

declare module '@jfrog/tasks-utils' {
    export function executeCliTask(
        runTaskFunc: (cliPath: string) => void | Promise<void>,
        cliVersion?: string,
        cliDownloadUrl?: string,
        cliAuthHandlers?: ifm.IRequestHandler[] | (() => Promise<ifm.IRequestHandler[]>),
    ): void;
    export function quote(str: string): string;
    export function downloadCli(cliDownloadUrl?: string, cliAuthHandlers?: ifm.IRequestHandler[], cliVersion?: string): Promise<string>;
    export function cliJoin(...args: string[]): string;
    export function fixWindowsPaths(string: string): string;
    export function encodePath(str: string): string;
    export function getArchitecture(): string;
    export function getJfrogFolderPath(): string;
    export function getCustomFolderPath(): string;
    export function getCustomCliPath(): string;
    export function determineCliWorkDir(defaultPath: string, providedPath: string): string;
    export function compareVersions(version1: string, version2: string): number;
    export function executeCliCommand(cliCommand: string, runningDir: string, options?: {}): string;
    export function handleSpecFile(cliCommand: string, specPath: string): string;
    export function addBoolParam(cliCommand: string, inputParam: string, cliParam: string): string;
    export function addStringParam(cliCommand: string, inputParam: string, cliParam: string, require: boolean): string;
    export function addIntParam(cliCommand: string, inputParam: string, cliParam: string): string;
    export function addProjectOption(cliCommand: string): string;
    export function addServerIdOption(cliCommand: string, serverId: string): string;
    export function assembleUniqueServerId(usageType: string): string;
    export function taskDefaultCleanup(cliPath: string, workDir: string, serverIdsArray: string[]): string;
    export function appendBuildFlagsToCliCommand(cliCommand: string): string;
    export function isToolExists(tool: string): boolean;
    export function removeExtractorsDownloadVariables(cliPath: string, workDir: string): void;
    export function configureArtifactoryCliServer(artifactoryService: string, serverId: string, cliPath: string, buildDir: string): Promise<void>;
    export function configureDistributionCliServer(distributionService: string, serverId: string, cliPath: string, buildDir: string): Promise<void>;
    export function configureXrayCliServer(xrayService: string, serverId: string, cliPath: string, buildDir: string): Promise<void>;
    export function configureJfrogCliServer(jfrogService: string, serverId: string, cliPath: string, buildDir: string): Promise<void>;
    export function configureDefaultJfrogServer(serverId: string, cliPath: string, workDir: string): Promise<boolean>;
    export function configureDefaultArtifactoryServer(usageType: string, cliPath: string, workDir: string): Promise<string>;
    export function configureDefaultDistributionServer(usageType: string, cliPath: string, workDir: string): Promise<string>;
    export function configureDefaultXrayServer(usageType: string, cliPath: string, workDir: string): Promise<string>;
    export function createBuildToolConfigFile(
        cliPath: string,
        cmd: string,
        requiredWorkDir: string,
        configCommand: string,
        repoResolver: string,
        repoDeploy: string,
    ): Promise<string[]>;
    export function fetchOidcTokenIfConfigured(service: string, cliPath: string, buildDir: string): Promise<string | undefined>;
    export function forwardProxyToEnv(): void;
    export function getProxyConfiguration(): object;
    export function setJdkHomeForJavaTasks(): void;
    export function fetchAzureOidcToken(serviceConnectionID: string): Promise<string>;
    export function exchangeOidcTokenAndSetStepVariables(
        service: string,
        serviceUrl: string,
        oidcProviderName: string,
        cliPath: string,
        buildDir: string,
    ): Promise<string>;
    export function parsePlatformUrlFromServiceUrl(serviceUrl: string): string;
    export function addTrailingSlashIfNeeded(str: string): string;
    export function buildCliArtifactoryDownloadUrl(rtUrl: string, repoName: string, cliVersion?: string): string;
    export function createAuthHandlers(serviceConnection: string): ifm.IRequestHandler[];
    export function createCliDownloadAuthHandlers(serviceConnection: string, exchangeFn?: (service: string, platformUrl: string, oidcProviderName: string) => Promise<string>,): Promise<ifm.IRequestHandler[]>;
    export function exchangeOidcTokenViaRest(service: string, platformUrl: string, oidcProviderName: string): Promise<string>;
    export function isOidcConnection(serviceConnection: string): boolean;
    export function resolvePlatformUrl(service: string): string;
    export function stripTrailingSlash(str: string): string;
    export function writeSpecContentToSpecPath(specSource: string, specPath: string): void;
    export function addCommonGenericParams(cliCommand: string, specPath: string): string;
    export function isServerIdEnvSupported(): boolean;
    export function useCliServer(serverId: string, cliPath: string, buildDir: string): void;
    export function getCurrentTimestamp(): number;
    export function isWindows(): boolean;
    export function singleQuote(str: string): string;
    export function syncRequestWithRetry(method: string, url: string, options?: object, maxRetries?: number, retryDelay?: number): object;
    export const minCustomCliVersion: string;
    export const pipelineRequestedCliVersionEnv: string;
    export const taskSelectedCliVersionEnv: string;
    export const extractorsRemoteEnv: string;
    export const jfrogCliToolName: string;
}
