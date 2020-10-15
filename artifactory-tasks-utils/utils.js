const fs = require('fs');
const tl = require('azure-pipelines-task-lib/task');
const path = require('path');
const execSync = require('child_process').execSync;
const toolLib = require('azure-pipelines-tool-lib/tool');
const credentialsHandler = require('./credentialsHandler');
const localTools = require('./tools');

const fileName = getCliExecutableName();
const toolName = 'jfrog';
const btPackage = 'jfrog-cli-' + getArchitecture();
const jfrogFolderPath = encodePath(path.join(tl.getVariable('Agent.ToolsDirectory'), '_jfrog'));
const jfrogLegacyFolderPath = encodePath(path.join(tl.getVariable('Agent.WorkFolder'), '_jfrog'));
const defaultJfrogCliVersion = '1.39.5';
const minCustomCliVersion = '1.37.1';
const pluginVersion = '1.10.6';
const buildAgent = 'artifactory-azure-devops-extension';
const customFolderPath = encodePath(path.join(jfrogFolderPath, 'current'));
const customCliPath = encodePath(path.join(customFolderPath, fileName)); // Optional - Customized jfrog-cli path.
const customLegacyCliPath = encodePath(path.join(jfrogLegacyFolderPath, 'current', fileName));
const jfrogCliBintrayUrl = 'https://api.bintray.com/content/jfrog/jfrog-cli-go/';

let cliConfigCommand = 'rt c';
let runTaskCbk = null;

module.exports = {
    executeCliTask: executeCliTask,
    executeCliCommand: executeCliCommand,
    downloadCli: downloadCli,
    cliJoin: cliJoin,
    quote: quote,
    isWindows: isWindows,
    addArtifactoryCredentials: addArtifactoryCredentials,
    addStringParam: addStringParam,
    addBoolParam: addBoolParam,
    addIntParam: addIntParam,
    addCommonGenericParams: addCommonGenericParams,
    addUrlAndCredentialsParams: addUrlAndCredentialsParams,
    fixWindowsPaths: fixWindowsPaths,
    encodePath: encodePath,
    getArchitecture: getArchitecture,
    isToolExists: isToolExists,
    buildCliArtifactoryDownloadUrl: buildCliArtifactoryDownloadUrl,
    createAuthHandlers: createAuthHandlers,
    configureCliServer: configureCliServer,
    deleteCliServers: deleteCliServers,
    writeSpecContentToSpecPath: writeSpecContentToSpecPath,
    stripTrailingSlash: stripTrailingSlash,
    determineCliWorkDir: determineCliWorkDir,
    createBuildToolConfigFile: createBuildToolConfigFile,
    assembleBuildToolServerId: assembleBuildToolServerId,
    appendBuildFlagsToCliCommand: appendBuildFlagsToCliCommand,
    deprecatedTaskMessage: deprecatedTaskMessage,
    comparVersions: comparVersions,
    addTrailingSlashIfNeeded: addTrailingSlashIfNeeded,
    minCustomCliVersion: minCustomCliVersion,
    defaultJfrogCliVersion: defaultJfrogCliVersion
};

// The cliDownloadUrl and cliAuthHandlers arguments are optional. They are provided to this function by the 'Artifactory Tools Installer' task.
// jfrogCliBintrayDownloadUrl is used by default.
function executeCliTask(runTaskFunc, cliVersion = defaultJfrogCliVersion, cliDownloadUrl, cliAuthHandlers) {
    process.env.JFROG_CLI_HOME = jfrogFolderPath;
    process.env.JFROG_CLI_OFFER_CONFIG = 'false';
    process.env.JFROG_CLI_USER_AGENT = buildAgent + '/' + pluginVersion;
    process.env.CI = true;
    // If unspecified, use the default cliDownloadUrl of Bintray.
    if (!cliDownloadUrl) {
        cliDownloadUrl = buildBintrayDownloadUrl(cliVersion);
        cliAuthHandlers = [];
    }

    runTaskCbk = runTaskFunc;
    getCliPath(cliDownloadUrl, cliAuthHandlers, cliVersion)
        .then(cliPath => {
            runCbk(cliPath);
            collectEnvVarsIfNeeded(cliPath);
        })
        .catch(error => tl.setResult(tl.TaskResult.Failed, 'Error occurred while executing task:\n' + error));
}

