const fs = require('fs');
const tl = require('azure-pipelines-task-lib/task');
const { join, sep, isAbsolute } = require('path');
const execSync = require('child_process').execSync;
const toolLib = require('azure-pipelines-tool-lib/tool');
const credentialsHandler = require('typed-rest-client/Handlers');
const httpm = require('typed-rest-client/HttpClient');
const findJavaHome = require('azure-pipelines-tasks-java-common/java-common').findJavaHome;
const syncRequest = require('sync-request');
const semver = require('semver');
const fileName = getCliExecutableName();
const jfrogCliToolName = 'jf';
const cliPackage = 'jfrog-cli-' + getArchitecture();
const fallbackCliVersion = '2.99.0';
let defaultJfrogCliVersion = '2.124.0';

/**
 * Executes an HTTP request with retry logic for 5xx errors.
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} url - Request URL
 * @param {object} options - Request options (timeout, headers, etc.)
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} retryDelay - Delay between retries in ms (default: 1000)
 * @returns {object} Response object from syncRequest on success
 * @throws {Error} If all retries fail (network errors or 5xx responses)
 */
function syncRequestWithRetry(method, url, options = {}, maxRetries = 3, retryDelay = 1000) {
    let errorToThrow = null;
    let lastResponse = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = syncRequest(method, url, options);
            // Retry on 5xx server errors
            const statusCode = response && response.statusCode;
            if (statusCode >= 500 && statusCode < 600) {
                tl.debug(`Attempt ${attempt}/${maxRetries}: Server error ${statusCode} for ${url}`);
                lastResponse = response;
            } else {
                return response;
            }
        } catch (err) {
            const errMessage = err && err.message;
            tl.debug(`Attempt ${attempt}/${maxRetries}: Request failed for ${url} - ${errMessage}`);
            errorToThrow = err;
        }

        if (attempt < maxRetries) {
            // Blocking delay before retry
            const waitUntil = Date.now() + retryDelay;
            while (Date.now() < waitUntil) {
                /* wait */
            }
        }
    }

    // All retries exhausted - throw error for both network failures and 5xx responses
    if (errorToThrow) {
        throw errorToThrow;
    }
    if (lastResponse) {
        throw new Error(`Server error ${lastResponse.statusCode} after ${maxRetries} retries for ${url}`);
    }
}

/**
 * Checks if the CLI binary exists on releases.jfrog.io for the given version.
 * @param {string} version - The CLI version to check
 * @returns {boolean} True if binary exists, false otherwise
 */
function isCliBinaryAvailable(version) {
    const binaryUrl = `https://releases.jfrog.io/artifactory/jfrog-cli/v2-jf/${version}/${cliPackage}/${fileName}`;
    try {
        tl.debug('Verifying CLI binary availability at: ' + binaryUrl);
        const res = syncRequestWithRetry('HEAD', binaryUrl, { timeout: 5000 });
        return res && res.statusCode === 200;
    } catch (err) {
        tl.debug('Failed to verify CLI binary availability: ' + (err && err.message));
        return false;
    }
}

/**
 * Fetches the latest available JFrog CLI version from GitHub releases with retry mechanism.
 * Validates that the binary is available on releases.jfrog.io before returning.
 * If the latest release binary isn't available, falls back to the previous release.
 * Called once during module initialization. Result is cached in defaultJfrogCliVersion.
 * @returns {string} The CLI version (e.g., '2.89.0') or fallback if fetch fails or no binary available
 */
function fetchLatestCliVersion() {
    try {
        tl.debug('Fetching JFrog CLI releases from https://api.github.com/repos/jfrog/jfrog-cli/releases');
        const res = syncRequestWithRetry('GET', 'https://api.github.com/repos/jfrog/jfrog-cli/releases?per_page=3', {
            headers: { 'User-Agent': 'jfrog-azure-devops-extension' },
            timeout: 5000,
        });
        if (res.statusCode === 200) {
            const releases = JSON.parse(res.getBody('utf8'));
            tl.debug('Fetched ' + (releases ? releases.length : 0) + ' JFrog CLI releases');

            if (!releases || releases.length === 0) {
                tl.debug('No JFrog CLI releases found, using fallback: ' + fallbackCliVersion);
                return fallbackCliVersion;
            }

            // Try each release until we find one with an available binary
            for (const release of releases) {
                const version = release && release.name;
                tl.debug('Checking CLI version: ' + version);

                if (version && isCliBinaryAvailable(version)) {
                    tl.debug('CLI binary verified available for version: ' + version);
                    return version;
                }
                tl.debug('CLI binary not yet available for version: ' + version);
            }
            tl.debug('No CLI binaries available for last 3 releases, using fallback: ' + fallbackCliVersion);
            return fallbackCliVersion;
        }
        tl.debug('Unexpected status code: ' + res.statusCode + ', using fallback version: ' + fallbackCliVersion);
    } catch (err) {
        tl.debug('Failed to fetch JFrog CLI releases, due to error: ' + (err && err.message) + ', using fallback: ' + fallbackCliVersion);
    }
    return fallbackCliVersion;
}

/**
 * Safely constructs the JFrog tools directory path, handling potential issues with Agent.ToolsDirectory
 */
