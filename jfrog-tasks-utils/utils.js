const fs = require('fs');
const tl = require('azure-pipelines-task-lib/task');
const { join, sep, isAbsolute } = require('path');
const execSync = require('child_process').execSync;
const toolLib = require('azure-pipelines-tool-lib/tool');
const credentialsHandler = require('typed-rest-client/Handlers');
const findJavaHome = require('azure-pipelines-tasks-java-common/java-common').findJavaHome;

const fileName = getCliExecutableName();
const jfrogCliToolName = 'jf';
const cliPackage = 'jfrog-cli-' + getArchitecture();
const jfrogFolderPath = encodePath(join(tl.getVariable('Agent.ToolsDirectory') || '', '_jf'));
const defaultJfrogCliVersion = '2.52.1';
const minCustomCliVersion = '2.10.0';
const minSupportedStdinSecretCliVersion = '2.36.0';
const minSupportedServerIdEnvCliVersion = '2.37.0';
const pluginVersion = '2.9.0';
const buildAgent = 'jfrog-azure-devops-extension';
const customFolderPath = encodePath(join(jfrogFolderPath, 'current'));
const customCliPath = encodePath(join(customFolderPath, fileName)); // Optional - Customized jfrog-cli path.
const jfrogCliReleasesUrl = 'https://releases.jfrog.io/artifactory/jfrog-cli/v2-jf';

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
    taskDefaultCleanup: taskDefaultCleanup,
    writeSpecContentToSpecPath: writeSpecContentToSpecPath,
    stripTrailingSlash: stripTrailingSlash,
    determineCliWorkDir: determineCliWorkDir,
    createBuildToolConfigFile: createBuildToolConfigFile,
    assembleUniqueServerId: assembleUniqueServerId,
    appendBuildFlagsToCliCommand: appendBuildFlagsToCliCommand,
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
    configureDefaultArtifactoryServer: configureDefaultArtifactoryServer,
    configureDefaultDistributionServer: configureDefaultDistributionServer,
    configureDefaultXrayServer: configureDefaultXrayServer,
    minCustomCliVersion: minCustomCliVersion,
    defaultJfrogCliVersion: defaultJfrogCliVersion,
    pipelineRequestedCliVersionEnv: pipelineRequestedCliVersionEnv,
    taskSelectedCliVersionEnv: taskSelectedCliVersionEnv,
    extractorsRemoteEnv: extractorsRemoteEnv,
    jfrogCliToolName: jfrogCliToolName,
    isServerIdEnvSupported: isServerIdEnvSupported,
    setJdkHomeForJavaTasks: setJdkHomeForJavaTasks,
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
        .then((cliPath) => {
            runCbk(cliPath);
            collectEnvVarsIfNeeded(cliPath);
        })
        .catch((error) => tl.setResult(tl.TaskResult.Failed, 'Error occurred while executing task: ' + error));
}