function getCliPath(cliDownloadUrl, cliAuthHandlers, cliVersion) {
    return new Promise(function(resolve, reject) {
        let cliDir = toolLib.findLocalTool(toolName, cliVersion);
        if (fs.existsSync(customCliPath)) {
            tl.debug('Using cli from custom cli path: ' + customCliPath);
            resolve(customCliPath);
        } else if (fs.existsSync(customLegacyCliPath)) {
            tl.warning(
                'Found JFrog CLI in deprecated custom path: ' + customLegacyCliPath + '. Copying JFrog CLI to new supported path: ' + customFolderPath
            );
            tl.mkdirP(customFolderPath);
            tl.cp(customLegacyCliPath, customFolderPath, '-f');
            resolve(customCliPath);
        } else if (cliDir) {
            let cliPath = path.join(cliDir, fileName);
            tl.debug('Using existing versioned cli path: ' + cliPath);
            resolve(cliPath);
        } else {
            const errMsg = generateDownloadCliErrorMessage(cliDownloadUrl, cliVersion);
            createCliDirs();
            return downloadCli(cliDownloadUrl, cliAuthHandlers, cliVersion)
                .then(cliPath => resolve(cliPath))
                .catch(error => reject(errMsg + '\n' + error));
        }
    });
}

function buildCliArtifactoryDownloadUrl(rtUrl, repoName, cliVersion = defaultJfrogCliVersion) {
    return addTrailingSlashIfNeeded(rtUrl) + repoName + '/' + cliVersion + '/' + btPackage + '/' + fileName;
}

function addTrailingSlashIfNeeded(input) {
    if (input.slice(-1) !== '/') {
        input += '/';
    }
    return input;
}

function buildBintrayDownloadUrl(cliVersion = defaultJfrogCliVersion) {
    return jfrogCliBintrayUrl + cliVersion + '/' + btPackage + '/' + fileName + '?bt_package=' + btPackage;
}

function createAuthHandlers(artifactoryService) {
    let artifactoryUser = tl.getEndpointAuthorizationParameter(artifactoryService, 'username', true);
    let artifactoryPassword = tl.getEndpointAuthorizationParameter(artifactoryService, 'password', true);
    let artifactoryAccessToken = tl.getEndpointAuthorizationParameter(artifactoryService, 'apitoken', true);

    // Check if Artifactory should be accessed using access-token.
    if (artifactoryAccessToken) {
        return [credentialsHandler.accessTokenHandler(artifactoryAccessToken)];
    }

    // Check if Artifactory should be accessed anonymously.
    if (artifactoryUser === '') {
        return [];
    }

    // Use basic authentication.
    return [credentialsHandler.basicAuthHandler(artifactoryUser, artifactoryPassword)];
}

function generateDownloadCliErrorMessage(downloadUrl, cliVersion) {
    let errMsg = 'Failed while attempting to download JFrog CLI from ' + downloadUrl + '. ';
    if (downloadUrl === buildBintrayDownloadUrl(cliVersion)) {
        errMsg +=
            'If this build agent cannot access the internet, you may use the \'Artifactory Tools Installer\' task, to download JFrog CLI through an Artifactory repository, which proxies ' +
            buildBintrayDownloadUrl(cliVersion) +
            '. You ';
    } else {
        errMsg += 'If the chosen Artifactory Service cannot access the internet, you ';
    }
    errMsg += 'may also manually download version ' + cliVersion + ' of JFrog CLI and place it on the agent in the following path: ' + customCliPath;
    return errMsg;
}