function getJfrogFolderPath() {
    let toolsDir = tl.getVariable('Agent.ToolsDirectory') || '';

    // Clean up any malformed quotes and path separators (Windows-specific Azure DevOps issues)
    if (toolsDir && isWindows()) {
        toolsDir = toolsDir.replace(/"/g, '').replace(/[/\\]+/g, sep);
    }

    const rawPath = join(toolsDir, '_jf');
    return encodePath(rawPath);
}

let jfrogFolderPath = getJfrogFolderPath();
const minCustomCliVersion = '2.10.0';
const minSupportedStdinSecretCliVersion = '2.36.0';
const minSupportedServerIdEnvCliVersion = '2.37.0';
const minSupportedOidcCliVersion = '2.75.0';
const pluginVersion = '2.14.2';
const buildAgent = 'jfrog-azure-devops-extension';

/**
 * Get the custom folder path, dynamically calculated based on current jfrogFolderPath
 */
function getCustomFolderPath() {
    return encodePath(join(jfrogFolderPath, 'current'));
}

/**
 * Get the custom CLI path, dynamically calculated based on current paths
 */
function getCustomCliPath() {
    return encodePath(join(getCustomFolderPath(), fileName));
}
const jfrogCliReleasesUrl = 'https://releases.jfrog.io/artifactory/jfrog-cli/v2-jf';
const oidcUserOutputName = 'oidc_user';
const oidcTokenOutputName = 'oidc_token';

// Set by Tools Installer Task. This JFrog CLI version will be used in all tasks unless manual installation is used,
// or a specific version was requested in a task. If not set, use the default CLI version.
const pipelineRequestedCliVersionEnv = 'JFROG_CLI_PIPELINE_REQUESTED_VERSION_AZURE';
// The actual JFrog CLI version used in a task.
const taskSelectedCliVersionEnv = 'JFROG_CLI_TASK_SELECTED_VERSION_AZURE';

// Maven/Gradle Extractors Env:
const extractorsRemoteEnv = 'JFROG_CLI_EXTRACTORS_REMOTE';

// Config commands:
const jfrogCliConfigAddCommand = 'c add';
const jfrogCliConfigRmCommand = 'c remove';
const jfrogCliConfigUseCommand = 'c use';

let runTaskCbk = null;

module.exports = {
    syncRequestWithRetry: syncRequestWithRetry,
    isCliBinaryAvailable: isCliBinaryAvailable,
    fetchLatestCliVersion: fetchLatestCliVersion,
    executeCliTask: executeCliTask,
    executeCliCommand: executeCliCommand,
    downloadCli: downloadCli,
    cliJoin: cliJoin,
    quote: quote,
    singleQuote: singleQuote,
    isWindows: isWindows,
    addStringParam: addStringParam,
    addBoolParam: addBoolParam,
    addIntParam: addIntParam,
    addCommonGenericParams: addCommonGenericParams,
    fixWindowsPaths: fixWindowsPaths,
    encodePath: encodePath,
    getArchitecture: getArchitecture,
    isToolExists: isToolExists,
    buildCliArtifactoryDownloadUrl: buildCliArtifactoryDownloadUrl,
    createAuthHandlers: createAuthHandlers,
    createCliDownloadAuthHandlers: createCliDownloadAuthHandlers,
    exchangeOidcTokenViaRest: exchangeOidcTokenViaRest,
    isOidcConnection: isOidcConnection,
    resolvePlatformUrl: resolvePlatformUrl,
    taskDefaultCleanup: taskDefaultCleanup,
    writeSpecContentToSpecPath: writeSpecContentToSpecPath,
    stripTrailingSlash: stripTrailingSlash,
    determineCliWorkDir: determineCliWorkDir,
    createBuildToolConfigFile: createBuildToolConfigFile,
    assembleUniqueServerId: assembleUniqueServerId,
    appendBuildFlagsToCliCommand: appendBuildFlagsToCliCommand,
    getJfrogFolderPath: getJfrogFolderPath,
    getCustomFolderPath: getCustomFolderPath,
    getCustomCliPath: getCustomCliPath,
    compareVersions: compareVersions,
    addTrailingSlashIfNeeded: addTrailingSlashIfNeeded,
    useCliServer: useCliServer,
    getCurrentTimestamp: getCurrentTimestamp,
    removeExtractorsDownloadVariables: removeExtractorsDownloadVariables,
    handleSpecFile: handleSpecFile,
    addProjectOption: addProjectOption,
    addServerIdOption: addServerIdOption,
    configureArtifactoryCliServer: configureArtifactoryCliServer,
    configureJfrogCliServer: configureJfrogCliServer,
    configureDefaultJfrogServer: configureDefaultJfrogServer,
    forwardProxyToEnv: forwardProxyToEnv,
    getProxyConfiguration: getProxyConfiguration,
    fetchAzureOidcToken: fetchAzureOidcToken,
    configureDefaultArtifactoryServer: configureDefaultArtifactoryServer,
    configureDefaultDistributionServer: configureDefaultDistributionServer,
    configureDefaultXrayServer: configureDefaultXrayServer,
    minCustomCliVersion: minCustomCliVersion,
    defaultJfrogCliVersion: defaultJfrogCliVersion,
    fallbackCliVersion: fallbackCliVersion,
    pipelineRequestedCliVersionEnv: pipelineRequestedCliVersionEnv,
    taskSelectedCliVersionEnv: taskSelectedCliVersionEnv,
    extractorsRemoteEnv: extractorsRemoteEnv,
    jfrogCliToolName: jfrogCliToolName,
    isServerIdEnvSupported: isServerIdEnvSupported,
    setJdkHomeForJavaTasks: setJdkHomeForJavaTasks,
    parsePlatformUrlFromServiceUrl: parsePlatformUrlFromServiceUrl,
};

/**
 * Executes a CLI task, downloads the CLI if necessary.
 * @param runTaskFunc - Task to run.
 * @param cliVersion - Specific CLI version to use in the current task execution.
 * @param cliDownloadUrl - [Optional, Default - releases.jfrog.io] - URL to download the required CLI executable from.
 * @param cliAuthHandlers - [Optional, Default - Anonymous] - Authentication handlers to download CLI with.
 */
function executeCliTask(runTaskFunc, cliVersion, cliDownloadUrl, cliAuthHandlers) {
    process.env.JFROG_CLI_HOME = jfrogFolderPath;
    process.env.JFROG_CLI_OFFER_CONFIG = 'false';
    process.env.JFROG_CLI_USER_AGENT = buildAgent + '/' + pluginVersion;
    process.env.CI = 'true';

    if (!cliVersion) {
        // If CLI version is passed, use it. Otherwise, use requested version from env var if set. Else, default version.
        cliVersion = tl.getVariable(pipelineRequestedCliVersionEnv) || defaultJfrogCliVersion;
    }
    // If unspecified, download from 'releases.jfrog.io' by default.
    if (!cliDownloadUrl) {
        cliDownloadUrl = buildReleasesDownloadUrl(cliVersion);
        cliAuthHandlers = [];
    }

    runTaskCbk = runTaskFunc;
    getCliPath(cliDownloadUrl, cliAuthHandlers, cliVersion)
        .then(async (cliPath) => {
            await runCbk(cliPath);
            collectEnvVarsIfNeeded(cliPath);
        })
        .catch((error) => tl.setResult(tl.TaskResult.Failed, 'Error occurred while executing task: ' + error));
}

function getCliPath(cliDownloadUrl, cliAuthHandlers, cliVersion) {
    return new Promise(function (resolve, reject) {
        let cliDir = toolLib.findLocalTool(jfrogCliToolName, cliVersion);
        if (fs.existsSync(getCustomCliPath())) {
            tl.debug('Using JFrog CLI from the custom CLI path: ' + getCustomCliPath());
            resolve(getCustomCliPath());
        } else if (cliDir) {
            let cliPath = join(cliDir, fileName);
            tl.debug('Using existing versioned cli path: ' + cliPath);
            resolve(cliPath);
        } else {
            const errMsg = generateDownloadCliErrorMessage(cliDownloadUrl, cliVersion);
            createCliDirs();
            // cliAuthHandlers may be an array or a provider function returning a Promise<array>.
            // Resolve it lazily here so that work such as an OIDC token exchange only happens
            // when a download is actually required — never when the CLI is already cached.
            return Promise.resolve(typeof cliAuthHandlers === 'function' ? cliAuthHandlers() : cliAuthHandlers)
                .then((resolvedHandlers) => downloadCli(cliDownloadUrl, resolvedHandlers, cliVersion))
                .then((cliPath) => resolve(cliPath))
                .catch((error) => reject(errMsg + '\n' + error));
        }
    });
}

function buildCliArtifactoryDownloadUrl(rtUrl, repoName, cliVersion = defaultJfrogCliVersion) {
    return addTrailingSlashIfNeeded(rtUrl) + repoName + '/' + getCliExePathInArtifactory(cliVersion);
}

function addTrailingSlashIfNeeded(str) {
    if (str.slice(-1) !== '/') {
        str += '/';
    }
    return str;
}

function buildReleasesDownloadUrl(cliVersion = defaultJfrogCliVersion) {
    return jfrogCliReleasesUrl + '/' + getCliExePathInArtifactory(cliVersion);
}

function getCliExePathInArtifactory(cliVersion) {
    return cliVersion + '/' + cliPackage + '/' + fileName;
}

function createAuthHandlers(serviceConnection) {
    let artifactoryUser = tl.getEndpointAuthorizationParameter(serviceConnection, 'username', true);
    let artifactoryPassword = tl.getEndpointAuthorizationParameter(serviceConnection, 'password', true);
    let artifactoryAccessToken = tl.getEndpointAuthorizationParameter(serviceConnection, 'apitoken', true);

    // Check if Artifactory should be accessed using access-token.
    if (artifactoryAccessToken) {
        return [new credentialsHandler.BearerCredentialHandler(artifactoryAccessToken, false)];
    }

    // Check if Artifactory should be accessed anonymously.
    if (!artifactoryUser) {
        return [];
    }

    // Use basic authentication.
    return [new credentialsHandler.BasicCredentialHandler(artifactoryUser, artifactoryPassword, false)];
}

/**
 * Returns whether the given service connection uses OIDC authentication.
 * @param {string} serviceConnection - The service connection ID.
 * @returns {boolean}
 */
function isOidcConnection(serviceConnection) {
    return !!tl.getEndpointAuthorizationParameter(serviceConnection, 'oidcProviderName', true);
}

/**
 * Builds the authentication handlers used to download the JFrog CLI.
 *
 * For OIDC-based service connections the credential does not exist as a static
 * token — it must be obtained through an OIDC token exchange. The CLI-based
 * exchange (exchangeOidcTokenAndSetStepVariables) cannot be used here because the
 * CLI is the very artifact being downloaded, so this performs a CLI-independent
 * REST exchange (exchangeOidcTokenViaRest) and authenticates the download with the
 * resulting access token. For all other connection types it falls back to the
 * synchronous createAuthHandlers (access token / basic / anonymous).
 *
 * @param {string} serviceConnection - The Artifactory service connection ID.
 * @param {(service: string, platformUrl: string, oidcProviderName: string) => Promise<string>} [exchangeFn]
 *        - OIDC exchange implementation; injectable for testing. Defaults to exchangeOidcTokenViaRest.
 * @returns {Promise<Array>} Authentication handlers for the CLI download.
 */
async function createCliDownloadAuthHandlers(serviceConnection, exchangeFn = exchangeOidcTokenViaRest) {
    if (!isOidcConnection(serviceConnection)) {
        return createAuthHandlers(serviceConnection);
    }
    const platformUrl = resolvePlatformUrl(serviceConnection);
    const oidcProviderName = tl.getEndpointAuthorizationParameter(serviceConnection, 'oidcProviderName', true);
    const accessToken = await exchangeFn(serviceConnection, platformUrl, oidcProviderName);
    return [new credentialsHandler.BearerCredentialHandler(accessToken, false)];
}

function generateDownloadCliErrorMessage(downloadUrl, cliVersion) {
    let errMsg = 'Failed while attempting to download JFrog CLI from ' + downloadUrl;
    if (downloadUrl === buildReleasesDownloadUrl(cliVersion)) {
        errMsg +=
            "\nIf this build agent cannot access the internet, you may use the 'Artifactory Tools Installer' task, to download JFrog CLI through an Artifactory repository, \nwhich proxies " +
            buildReleasesDownloadUrl(cliVersion) +
            '\nYou ';
    } else {
        errMsg += '\nIf the chosen Artifactory Service cannot access the internet, you ';
    }
    errMsg +=
        'may also manually download version ' + cliVersion + ' of JFrog CLI and place it on the agent in the following path: ' + getCustomCliPath();
    return errMsg;
}

/**
 * Execute provided CLI command in a child process. In order to receive execution's stdout, pass stdio=null.
 * @param {string} cliCommand
 * @param {string} runningDir
 * @param {object} options - secret to be provided vi stdin.
 * @param {{
 *   stdinSecret?: string;
 *   withOutput?: boolean
 *   }} [options]
 * @returns {Buffer|string} - execSync output.
 * @throws In CLI execution failure.
 */
function executeCliCommand(cliCommand, runningDir, options = {}) {
    if (!fs.existsSync(runningDir)) {
        throw "JFrog CLI execution path doesn't exist: " + runningDir;
    }
    if (!cliCommand) {
        throw 'Cannot execute empty Cli command.';
    }
    try {
        const stdin = options.stdinSecret ? 'pipe' : 0;
        const stdout = options.withOutput ? 'pipe' : 1;
        const stderr = 2;
        console.log('Executing JFrog CLI Command:\n' + maskSecrets(cliCommand));
        return execSync(cliCommand, { cwd: runningDir, stdio: [stdin, stdout, stderr], input: options.stdinSecret });
    } catch (ex) {
        // Error occurred - mask secrets in message.
        if (ex.message) {
            ex.message = maskSecrets(ex.message);
        }
        // Throwing the same error to allow relying on its original exit code and stack trace.
        throw ex;
    }
}

/**
 * Mask password and access token in a CLI command or exception.
 * @param str - CLI command or exception
 * @returns {string}
 */
function maskSecrets(str) {
    return str
        .replace(/--password=".*?"/g, '--password=***')
        .replace(/--access-token=".*?"/g, '--access-token=***')
        .replace(/--password='.*?'/g, '--password=***')
        .replace(/--access-token='.*?'/g, '--access-token=***');
}

/**
 * Resolves the JFrog platform URL for a service connection. Prefers the explicit
 * 'jfrogPlatformUrl' authorization parameter and falls back to parsing it from the
 * service URL.
 * @param {string} service - The service connection ID.
 * @returns {string} The resolved platform URL.
 */
function resolvePlatformUrl(service) {
    const serviceUrl = tl.getEndpointUrl(service, false);
    let platformUrl = '';
    try {
        platformUrl = tl.getEndpointAuthorizationParameter(service, 'jfrogPlatformUrl', true);
    } catch (error) {
        console.warn('Failed to get platform url from field: ' + error + '\nparsing from url instead');
    }
    if (!platformUrl || !platformUrl.trim()) {
        platformUrl = parsePlatformUrlFromServiceUrl(serviceUrl);
    }
    return platformUrl;
}

async function fetchOidcTokenIfConfigured(service, cliPath, buildDir) {
    if (!isOidcConnection(service)) {
        return undefined;
    }
    const oidcProviderName = tl.getEndpointAuthorizationParameter(service, 'oidcProviderName', true);
    const platformUrl = resolvePlatformUrl(service);
    return exchangeOidcTokenAndSetStepVariables(service, platformUrl, oidcProviderName, cliPath, buildDir);
}

async function configureJfrogCliServer(jfrogService, serverId, cliPath, buildDir) {
    const oidcAccessToken = await fetchOidcTokenIfConfigured(jfrogService, cliPath, buildDir);
    return configureSpecificCliServer(jfrogService, '--url', serverId, cliPath, buildDir, oidcAccessToken);
}

async function configureArtifactoryCliServer(artifactoryService, serverId, cliPath, buildDir) {
    const oidcAccessToken = await fetchOidcTokenIfConfigured(artifactoryService, cliPath, buildDir);
    return configureSpecificCliServer(artifactoryService, '--artifactory-url', serverId, cliPath, buildDir, oidcAccessToken);
}

async function configureDistributionCliServer(distributionService, serverId, cliPath, buildDir) {
    const oidcAccessToken = await fetchOidcTokenIfConfigured(distributionService, cliPath, buildDir);
    return configureSpecificCliServer(distributionService, '--distribution-url', serverId, cliPath, buildDir, oidcAccessToken);
}

async function configureXrayCliServer(xrayService, serverId, cliPath, buildDir) {
    const oidcAccessToken = await fetchOidcTokenIfConfigured(xrayService, cliPath, buildDir);
    return configureSpecificCliServer(xrayService, '--xray-url', serverId, cliPath, buildDir, oidcAccessToken);
}

/**
 * logging oidc token values for debugging
 * @param oidcToken
 */
function debugLogIDToken(oidcToken) {
    /**
     * @typedef {Object} OidcClaims
     * @property {string} sub - The subject of the token.
     * @property {string} iss - The issuer of the token.
     * @property {string} aud - The audience of the token.
     */

    /** @type {OidcClaims} */
    const oidcClaims = JSON.parse(Buffer.from(oidcToken.split('.')[1], 'base64').toString());
    console.debug('OIDC Token Subject: ', oidcClaims.sub);
    console.debug(`OIDC Token Claims: {"sub": "${oidcClaims.sub}"}`);
    console.debug('OIDC Token Issuer (Provider URL): ', oidcClaims.iss);
    console.debug('OIDC Token Audience: ', oidcClaims.aud);
}

/**
 * Forwards Azure DevOps proxy configuration to environment variables.
 * Sets HTTP_PROXY and HTTPS_PROXY if they are not already set, allowing
 * JFrog CLI and other tools to use the proxy configuration.
 * Also sets NO_PROXY from Agent.ProxyBypassList if not already set, so that
 * internal hosts are not routed through the proxy.
 */
function forwardProxyToEnv() {
    let proxyUrl = tl.getVariable('Agent.ProxyUrl');
    if (!proxyUrl) {
        return;
    }

    // Build proxy URL with auth if provided
    let proxyUsername = tl.getVariable('Agent.ProxyUsername');
    let proxyPassword = tl.getVariable('Agent.ProxyPassword');
    if (proxyUsername && proxyPassword) {
        try {
            let parsed = new URL(proxyUrl);
            parsed.username = proxyUsername;
            parsed.password = proxyPassword;
            proxyUrl = parsed.toString();
        } catch (e) {
            tl.warning('Failed to parse proxy URL, credentials will not be included: ' + e.message);
            // Fall through with the original URL (without credentials) so proxy
            // support is not lost entirely due to a malformed URL.
        }
    }

    // Only set if not already present — don't override explicit user config.
    let forwarded = false;
    if (!process.env.HTTP_PROXY && !process.env.http_proxy) {
        process.env.HTTP_PROXY = proxyUrl;
        forwarded = true;
        tl.debug('Set HTTP_PROXY from Agent.ProxyUrl');
    }
    if (!process.env.HTTPS_PROXY && !process.env.https_proxy) {
        process.env.HTTPS_PROXY = proxyUrl;
        forwarded = true;
        tl.debug('Set HTTPS_PROXY from Agent.ProxyUrl');
    }

    // Only forward the bypass list if we actually wrote at least one proxy var.
    // If the user already had their own proxy env vars, the agent's bypass list
    // belongs to the agent's proxy — not theirs — and should not be injected.
    if (!forwarded) {
        return;
    }
    const bypassList = tl.getVariable('Agent.ProxyBypassList');
    if (bypassList && !process.env.NO_PROXY && !process.env.no_proxy) {
        try {
            const hosts = JSON.parse(bypassList);
            if (Array.isArray(hosts) && hosts.length > 0) {
                // .proxybypass entries are ECMAScript regex patterns per ADO docs.
                // Only simple hostname patterns (e.g. artifactory\.corp\.com) are supported —
                // strip backslash escaping from dots to produce a plain hostname for NO_PROXY.
                // Entries containing regex special chars like * cannot be reliably converted
                // and are skipped with a warning.
                const converted = [];
                for (const h of hosts) {
                    if (/[*+?[\]()^${}|\\][^.]/.test(h) || h.includes('*')) {
                        tl.warning('Skipping Agent.ProxyBypassList entry "' + h + '": regex patterns with wildcards or special characters are not supported for NO_PROXY conversion. Use a plain hostname in your .proxybypass file instead.');
                        continue;
                    }
                    converted.push(h.replace(/\\\./g, '.'));
                }
                if (converted.length > 0) {
                    process.env.NO_PROXY = converted.join(',');
                    tl.debug('Set NO_PROXY from Agent.ProxyBypassList: ' + process.env.NO_PROXY);
                }
                tl.debug('Set NO_PROXY from Agent.ProxyBypassList: ' + process.env.NO_PROXY);
            }
        } catch (e) {
            tl.warning('Failed to parse Agent.ProxyBypassList for NO_PROXY: ' + e.message);
        }
    }
}

/**
 * Builds HTTP request options with proxy configuration.
 * Checks Azure DevOps agent proxy variables first, then falls back to
 * HTTPS_PROXY / HTTP_PROXY environment variables.
 *
 * Dual-source note: when Agent.ProxyUrl is set, this function reads it directly
 * for the typed-rest-client request (OIDC token fetch). forwardProxyToEnv()
 * separately forwards Agent.ProxyUrl into HTTP_PROXY / HTTPS_PROXY so that
 * JFrog CLI and other child processes pick it up. If a user has also set
 * HTTP_PROXY manually (and it differs from Agent.ProxyUrl), typed-rest-client
 * will use Agent.ProxyUrl while JFrog CLI will use the existing env var — by
 * design, since forwardProxyToEnv() never overrides a pre-existing env var.
 *
 * @returns {object} Request options for typed-rest-client HttpClient
 */
function getProxyConfiguration() {
    let proxyUrl = tl.getVariable('Agent.ProxyUrl');
    let proxyUsername;
    let proxyPassword;
    let proxyBypassHosts;

    if (proxyUrl) {
        tl.debug('Using proxy from Agent.ProxyUrl: ' + proxyUrl);
        proxyUsername = tl.getVariable('Agent.ProxyUsername');
        proxyPassword = tl.getVariable('Agent.ProxyPassword');
        const bypassList = tl.getVariable('Agent.ProxyBypassList');
        try {
            proxyBypassHosts = bypassList ? JSON.parse(bypassList) : undefined;
        } catch (e) {
            tl.warning('Failed to parse Agent.ProxyBypassList as JSON: ' + e.message);
            proxyBypassHosts = undefined;
        }
    } else {
        proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
        if (proxyUrl) {
            tl.debug('Using proxy from environment variable: ' + proxyUrl);
        }
    }

    if (!proxyUrl) {
        return {};
    }

    return {
        proxy: {
            proxyUrl: proxyUrl,
            proxyUsername: proxyUsername || undefined,
            proxyPassword: proxyPassword || undefined,
            proxyBypassHosts: proxyBypassHosts || undefined,
        },
    };
}

async function fetchAzureOidcToken(serviceConnectionID) {
    const uri = tl.getVariable('System.CollectionUri');
    const teamPrjID = tl.getVariable('System.TeamProjectId');
    const hub = tl.getVariable('System.HostType');
    const planID = tl.getVariable('System.PlanId');
    const jobID = tl.getVariable('System.JobId');
    const apiVersion = '7.1-preview.1';

    const token = tl.getVariable('System.AccessToken');
    if (!token) {
        throw new Error('System.AccessToken is not available. Make sure "Allow scripts to access OAuth token" is enabled.');
    }

    const url = `${uri}${teamPrjID}/_apis/distributedtask/hubs/${hub}/plans/${planID}/jobs/${jobID}/oidctoken?api-version=${apiVersion}&serviceConnectionId=${serviceConnectionID}`;

    const requestOptions = { ...getProxyConfiguration(), socketTimeout: 30000 };
    const httpClient = new httpm.HttpClient(buildAgent, [new credentialsHandler.BearerCredentialHandler(token, false)], requestOptions);
    tl.debug('Requesting OIDC token from: ' + url);
    const response = await httpClient.post(url, JSON.stringify({}), {
        'Content-Type': 'application/json',
    });

    const statusCode = response.message.statusCode;
    const responseBody = await response.readBody();

    if (statusCode !== 200) {
        throw new Error(`OIDC token request failed: HTTP ${statusCode}\nBody: ${responseBody}`);
    }
    /** @type {{ oidcToken?: string }} */
    const body = JSON.parse(responseBody);
    if (!body.oidcToken) {
        throw new Error('OIDC token not found in response body.');
    }
    debugLogIDToken(body.oidcToken);
    return body.oidcToken;
}

/**
 * Performs an OIDC token exchange WITHOUT the JFrog CLI, via a direct REST call to
 * JFrog Access. Required by the JFrog Tools Installer, which must authenticate the
 * CLI *download* itself — at that point the CLI does not yet exist, so the
 * CLI-based exchange cannot be used. The request mirrors what `jf eot` sends for an
 * Azure provider (grant_type / subject_token_type / subject_token / provider_name /
 * provider_type / audience). The Azure DevOps identity mapping is matched on the ID
 * token's subject claim, which is carried in subject_token.
 *
 * @param {string} service - The service connection ID.
 * @param {string} platformUrl - The JFrog platform base URL.
 * @param {string} oidcProviderName - The configured OIDC provider name.
 * @returns {Promise<string>} The exchanged JFrog access token.
 */
async function exchangeOidcTokenViaRest(service, platformUrl, oidcProviderName) {
    const oidcAudience = tl.getEndpointAuthorizationParameter(service, 'oidcAudience', true) || 'api://AzureADTokenExchange';
    const idToken = await fetchAzureOidcToken(service);

    const exchangeUrl = addTrailingSlashIfNeeded(platformUrl) + 'access/api/v1/oidc/token';
    const requestBody = {
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
        subject_token: idToken,
        provider_name: oidcProviderName,
        provider_type: 'Azure',
        audience: oidcAudience,
    };

    const requestOptions = { ...getProxyConfiguration(), socketTimeout: 30000 };
    const httpClient = new httpm.HttpClient(buildAgent, [], requestOptions);
    tl.debug('Exchanging OIDC token via REST at: ' + exchangeUrl);
    const response = await httpClient.post(exchangeUrl, JSON.stringify(requestBody), {
        'Content-Type': 'application/json',
    });

    const statusCode = response.message.statusCode;
    const responseBody = await response.readBody();
    if (statusCode !== 200) {
        throw new Error(`OIDC token exchange failed: HTTP ${statusCode}\nBody: ${responseBody}`);
    }
    /** @type {{ access_token?: string, username?: string }} */
    const body = JSON.parse(responseBody);
    if (!body.access_token) {
        throw new Error('OIDC token exchange response did not contain an access token.');
    }

    // Publish outputs for parity with the CLI-based OIDC flow (downstream consumption / debug).
    tl.setVariable(oidcUserOutputName, body.username || '', true);
    tl.setVariable(oidcTokenOutputName, body.access_token, true);
    return body.access_token;
}

async function exchangeOidcTokenAndSetStepVariables(service, serviceUrl, oidcProviderName, cliPath, buildDir) {
    // First validate supported CLI version
    let cliVersion = getCliVersion(cliPath);
    if (semver.lt(cliVersion, minSupportedOidcCliVersion)) {
        throw new Error(
            `The CLI version ${cliVersion} is not supported for OIDC token exchange. Minimum required version is ${minSupportedOidcCliVersion}.`,
        );
    }
    let oidcAudience = tl.getEndpointAuthorizationParameter(service, 'oidcAudience', true) || 'api://AzureADTokenExchange';
    const repoName = tl.getVariable('Build.Repository.Name');
    const idToken = await fetchAzureOidcToken(service);

    // Build the CLI command
    let cliCommand = cliJoin(
        cliPath,
        `eot ${quote(oidcProviderName)} ${quote(idToken)} --url=${quote(serviceUrl)} --oidc-provider-type=Azure --oidc-audience=${quote(oidcAudience)} --repository=${quote(repoName)}`,
    );

    // Execute the CLI command and capture the output
    let exeRes = executeCliCommand(cliCommand, buildDir, { withOutput: true }).toString();

    // Extract AccessToken
    const { username, accessToken } = extractAccessTokenAndUsername(exeRes);

    // Set output variables
    tl.setVariable(oidcUserOutputName, username, true);
    tl.setVariable(oidcTokenOutputName, accessToken, true);

    return accessToken;
}

/**
 * Extracts AccessToken and Username from the CLI output.
 * Supports both JSON and non-JSON (regex) outputs.
 * Currently, the output is a non-valid JSON, which should be changed in the future.
 * @param {string} output - The CLI output.
 * @returns {{ accessToken: string, username: string }} - Extracted values.
 * @throws {Error} - If neither JSON nor regex extraction succeeds.
 */
function extractAccessTokenAndUsername(output) {
    // Attempt to parse as JSON
    try {
        /**
         * @typedef {Object} ParsedOutput
         * @property {string} AccessToken
         * @property {string} Username
         */

        /** @type {ParsedOutput} */
        const parsedOutput = JSON.parse(output);
        if (parsedOutput.AccessToken && parsedOutput.Username) {
            return {
                accessToken: parsedOutput.AccessToken,
                username: parsedOutput.Username,
            };
        }
    } catch (e) {
        console.debug('Failed to parse output as JSON, trying with regex..');
    }

    // Fallback to regex extraction
    const accessTokenMatch = output.match(/AccessToken:\s*(\S+)/);
    const usernameMatch = output.match(/Username:\s*(\S+)/);

    if (accessTokenMatch && usernameMatch) {
        return {
            accessToken: accessTokenMatch[1],
            username: usernameMatch[1],
        };
    }

    // If both methods fail, throw an error
    throw new Error('Failed to extract AccessToken or Username from the output.');
}

function configureSpecificCliServer(service, urlFlag, serverId, cliPath, buildDir, oidcAccessToken) {
    let serviceUrl = tl.getEndpointUrl(service, false);
    let serviceUser = tl.getEndpointAuthorizationParameter(service, 'username', true);
    let servicePassword = tl.getEndpointAuthorizationParameter(service, 'password', true);
    let serviceAccessToken = oidcAccessToken || tl.getEndpointAuthorizationParameter(service, 'apitoken', true);
    let cliCommand = cliJoin(cliPath, jfrogCliConfigAddCommand, quote(serverId), urlFlag + '=' + quote(serviceUrl), '--interactive=false');
    let stdinSecret;
    let secretInStdinSupported = isStdinSecretSupported();

    if (serviceAccessToken) {
        // Add access-token if required.
        cliCommand = cliJoin(cliCommand, secretInStdinSupported ? '--access-token-stdin' : '--access-token=' + quote(serviceAccessToken));
        stdinSecret = secretInStdinSupported ? serviceAccessToken : undefined;
    } else {
        // Add username and password.
        cliCommand = cliJoin(
            cliCommand,
            '--user=' + (isWindows() ? quote(serviceUser) : singleQuote(serviceUser)),
            '--basic-auth-only',
            secretInStdinSupported ? '--password-stdin' : '--password=' + (isWindows() ? quote(servicePassword) : singleQuote(servicePassword)),
        );
        stdinSecret = secretInStdinSupported ? servicePassword : undefined;
    }
    return executeCliCommand(cliCommand, buildDir, { stdinSecret });
}

/**
 * Configure a JFrog CLI server for a JFrog platform service connection that is expected to be named 'jfrogPlatformConnection'.
 * @param serverId - Requested server ID.
 * @param cliPath - Path to JFrog CLI executable.
 * @param workDir - Working directory.
 * @returns {boolean} - Whether the server was configured or not.
 */
async function configureDefaultJfrogServer(serverId, cliPath, workDir) {
    let jfrogPlatformService = tl.getInput('jfrogPlatformConnection', false);
    if (!jfrogPlatformService) {
        return false;
    }
    await configureJfrogCliServer(jfrogPlatformService, serverId, cliPath, workDir);
    useCliServer(serverId, cliPath, workDir);
    return true;
}

/**
 * Configure a JFrog CLI server for an Artifactory service connection that is expected to be named 'artifactoryConnection'.
 * @param usageType - String that describes the server's use. Will be used to create a unique server ID.
 * @param cliPath - Path to JFrog CLI executable.
 * @param workDir - Working directory.
 */
async function configureDefaultArtifactoryServer(usageType, cliPath, workDir) {
    let artifactoryService = tl.getInput('artifactoryConnection', true);
    const serverId = assembleUniqueServerId(usageType);
    await configureArtifactoryCliServer(artifactoryService, serverId, cliPath, workDir);
    useCliServer(serverId, cliPath, workDir);
    return serverId;
}

/**
 * Configure a JFrog CLI server for a Distribution service connection that is expected to be named 'distributionConnection'.
 * @param usageType - String that describes the server's use. Will be used to create a unique server ID.
 * @param cliPath - Path to JFrog CLI executable.
 * @param workDir - Working directory.
 */
async function configureDefaultDistributionServer(usageType, cliPath, workDir) {
    let distributionService = tl.getInput('distributionConnection', true);
    const serverId = assembleUniqueServerId(usageType);
    await configureDistributionCliServer(distributionService, serverId, cliPath, workDir);
    useCliServer(serverId, cliPath, workDir);
    return serverId;
}

/**
 * Configure a JFrog CLI server for a Xray service connection that is expected to be named 'xrayConnection'.
 * @param usageType - String that describes the server's use. Will be used to create a unique server ID.
 * @param cliPath - Path to JFrog CLI executable.
 * @param workDir - Working directory.
 */
async function configureDefaultXrayServer(usageType, cliPath, workDir) {
    let xrayService = tl.getInput('xrayConnection', true);
    const serverId = assembleUniqueServerId(usageType);
    await configureXrayCliServer(xrayService, serverId, cliPath, workDir);
    useCliServer(serverId, cliPath, workDir);
    return serverId;
}

/**
 * Use given serverId as default
 * @returns {Buffer|string}
 * @throws In CLI execution failure.
 */
function useCliServer(serverId, cliPath, buildDir) {
    const cliCommand = cliJoin(cliPath, jfrogCliConfigUseCommand, quote(serverId));
    return executeCliCommand(cliCommand, buildDir);
}

/**
 * Remove servers from the JFrog CLI config.
 * @param cliPath - Path to JFrog CLI
 * @param buildDir - Build / Working directory
 * @param serverIdArray - Array of server IDs to remove
 */
function deleteCliServers(cliPath, buildDir, serverIdArray) {
    if (!serverIdArray) {
        return;
    }
    for (let i = 0, len = serverIdArray.length; i < len; i++) {
        try {
            if (serverIdArray[i]) {
                const deleteServerIDCommand = cliJoin(cliPath, jfrogCliConfigRmCommand, quote(serverIdArray[i]), '--quiet');
                // This operation throws an exception in case of failure.
                executeCliCommand(deleteServerIDCommand, buildDir);
            }
        } catch (deleteServersException) {
            tl.setResult(tl.TaskResult.Failed, `Could not delete server id ${serverIdArray[i]} error: ${deleteServersException}`);
        }
    }
}

/**
 * Write file-spec to a file, based on the provided specSource input.
 * Tasks which use this function, must have PathInput named 'file', and input named 'taskConfiguration' determining the source of file-spec content.
 * File-spec content is written to provided specPath.
 * @param specSource - Value of 'file' uses PathInput 'file', value of 'taskConfiguration' uses input of 'fileSpec'.
 * @param specPath - File destination for the file-spec.
 * @throws On input read error, or write-file error.
 */
function writeSpecContentToSpecPath(specSource, specPath) {
    let fileSpec;
    if (specSource === 'file') {
        let specInputPath = tl.getPathInput('file', true, true);
        console.log('Using file spec located at ' + specInputPath);
        fileSpec = fs.readFileSync(specInputPath, 'utf8');
    } else if (specSource === 'taskConfiguration') {
        fileSpec = tl.getInput('fileSpec', true);
    } else {
        throw 'Failed creating File-Spec, since the provided File-Spec source value is invalid.';
    }
    fileSpec = fixWindowsPaths(fileSpec);
    console.log('Using file spec:');
    console.log(fileSpec);
    // Write provided fileSpec to file
    tl.writeFile(specPath, fileSpec);
}

function cliJoin(...args) {
    return args.filter((x) => x.length > 0).join(' ');
}

function quote(str) {
    return str ? '"' + str + '"' : '';
}

function singleQuote(str) {
    return str ? "'" + str + "'" : '';
}

function addStringParam(cliCommand, inputParam, cliParam, require) {
    let val = tl.getInput(inputParam, require);
    if (val) {
        cliCommand = cliJoin(cliCommand, '--' + cliParam + '=' + quote(val));
    }
    return cliCommand;
}

function addBoolParam(cliCommand, inputParam, cliParam) {
    let val = tl.getBoolInput(inputParam, false);
    if (val !== undefined) {
        cliCommand = cliJoin(cliCommand, '--' + cliParam + '=' + val);
    }
    return cliCommand;
}

function addIntParam(cliCommand, inputParam, cliParam) {
    let val = tl.getInput(inputParam, false);
    if (val) {
        let numVal = parseInt(val);
        if (isNaN(numVal)) {
            throw 'Illegal value "' + val + '" for ' + inputParam + ', should be numeric.';
        }
        cliCommand = cliJoin(cliCommand, '--' + cliParam + '=' + numVal);
    }
    return cliCommand;
}

function handleSpecFile(cliCommand, specPath) {
    let specSource = tl.getInput('specSource', false);
    // Create FileSpec.
    try {
        writeSpecContentToSpecPath(specSource, specPath);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    }
    cliCommand = cliJoin(cliCommand, '--spec=' + quote(specPath));

    // Add spec-vars
    let replaceSpecVars = tl.getBoolInput('replaceSpecVars');
    if (replaceSpecVars) {
        let specVars = tl.getInput('specVars', false);
        if (specVars) {
            cliCommand = cliJoin(cliCommand, '--spec-vars=' + quote(fixWindowsPaths(specVars)));
        }
    }
    return cliCommand;
}

function addCommonGenericParams(cliCommand, specPath) {
    cliCommand = handleSpecFile(cliCommand, specPath);

    // Add boolean flags
    cliCommand = addBoolParam(cliCommand, 'failNoOp', 'fail-no-op');
    cliCommand = addBoolParam(cliCommand, 'insecureTls', 'insecure-tls');

    // Add numeric flags, may throw exception for illegal value
    cliCommand = addIntParam(cliCommand, 'threads', 'threads');
    cliCommand = addIntParam(cliCommand, 'retries', 'retries');
    return cliCommand;
}

function logCliVersionAndSetSelected(cliPath) {
    try {
        let detectedVersion = getCliVersion(cliPath);
        console.log('JFrog CLI version: ' + detectedVersion);
        tl.setVariable(taskSelectedCliVersionEnv, detectedVersion);
    } catch (ex) {
        console.error('Failed to get JFrog CLI version: ' + ex);
    }
}

function getCliVersion(cliPath) {
    let cliCommand = cliJoin(cliPath, '--version');
    let res = execSync(cliCommand);
    return String.fromCharCode.apply(null, res).split(' ')[2].trim();
}

async function runCbk(cliPath) {
    console.log('Running jfrog-cli from ' + cliPath);
    logCliVersionAndSetSelected(cliPath);
    await runTaskCbk(cliPath);
}

function createCliDirs() {
    if (!fs.existsSync(jfrogFolderPath)) {
        try {
            console.log('Creating JFrog CLI directory: ' + jfrogFolderPath);
            fs.mkdirSync(jfrogFolderPath, { recursive: true });
        } catch (error) {
            const originalToolsDir = tl.getVariable('Agent.ToolsDirectory') || 'undefined';
            console.error(
                `Failed to create JFrog CLI directory. Original Agent.ToolsDirectory: ${originalToolsDir}, Attempted path: ${jfrogFolderPath}, Error: ${error.message}`,
            );

            // Try alternative approach: create directory without encoding
            const fallbackPath = join(tl.getVariable('Agent.ToolsDirectory') || '', '_jf').replace(/"/g, '');
            console.log('Attempting fallback path: ' + fallbackPath);
            try {
                fs.mkdirSync(fallbackPath, { recursive: true });
                console.log('Successfully created directory using fallback path');
                // Update the global variable to use the working path
                jfrogFolderPath = fallbackPath;
            } catch (fallbackError) {
                throw new Error(
                    `Unable to create JFrog CLI directory. Attempted paths: "${jfrogFolderPath}" and "${fallbackPath}". Original error: ${error.message}`,
                );
            }
        }
    }
}

function downloadCli(cliDownloadUrl, cliAuthHandlers, cliVersion = defaultJfrogCliVersion) {
    // If unspecified, download from 'releases.jfrog.io' by default.
    if (!cliDownloadUrl) {
        cliDownloadUrl = buildReleasesDownloadUrl(cliVersion);
        cliAuthHandlers = [];
    }
    return new Promise((resolve, reject) => {
        toolLib
            .downloadTool(cliDownloadUrl, null, cliAuthHandlers)
            .then((downloadPath) => {
                toolLib.cacheFile(downloadPath, fileName, jfrogCliToolName, cliVersion).then((cliDir) => {
                    let cliPath = join(cliDir, fileName);
                    if (!isWindows()) {
                        fs.chmodSync(cliPath, 0o555);
                    }
                    tl.debug('Finished downloading JFrog cli.');
                    resolve(cliPath);
                });
            })
            .catch((err) => {
                reject(err);
            });
    });
}

// Compares two versions.
// Returns 0 if the versions are equal, 1 if version1 is higher and -1 otherwise.
function compareVersions(version1, version2) {
    let version1Tokens = version1.split('.', 3);
    let version2Tokens = version2.split('.', 3);
    let maxIndex = version1Tokens.length;
    if (version2Tokens.length > maxIndex) {
        maxIndex = version2Tokens.length;
    }
    for (let i = 0, len = maxIndex; i < len; i++) {
        let version1Token = '0';
        if (version1Tokens.length >= i + 1) {
            version1Token = version1Tokens[i];
        }
        let version2Token = '0';
        if (version2Tokens.length >= i + 1) {
            version2Token = version2Tokens[i];
        }
        let compare = compareVersionTokens(version1Token, version2Token);
        if (compare !== 0) {
            return compare;
        }
    }
    return 0;
}

function compareVersionTokens(version1Token, version2Token) {
    let version1TokenInt = parseInt(version1Token);
    let version2TokenInt = parseInt(version2Token);

    if (version1TokenInt > version2TokenInt) {
        return 1;
    }
    if (version1TokenInt < version2TokenInt) {
        return -1;
    }
    return 0;
}

function getArchitecture() {
    const platform = process.platform;
    if (platform.startsWith('win')) {
        // Windows architecture:
        return 'windows-amd64';
    }
    const arch = process.arch;
    if (platform.includes('darwin')) {
        // macOS architecture:
        return arch === 'arm64' ? 'mac-arm64' : 'mac-386';
    }

    // linux architecture:
    switch (arch) {
        case 'x64':
            return 'linux-amd64';
        case 'arm64':
            return 'linux-arm64';
        case 'arm':
            return 'linux-arm';
        case 's390x':
            return 'linux-s390x';
        case 'ppc64':
            return 'linux-ppc64';
        default:
            return 'linux-386';
    }
}

function getCliExecutableName() {
    let executable = 'jf';
    if (isWindows()) {
        executable += '.exe';
    }
    return executable;
}

function fixWindowsPaths(string) {
    return isWindows() ? string.replace(/([^\\])\\(?!\\)/g, '$1\\\\') : string;
}

/**
 * Encodes the provided path for safe usage in command line execution.
 *
 * Key features:
 * - Fixes Windows drive letter paths with malformed quotes: C:"Program Files" -> C:\Program Files
 * - Removes quotes from path segments that don't need them
 * - Preserves legitimate quotes around segments with spaces
 * - Uses smart path separator detection (\ for Windows, / for Unix)
 * - Prevents re-quoting of segments that had malformed quotes removed
 *
 * Examples:
 * - a/b/Program Files/c --> a/b/"Program Files"/c
 * - C:"Program Files"\JFrog --> C:\Program Files\JFrog
 * - G:"Project-Agent"\tools --> G:\Project-Agent\tools
 *
 * @param {string} str - The path to encode. Can be null, undefined, or empty.
 * @returns {string} - The encoded path, or the original value if null/undefined/empty.
 * @throws {TypeError} - If str is not a string, null, or undefined.
 */
function encodePath(str) {
    if (str == null || str === '') {
        return str;
    }

    // Validate input type
    if (typeof str !== 'string') {
        throw new TypeError(`encodePath expects a string, but received: ${typeof str}`);
    }

    let cleanedStr = str.trim();
    let segmentsToNotQuote = new Set();

    // Clean up malformed quotes in paths - only handle specific Azure DevOps patterns
    // Pattern 1: Remove quotes after drive letters (Windows-specific Azure DevOps issue)
    // Matches: G:"Project-Agent" -> G:\Project-Agent
    // Also handles: C:"Program Files" -> C:\Program Files
    const driveQuotePattern = /^([A-Za-z]:)\\?"([^"]*)"(.*)$/;
    if (driveQuotePattern.test(cleanedStr)) {
        const match = cleanedStr.match(driveQuotePattern);
        if (match) {
            segmentsToNotQuote.add(match[2]);
            cleanedStr = cleanedStr.replace(driveQuotePattern, '$1\\$2$3');
        }
    }

    // Pattern 2: Remove quotes around path segments that don't contain spaces (cross-platform)
    // Matches: /home/"user-name"/tools -> /home/user-name/tools
    const pattern1 = /([:/\\])"([^"/\\\s]*)"([/\\]|$)/g;
    let match;
    while ((match = pattern1.exec(str)) !== null) {
        segmentsToNotQuote.add(match[2]);
    }
    cleanedStr = cleanedStr.replace(/([:/\\])"([^"/\\\s]*)"([/\\]|$)/g, '$1$2$3');

    // Pattern 3: Remove quotes around path segments that DO contain spaces (Unix malformed quotes only)
    // Matches: /opt/"Program Files"/jfrog -> /opt/Program Files/jfrog
    // Only apply to Unix paths (containing forward slashes) to avoid breaking Windows legitimate quotes
    if (!cleanedStr.includes('\\')) {
        const pattern2 = /([:/])"([^"/]*)"([/]|$)/g;
        while ((match = pattern2.exec(str)) !== null) {
            segmentsToNotQuote.add(match[2]);
        }
        cleanedStr = cleanedStr.replace(/([:/])"([^"/]*)"([/]|$)/g, '$1$2$3');
    }

    // Determine the appropriate separator based on path content
    // Windows paths use backslash, Unix paths use forward slash
    const pathSeparator = cleanedStr.includes('\\') ? '\\' : sep;

    let encodedPath = '';
    let arr = cleanedStr.split(pathSeparator);
    let count = 0;

    for (let section of arr) {
        if (section.length === 0) {
            continue;
        }
        count++;

        // Add quotes to segments with spaces if they're not already quoted
        // Skip segments that we cleaned malformed quotes from
        if (
            !segmentsToNotQuote.has(section) &&
            section.indexOf(' ') > 0 &&
            !(section.startsWith("'") && section.endsWith("'")) &&
            !(section.startsWith('"') && section.endsWith('"'))
        ) {
            try {
                section = quote(section);
            } catch (error) {
                // If quoting fails, log warning and continue with unquoted section
                console.warn(`Warning: Failed to quote path segment "${section}": ${error.message}`);
            }
        }
        encodedPath += section + pathSeparator;
    }
    if (count > 0 && !cleanedStr.endsWith(pathSeparator)) {
        encodedPath = encodedPath.substring(0, encodedPath.length - 1);
    }
    if (cleanedStr.startsWith(pathSeparator)) {
        encodedPath = pathSeparator + encodedPath;
    }

    return encodedPath;
}