function getCliPath(cliDownloadUrl, cliAuthHandlers, cliVersion) {
    return new Promise(function (resolve, reject) {
        let cliDir = toolLib.findLocalTool(jfrogCliToolName, cliVersion);
        if (fs.existsSync(customCliPath)) {
            tl.debug('Using JFrog CLI from the custom CLI path: ' + customCliPath);
            resolve(customCliPath);
        } else if (cliDir) {
            let cliPath = join(cliDir, fileName);
            tl.debug('Using existing versioned cli path: ' + cliPath);
            resolve(cliPath);
        } else {
            const errMsg = generateDownloadCliErrorMessage(cliDownloadUrl, cliVersion);
            createCliDirs();
            return downloadCli(cliDownloadUrl, cliAuthHandlers, cliVersion)
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
    errMsg += 'may also manually download version ' + cliVersion + ' of JFrog CLI and place it on the agent in the following path: ' + customCliPath;
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

function configureJfrogCliServer(jfrogService, serverId, cliPath, buildDir) {
    return configureSpecificCliServer(jfrogService, '--url', serverId, cliPath, buildDir);
}

function configureArtifactoryCliServer(artifactoryService, serverId, cliPath, buildDir) {
    return configureSpecificCliServer(artifactoryService, '--artifactory-url', serverId, cliPath, buildDir);
}

function configureDistributionCliServer(distributionService, serverId, cliPath, buildDir) {
    return configureSpecificCliServer(distributionService, '--distribution-url', serverId, cliPath, buildDir);
}

function configureXrayCliServer(xrayService, serverId, cliPath, buildDir) {
    return configureSpecificCliServer(xrayService, '--xray-url', serverId, cliPath, buildDir);
}

function configureSpecificCliServer(service, urlFlag, serverId, cliPath, buildDir) {
    let serviceUrl = tl.getEndpointUrl(service, false);
    let serviceUser = tl.getEndpointAuthorizationParameter(service, 'username', true);
    let servicePassword = tl.getEndpointAuthorizationParameter(service, 'password', true);
    let serviceAccessToken = tl.getEndpointAuthorizationParameter(service, 'apitoken', true);
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
function configureDefaultJfrogServer(serverId, cliPath, workDir) {
    let jfrogPlatformService = tl.getInput('jfrogPlatformConnection', false);
    if (!jfrogPlatformService) {
        return false;
    }
    configureJfrogCliServer(jfrogPlatformService, serverId, cliPath, workDir);
    useCliServer(serverId, cliPath, workDir);
    return true;
}

/**
 * Configure a JFrog CLI server for an Artifactory service connection that is expected to be named 'artifactoryConnection'.
 * @param usageType - String that describes the server's use. Will be used to create a unique server ID.
 * @param cliPath - Path to JFrog CLI executable.
 * @param workDir - Working directory.
 */
function configureDefaultArtifactoryServer(usageType, cliPath, workDir) {
    let artifactoryService = tl.getInput('artifactoryConnection', true);
    const serverId = assembleUniqueServerId(usageType);
    configureArtifactoryCliServer(artifactoryService, serverId, cliPath, workDir);
    useCliServer(serverId, cliPath, workDir);
    return serverId;
}

/**
 * Configure a JFrog CLI server for a Distribution service connection that is expected to be named 'distributionConnection'.
 * @param usageType - String that describes the server's use. Will be used to create a unique server ID.
 * @param cliPath - Path to JFrog CLI executable.
 * @param workDir - Working directory.
 */
function configureDefaultDistributionServer(usageType, cliPath, workDir) {
    let distributionService = tl.getInput('distributionConnection', true);
    const serverId = assembleUniqueServerId(usageType);
    configureDistributionCliServer(distributionService, serverId, cliPath, workDir);
    useCliServer(serverId, cliPath, workDir);
    return serverId;
}

/**
 * Configure a JFrog CLI server for a Xray service connection that is expected to be named 'xrayConnection'.
 * @param usageType - String that describes the server's use. Will be used to create a unique server ID.
 * @param cliPath - Path to JFrog CLI executable.
 * @param workDir - Working directory.
 */
function configureDefaultXrayServer(usageType, cliPath, workDir) {
    let xrayService = tl.getInput('xrayConnection', true);
    const serverId = assembleUniqueServerId(usageType);
    configureXrayCliServer(xrayService, serverId, cliPath, workDir);
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
    cliCommand = cliJoin(cliCommand, '--' + cliParam + '=' + val);
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

function runCbk(cliPath) {
    console.log('Running jfrog-cli from ' + cliPath);
    logCliVersionAndSetSelected(cliPath);
    runTaskCbk(cliPath);
}

function createCliDirs() {
    if (!fs.existsSync(jfrogFolderPath)) {
        fs.mkdirSync(jfrogFolderPath);
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

/**
 * Escape single backslashes in a string.
 * / -> //
 * // -> //
 * @param string (String) - The string to escape
 * @returns (String) - The string after escaping
 */
function fixWindowsPaths(string) {
    return isWindows() ? string.replace(/([^\\])\\(?!\\)/g, '$1\\\\') : string;
}

/**
 * Encodes spaces with quotes in a path.
 * a/b/Program Files/c --> a/b/"Program Files"/c
 * @param str (String) - The path to encode.
 * @returns {string} - The encoded path.
 */
function encodePath(str) {
    let encodedPath = '';
    let arr = str.split(sep);
    let count = 0;
    for (let section of arr) {
        if (section.length === 0) {
            continue;
        }
        count++;
        if (
            section.indexOf(' ') > 0 && // contains space
            !(section.startsWith("'") && section.endsWith("'")) && // not already quoted with single quotation mark
            !(section.startsWith('"') && section.endsWith('"')) // not already quoted with double quotation mark
        ) {
            section = quote(section);
        }
        encodedPath += section + sep;
    }
    if (count > 0 && !str.endsWith(sep)) {
        encodedPath = encodedPath.substring(0, encodedPath.length - 1);
    }
    if (str.startsWith(sep)) {
        encodedPath = sep + encodedPath;
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
function createBuildToolConfigFile(cliPath, cmd, requiredWorkDir, configCommand, repoResolver, repoDeploy) {
    let cliCommand = cliJoin(cliPath, configCommand);
    let serverIdResolve;
    let serverIdDeploy;
    if (repoResolver) {
        // Configure Artifactory resolver server.
        const usageType = cmd + tl.getInput('command', true) + '_resolver';
        serverIdResolve = configureDefaultArtifactoryServer(usageType, cliPath, requiredWorkDir);

        // Add serverId and repo to config command.
        cliCommand = cliJoin(cliCommand, '--server-id-resolve=' + quote(serverIdResolve));
        cliCommand = addStringParam(cliCommand, repoResolver, 'repo-resolve', true);
    }
    if (repoDeploy) {
        // Configure Artifactory deployer server.
        const usageType = cmd + tl.getInput('command', true) + '_deployer';
        serverIdDeploy = configureDefaultArtifactoryServer(usageType, cliPath, requiredWorkDir);

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