/**
 * Execute provided CLI command in a child process. In order to receive execution's stdout, pass stdio=null.
 * @param {string} cliCommand
 * @param {string} runningDir
 * @param {string|Array} stdio - stdio to use for CLI execution.
 * @returns {Buffer|string} - execSync output.
 * @throws In CLI execution failure.
 */
function executeCliCommand(cliCommand, runningDir, stdio) {
    if (!fs.existsSync(runningDir)) {
        throw "JFrog CLI execution path doesn't exist: " + runningDir;
    }
    if (!cliCommand) {
        throw 'Cannot execute empty Cli command.';
    }
    try {
        if (!stdio) {
            stdio = [0, 1, 2];
        }
        tl.debug('Executing cliCommand: ' + maskSecrets(cliCommand));
        return execSync(cliCommand, { cwd: runningDir, stdio: stdio });
    } catch (ex) {
        // Error occurred
        throw maskSecrets(ex.toString());
    }
}

/**
 * Mask password and access token in a CLI command or exception.
 * @param str - CLI command or exception
 * @returns {string}
 */
function maskSecrets(str) {
    return str.replace(/--password=".*"/g, '--password=***').replace(/--access-token=".*"/g, '--access-token=***');
}

/**
 * Add a new server to the CLI config.
 * @returns {Buffer|string}
 * @throws In CLI execution failure.
 */
function configureCliServer(artifactory, serverId, cliPath, buildDir) {
    let artifactoryUrl = tl.getEndpointUrl(artifactory);
    let artifactoryUser = tl.getEndpointAuthorizationParameter(artifactory, 'username', true);
    let artifactoryPassword = tl.getEndpointAuthorizationParameter(artifactory, 'password', true);
    let artifactoryAccessToken = tl.getEndpointAuthorizationParameter(artifactory, 'apitoken', true);
    let cliCommand = cliJoin(cliPath, cliConfigCommand, quote(serverId), '--url=' + quote(artifactoryUrl), '--interactive=false');
    if (artifactoryAccessToken) {
        // Add access-token if required.
        cliCommand = cliJoin(cliCommand, '--access-token=' + quote(artifactoryAccessToken));
    } else {
        // Add username and password.
        cliCommand = cliJoin(cliCommand, '--user=' + quote(artifactoryUser), '--password=' + quote(artifactoryPassword));
    }
    return executeCliCommand(cliCommand, buildDir, null);
}

/**
 * Remove servers from the cli config.
 * @returns (Buffer|string) CLI execution output.
 * @throws In CLI execution failure.
 */