/**
 * Runs collect environment variables JFrog CLI command if includeEnvVars is configured to true.
 * @param cliPath - (String) - The cli path.
 */
function collectEnvVarsIfNeeded(cliPath) {
    let includeEnvVars = tl.getBoolInput('includeEnvVars');
    if (includeEnvVars) {
        try {
            collectEnvVars(cliPath);
        } catch (ex) {
            tl.setResult(tl.TaskResult.Failed, ex);
        }
    }
}

/**
 * Runs collect environment variables JFrog CLI command.
 * @param cliPath - (String) - The cli path.
 * @returns (void) - String with error message or void if passes successfully.
 * @throws In CLI execution failure.
 */
function collectEnvVars(cliPath) {
    console.log('Collecting environment variables...');
    let buildName = tl.getInput('buildName', true);
    let buildNumber = tl.getInput('buildNumber', true);
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    let cliEnvVarsCommand = cliJoin(cliPath, 'rt bce', quote(buildName), quote(buildNumber));
    cliEnvVarsCommand = addProjectOption(cliEnvVarsCommand);
    executeCliCommand(cliEnvVarsCommand, workDir);
}

function isWindows() {
    return process.platform.startsWith('win');
}

function isToolExists(toolName) {
    return !!tl.which(toolName, false);
}

