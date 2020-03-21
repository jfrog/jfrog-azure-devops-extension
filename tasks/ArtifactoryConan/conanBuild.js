const conanutils = require('./conanUtils');
const tl = require('azure-pipelines-task-lib/task');
const async = require('asyncawait/async');
const await = require('asyncawait/await');
const utils = require('artifactory-tasks-utils');

function run() {
    let conanCommand = tl.getInput('conanCommand', true);

    // Handle different conan commands
    switch (conanCommand) {
        case 'Config Install':
            handleConfigInstallCommand();
            break;
        case 'Add Remote':
            handleAddRemoteCommand();
            break;
        case 'Create':
            handleCreateCommand();
            break;
        case 'Install':
            handleInstallCommand();
            break;
        case 'Upload':
            handleUploadCommand();
            break;
        case 'Custom':
            handleCustomCommand();
            break;
        default:
            tl.setResult(tl.TaskResult.Failed, 'Conan Command not supported: ' + conanCommand);
    }
}

/**
 * Handle Conan Config Install Command
 */
let handleConfigInstallCommand = async(function() {
    let configSourceType = tl.getInput('configSourceType', true);
    let extraArguments = tl.getInput('extraArguments', false);

    let conanArguments = ['config', 'install'];
    conanArguments = addExtraArguments(conanArguments, extraArguments);

    if (configSourceType === 'zip') {
        let configZipPath = tl.getInput('configZipPath', true);
        conanArguments.push(configZipPath);
    } else {
        let configInstallGit = tl.getInput('configInstallGit', true);
        conanArguments.push('--type');
        conanArguments.push('git');
        conanArguments.push(configInstallGit);
    }

    try {
        await(conanutils.executeConanTask(conanArguments));
        setTaskResult(true);
    } catch (err) {
        console.error('Failed to execute Conan Task: ' + err.message);
        setTaskResult(false);
    }
});

/**
 * Handle Conan Add Remote Command
 */
let handleAddRemoteCommand = async(function() {
    let remoteName = tl.getInput('remoteName', true);
    let artifactoryService = tl.getInput('artifactoryService', true);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let artifactoryUser = tl.getEndpointAuthorizationParameter(artifactoryService, 'username', true);
    let artifactoryPassword = tl.getEndpointAuthorizationParameter(artifactoryService, 'password', true);
    let artifactoryAccessToken = tl.getEndpointAuthorizationParameter(artifactoryService, 'apitoken', true);
    let conanRepo = tl.getInput('conanRepo', true);
    let purgeExistingRemotes = tl.getBoolInput('purgeExistingRemotes', true);

    if (artifactoryAccessToken) {
        // Access token is not supported.
        console.error(
            'Access Token is not supported for authentication with Artifactory, please configure Artifactory service connection' +
                ' to work with basic authentication.'
        );
        setTaskResult(false);
        return;
    }

    let conanArguments = ['remote', 'add', remoteName, utils.stripTrailingSlash(artifactoryUrl) + '/api/conan/' + conanRepo, '--insert', '--force'];

    // Purge existing
    if (purgeExistingRemotes) {
        try {
            await(conanutils.purgeConanRemotes());
        } catch (err) {
            console.error('Failed to purge Conan Remotes: ' + err.message);
            setTaskResult(false);
            return;
        }
    }

    // Add remote repo configuration
    try {
        await(conanutils.executeConanTask(conanArguments));
    } catch (err) {
        console.error('Failed to execute Conan Task: ' + err.message);
        setTaskResult(false);
        return;
    }

    // Add user credentials
    conanArguments = ['user', artifactoryUser, '-r', remoteName, '-p', artifactoryPassword];

    try {
        await(conanutils.executeConanTask(conanArguments));
        setTaskResult(true);
    } catch (err) {
        console.error('Failed to execute Conan Task: ' + err.message);
        setTaskResult(false);
    }
});

/**
 * Handle Conan Create Command
 */
let handleCreateCommand = async(function() {
    let createPath = tl.getPathInput('createPath', true, true);
    let createReference = tl.getInput('createReference', true);
    let extraArguments = tl.getInput('extraArguments', false);

    let conanArguments = ['create'];
    conanArguments = addExtraArguments(conanArguments, extraArguments);
    conanArguments.push(createPath);
    conanArguments.push(createReference);

    try {
        await(conanutils.executeConanTask(conanArguments));
        setTaskResult(true);
    } catch (err) {
        console.error('Failed to execute Conan Task: ' + err.message);
        setTaskResult(false);
    }
});

/**
 * Handle Conan Install Command
 */
let handleInstallCommand = async(function() {
    let pathOrReference = tl.getInput('pathOrReference', true);
    let extraArguments = tl.getInput('extraArguments', false);

    let conanArguments = ['install'];
    conanArguments = addExtraArguments(conanArguments, extraArguments);
    conanArguments.push(pathOrReference);

    try {
        await(conanutils.executeConanTask(conanArguments));
        setTaskResult(true);
    } catch (err) {
        console.error('Failed to execute Conan Task: ' + err.message);
        setTaskResult(false);
    }
});

/**
 * Handle Conan Upload Command
 */
let handleUploadCommand = async(function() {
    let patternOrReference = tl.getInput('patternOrReference', true);
    let extraArguments = tl.getInput('extraArguments', false);

    let conanArguments = ['upload'];
    conanArguments = addExtraArguments(conanArguments, extraArguments);
    // Enforce --confirm option since the command runs in a non-interactive mode
    enforceArgumentOrOption(conanArguments, '-c', '--confirm');
    conanArguments.push(patternOrReference);

    try {
        await(conanutils.executeConanTask(conanArguments));
        setTaskResult(true);
    } catch (err) {
        console.error('Failed to execute Conan Task: ' + err.message);
        setTaskResult(false);
    }
});

/**
 * Handle Conan Custom Command
 */
let handleCustomCommand = async(function() {
    let customArguments = tl.getInput('customArguments', true);
    let conanArguments = customArguments.split(' ');

    try {
        await(conanutils.executeConanTask(conanArguments));
        setTaskResult(true);
    } catch (err) {
        console.error('Failed to execute Conan Task: ' + err.message);
        setTaskResult(false);
    }
});

/**
 * Add extra arguments to list of options and arguments
 *
 * @param conanArguments (Array) - Collection of options and arguments
 * @param extraArguments (String) - String containing the input of extra options and arguments
 */
function addExtraArguments(conanArguments, extraArguments) {
    if (extraArguments && extraArguments.trim().length > 0) {
        let extraArgumentsArray = extraArguments.split(' ');
        return conanArguments.concat(extraArgumentsArray);
    }
    return conanArguments;
}

/**
 * Enforce the presence of an option or argument in the list of arguments
 *
 * @param conanArguments (Array) - Collection of options and arguments
 * @param shortVersion (string) - Short version of option or argument
 * @param longVersion (string) - Long version of option or argument
 */
function enforceArgumentOrOption(conanArguments, shortVersion, longVersion) {
    if (conanArguments.indexOf(shortVersion) < 0 && conanArguments.indexOf(longVersion) < 0) {
        conanArguments.push(longVersion);
    }
}

/**
 * Set Task Result
 *
 * @param taskSuccessful (Boolean) - Flag with task result.
 *                                       True: Task was Successful.
 *                                       False: Task failed.
 */
function setTaskResult(taskSuccessful) {
    if (taskSuccessful) {
        tl.setResult(tl.TaskResult.Succeeded, 'Conan Task finished.');
    } else {
        tl.setResult(tl.TaskResult.Failed, 'Conan Task failed.');
    }
}

run();