function deleteCliServers(cliPath, buildDir, serverIdArray) {
    for (let i = 0, len = serverIdArray.length; i < len; i++) {
        try {
            if (serverIdArray[i]) {
                let deleteServerIDCommand = cliJoin(cliPath, cliConfigCommand, 'delete', quote(serverIdArray[i]), '--interactive=false');
                // This operation throws an exception in case of failure.
                executeCliCommand(deleteServerIDCommand, buildDir, null);
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
 * @throws - On input read error, or write-file error.
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
    return args.filter(x => x.length > 0).join(' ');
}

function quote(str) {
    return '"' + str + '"';
}

function addArtifactoryCredentials(cliCommand, artifactoryService) {
    let artifactoryUser = tl.getEndpointAuthorizationParameter(artifactoryService, 'username', true);
    let artifactoryPassword = tl.getEndpointAuthorizationParameter(artifactoryService, 'password', true);
    let artifactoryAccessToken = tl.getEndpointAuthorizationParameter(artifactoryService, 'apitoken', true);

    // Check if should use Access Token.
    if (artifactoryAccessToken) {
        return cliJoin(cliCommand, '--access-token=' + quote(artifactoryAccessToken));
    }

    // Check if Artifactory should be accessed anonymously.
    if (artifactoryUser === '') {
        artifactoryUser = 'anonymous';
        return cliJoin(cliCommand, '--user=' + quote(artifactoryUser));
    }

    return cliJoin(cliCommand, '--user=' + quote(artifactoryUser), '--password=' + quote(artifactoryPassword));
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
        if (isNaN(val)) {
            throw 'Illegal value "' + val + '" for ' + inputParam + ', should be numeric.';
        }
        cliCommand = cliJoin(cliCommand, '--' + cliParam + '=' + val);
    }
    return cliCommand;
}

function addUrlAndCredentialsParams(cliCommand, artifactoryService) {
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    cliCommand = cliJoin(cliCommand, '--url=' + quote(artifactoryUrl));
    cliCommand = addArtifactoryCredentials(cliCommand, artifactoryService);
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
    return cliCommand;
}

function addCommonGenericParams(cliCommand, specPath) {
    cliCommand = handleSpecFile(cliCommand, specPath);
    // Add spec-vars
    let replaceSpecVars = tl.getBoolInput('replaceSpecVars');
    if (replaceSpecVars) {
        let specVars = tl.getInput('specVars', false);
        if (specVars) {
            cliCommand = cliJoin(cliCommand, '--spec-vars=' + quote(fixWindowsPaths(specVars)));
        }
    }
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo');
    // Add build info collection
    if (collectBuildInfo) {
        let buildName = tl.getInput('buildName', true);
        let buildNumber = tl.getInput('buildNumber', true);
        cliCommand = cliJoin(cliCommand, '--build-name=' + quote(buildName), '--build-number=' + quote(buildNumber));
        cliCommand = addStringParam(cliCommand, 'module', 'module');
    }
    // Add boolean flags
    cliCommand = addBoolParam(cliCommand, 'failNoOp', 'fail-no-op');
    cliCommand = addBoolParam(cliCommand, 'dryRun', 'dry-run');
    cliCommand = addBoolParam(cliCommand, 'insecureTls', 'insecure-tls');
    // Add sync-deletes
    let syncDeletes = tl.getBoolInput('syncDeletes');
    if (syncDeletes) {
        cliCommand = addStringParam(cliCommand, 'syncDeletesPath', 'sync-deletes');
    }
    // Add numeric flags, may throw exception for illegal value
    cliCommand = addIntParam(cliCommand, 'threads', 'threads');
    cliCommand = addIntParam(cliCommand, 'retries', 'retries');
    return cliCommand;
}

function logCliVersion(cliPath) {
    let cliCommand = cliJoin(cliPath, '--version');
    try {
        let res = execSync(cliCommand);
        let detectedVersion = String.fromCharCode
            .apply(null, res)
            .split(' ')[2]
            .trim();
        console.log('JFrog CLI version: ' + detectedVersion);
    } catch (ex) {
        console.error('Failed to get JFrog CLI version: ' + ex);
    }
}

function runCbk(cliPath) {
    console.log('Running jfrog-cli from ' + cliPath + '.');
    logCliVersion(cliPath);
    runTaskCbk(cliPath);
}

function createCliDirs() {
    if (!fs.existsSync(jfrogFolderPath)) {
        fs.mkdirSync(jfrogFolderPath);
    }
}

function downloadCli(cliDownloadUrl, cliAuthHandlers, cliVersion = defaultJfrogCliVersion) {
    // If unspecified, use the default cliDownloadUrl of Bintray.
    if (!cliDownloadUrl) {
        cliDownloadUrl = buildBintrayDownloadUrl(cliVersion);
        cliAuthHandlers = [];
    }
    return new Promise((resolve, reject) => {
        localTools
            .downloadTool(cliDownloadUrl, null, cliAuthHandlers)
            .then(downloadPath => {
                toolLib.cacheFile(downloadPath, fileName, toolName, cliVersion).then(cliDir => {
                    let cliPath = path.join(cliDir, fileName);
                    if (!isWindows()) {
                        fs.chmodSync(cliPath, 0o555);
                    }
                    tl.debug('Finished downloading JFrog cli.');
                    resolve(cliPath);
                });
            })
            .catch(err => {
                reject(err);
            });
    });
}

// Compares two versions.
// Returns 0 if the versions are equal, 1 if version1 is higher and -1 otherwise.
function comparVersions(version1, version2) {
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
    let platform = process.platform;
    if (platform.startsWith('win')) {
        return 'windows-amd64';
    }
    if (platform.includes('darwin')) {
        return 'mac-386';
    }
    if (process.arch.includes('64')) {
        return 'linux-amd64';
    }
    return 'linux-386';
}

function getCliExecutableName() {
    let executable = 'jfrog';
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
 * @param str (String) - The path to encoded.
 * @returns {string} - The encoded path.
 */
function encodePath(str) {
    let encodedPath = '';
    let arr = str.split(path.sep);
    let count = 0;
    for (let section of arr) {
        if (section.length === 0) {
            continue;
        }
        count++;
        if (section.indexOf(' ') > 0 && !section.startsWith('"') && !section.endsWith('"')) {
            section = quote(section);
        }
        encodedPath += section + path.sep;
    }
    if (count > 0 && !str.endsWith(path.sep)) {
        encodedPath = encodedPath.substring(0, encodedPath.length - 1);
    }
    if (str.startsWith(path.sep)) {
        encodedPath = path.sep + encodedPath;
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
 * @returns (String|void) - String with error message or void if passes successfully.
 * @throws In CLI execution failure.
 */
function collectEnvVars(cliPath) {
    console.log('Collecting environment variables...');
    let buildName = tl.getInput('buildName', true);
    let buildNumber = tl.getInput('buildNumber', true);
    let workDir = tl.getVariable('System.DefaultWorkingDirectory');
    let cliEnvVarsCommand = cliJoin(cliPath, 'rt bce', quote(buildName), quote(buildNumber));
    executeCliCommand(cliEnvVarsCommand, workDir, null);
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
        if (path.isAbsolute(providedPath)) {
            return providedPath;
        }
        return path.join(defaultPath, providedPath);
    }
    return defaultPath;
}

// Creates a server Id from build and build tool parameters.
function assembleBuildToolServerId(buildToolType, buildToolCmd) {
    let buildName = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    return [buildName, buildNumber, buildToolType, buildToolCmd].join('_');
}

function createBuildToolConfigFile(cliPath, artifactoryService, cmd, requiredWorkDir, ConfigCommand, repoResolver, repoDeploy) {
    const artService = tl.getInput(artifactoryService);
    let cliCommand = cliJoin(cliPath, ConfigCommand);
    let serverIdResolve;
    let serverIdDeploy;
    if (repoResolver) {
        // Create serverId
        serverIdResolve = assembleBuildToolServerId(cmd, tl.getInput('command', true) + 'Resolve');
        configureCliServer(artService, serverIdResolve, cliPath, requiredWorkDir);
        // Add serverId and repo to config command
        cliCommand = cliJoin(cliCommand, '--server-id-resolve=' + quote(serverIdResolve));
        cliCommand = addStringParam(cliCommand, repoResolver, 'repo-resolve', true);
    }
    if (repoDeploy) {
        // Create serverId
        serverIdDeploy = assembleBuildToolServerId(cmd, tl.getInput('command', true) + 'Deploy');
        configureCliServer(artService, serverIdDeploy, cliPath, requiredWorkDir);
        // Add serverId and repo to config command
        cliCommand = cliJoin(cliCommand, '--server-id-deploy=' + quote(serverIdDeploy));
        cliCommand = addStringParam(cliCommand, repoDeploy, 'repo-deploy', true);
    }
    // Execute cli.
    try {
        executeCliCommand(cliCommand, requiredWorkDir, null);
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
        return cliJoin(cliCommand, '--build-name=' + quote(buildName), '--build-number=' + quote(buildNumber));
    }
    return cliCommand;
}

function deprecatedTaskMessage(oldTaskVersion, newTaskVersion) {
    console.warn(`
[Warn] You are using an old version of this task.
       It is recommended to upgrade the task to its latest major version,
       by replacing the task version in the azure-pipelines.yml file from ${oldTaskVersion} to ${newTaskVersion},
       or changing the task version from the task UI.
`);
}