function stripTrailingSlash(str) {
    return str.endsWith('/') ? str.slice(0, -1) : str;
}

/**
 * Parse platform URL from a service URL by stripping service-specific suffixes.
 * Handles URLs ending with /xray, /artifactory, or /distribution (case-insensitive).
 *
 * @param serviceUrl - The service URL to parse (e.g., 'https://example.jfrog.io/artifactory')
 * @returns The platform URL with the service suffix removed
 */
function parsePlatformUrlFromServiceUrl(serviceUrl) {
    const suffixes = ['/xray', '/artifactory', '/distribution'];
    const url = new URL(serviceUrl);
    for (const suffix of suffixes) {
        if (url.pathname.endsWith(suffix)) {
            url.pathname = url.pathname.replace(suffix, '');
            break;
        }
    }
    // Remove trailing slash
    return url.toString().replace(/\/$/, '');
}

/**
 * Determines the required working directory for running the cli.
 * Decision is based on the default path to run, and the provided path by the user.
 */
function determineCliWorkDir(defaultPath, providedPath) {
    if (providedPath) {
        if (isAbsolute(providedPath)) {
            return providedPath;
        }
        return join(defaultPath, providedPath);
    }
    return defaultPath;
}

// Creates a server Id from build and build tool parameters.
function assembleUniqueServerId(usageType) {
    let buildName = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    let timestamp = Math.floor(Date.now());
    return [buildName, buildNumber, usageType, timestamp].join('_');
}

/**
 * Run the corresponding JFrog CLI config command for the build tool used.
 * Also configures a JFrog CLI server by using {@link configureDefaultArtifactoryServer}.
 * @param cliPath - Path to JFrog CLI executable.
 * @param cmd - String to be used for the server ID.
 * @param requiredWorkDir - Working directory.
 * @param configCommand - JFrog CLI config command name.
 * @param repoResolver - Repository to use for resolving. Pass a falsy value to skip.
 * @param repoDeploy - Repository to use for deploying. Pass a falsy value to skip.
 * @returns {string[]}
 */
async function createBuildToolConfigFile(cliPath, cmd, requiredWorkDir, configCommand, repoResolver, repoDeploy) {
    let cliCommand = cliJoin(cliPath, configCommand);
    let serverIdResolve;
    let serverIdDeploy;
    if (repoResolver) {
        // Configure Artifactory resolver server.
        const usageType = cmd + tl.getInput('command', true) + '_resolver';
        serverIdResolve = await configureDefaultArtifactoryServer(usageType, cliPath, requiredWorkDir);

        // Add serverId and repo to config command.
        cliCommand = cliJoin(cliCommand, '--server-id-resolve=' + quote(serverIdResolve));
        cliCommand = addStringParam(cliCommand, repoResolver, 'repo-resolve', true);
    }
    if (repoDeploy) {
        // Configure Artifactory deployer server.
        const usageType = cmd + tl.getInput('command', true) + '_deployer';
        serverIdDeploy = await configureDefaultArtifactoryServer(usageType, cliPath, requiredWorkDir);

        // Add serverId and repo to config command.
        cliCommand = cliJoin(cliCommand, '--server-id-deploy=' + quote(serverIdDeploy));
        cliCommand = addStringParam(cliCommand, repoDeploy, 'repo-deploy', true);
    }
    // Execute cli.
    try {
        executeCliCommand(cliCommand, requiredWorkDir);
        return [serverIdResolve, serverIdDeploy];
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
}

/**
 * Appends build name and number to provided cli command if collectBuildInfo is selected.
 * */
function appendBuildFlagsToCliCommand(cliCommand) {
    if (tl.getBoolInput('collectBuildInfo')) {
        // Construct the build-info collection flags.
        let buildName = tl.getInput('buildName', true);
        let buildNumber = tl.getInput('buildNumber', true);
        cliCommand = cliJoin(cliCommand, '--build-name=' + quote(buildName), '--build-number=' + quote(buildNumber));
        cliCommand = addStringParam(cliCommand, 'module', 'module', false);
        return addProjectOption(cliCommand);
    }
    return cliCommand;
}

/**
 * Returns the current timestamp in seconds
 */
function getCurrentTimestamp() {
    return Math.floor(Date.now() / 1000);
}

/**
 * Removes the cli server config and env variables set in ToolsInstaller task.
 * @throws In CLI execution failure.
 */
function removeExtractorsDownloadVariables(cliPath, workDir) {
    let extractorsEnv = tl.getVariable(extractorsRemoteEnv);
    if (!extractorsEnv) {
        return;
    }
    let ind = extractorsEnv.lastIndexOf('/');
    if (ind === -1) {
        console.warn('Unexpected value for the "' + extractorsRemoteEnv + '" environment variable:' + 'expected to contain at least one "/"');
        return;
    }
    const serverId = extractorsEnv.substring(0, ind);
    tl.setVariable(extractorsRemoteEnv, '');
    deleteCliServers(cliPath, workDir, [serverId]);
}

/**
 * Adds project key, if provided, as the project option to the cli command.
 * @param cliCommand - Command to append to.
 * @returns {string} - Command after addition.
 */
function addProjectOption(cliCommand) {
    return addStringParam(cliCommand, 'projectKey', 'project');
}

function addServerIdOption(cliCommand, serverId) {
    return cliJoin(cliCommand, '--server-id=' + quote(serverId));
}

/**
 * Default cleanup of a task - removes JFrog CLI server and build tool configurations.
 * @param cliPath - Path to JFrog CLI
 * @param workDir - Working Directory
 * @param serverIdsArray - Array of server IDs to be removed.
 */
function taskDefaultCleanup(cliPath, workDir, serverIdsArray) {
    // Delete servers if exist.
    deleteCliServers(cliPath, workDir, serverIdsArray);
    try {
        const configPath = join(workDir, '.jfrog', 'projects');
        if (fs.existsSync(configPath)) {
            tl.debug('Removing JFrog CLI build tool configuration...');
            tl.rmRF(configPath);
        }
    } catch (cleanupException) {
        tl.setResult(tl.TaskResult.Failed, cleanupException);
    }
}

function setJdkHomeForJavaTasks() {
    let javaHomeSelection = tl.getInput('javaHomeSelection', true);
    let javaHome;
    if (javaHomeSelection === 'JDKVersion') {
        // Set JAVA_HOME to the specified JDK version (default, 1.7, 1.8, etc.)
        tl.debug('Using the specified JDK version to find and set JAVA_HOME');
        let jdkVersion = tl.getInput('jdkVersion') || '';
        let jdkArchitecture = tl.getInput('jdkArchitecture') || '';
        if (jdkVersion !== 'default') {
            javaHome = findJavaHome(jdkVersion, jdkArchitecture);
        }
    } else {
        // Set JAVA_HOME to the path specified by the user
        tl.debug('Setting JAVA_HOME to the path specified by user input');
        javaHome = tl.getPathInput('jdkUserInputPath', true, true);
    }

    // Set JAVA_HOME as determined above (if different from default)
    if (javaHome) {
        console.log('The Java home location: ' + javaHome);
        tl.setVariable('JAVA_HOME', javaHome);
    }
}

function isStdinSecretSupported() {
    return compareVersions(tl.getVariable(taskSelectedCliVersionEnv), minSupportedStdinSecretCliVersion) >= 0;
}

function isServerIdEnvSupported() {
    return compareVersions(tl.getVariable(taskSelectedCliVersionEnv), minSupportedServerIdEnvCliVersion) >= 0;
}
