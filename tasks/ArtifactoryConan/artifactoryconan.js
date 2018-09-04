const conanutils = require('conan-utils');
const tl = require('vsts-task-lib/task');
const async = require('asyncawait/async');
const await = require('asyncawait/await');

function run() {
    let conanCommand = tl.getInput('conanCommand', true);

    // Handle different conan commands
    let conanArguments = []
    switch (conanCommand) {
        case "Config Install":
            handleConfigInstallCommand();
            break;
        case "Add Remote":
            handleAddRemoteCommand();
            break;
        case "Create":
            handleCreateCommand();
            break;
        case "Install":
            handleInstallCommand();
            break;
        case "Upload":
            handleUploadCommand();
            break;
        case "Custom":
            handleCustomCommand();
            break;
        default:
            tl.setResult(tl.TaskResult.Failed, "Conan Command not supported: " + conanCommand);
    }
}

/**
* Handle Conan Config Install Command
*/
let handleConfigInstallCommand = async(function() {
    let workingDirectory = tl.getPathInput('workingDirectory', false, false);
    let conanUserHome = tl.getInput('conanUserHome', false);
    let configSourceType = tl.getInput('configSourceType', true);
    let extraArguments = tl.getInput("extraArguments", false);

    let conanArguments = ["config", "install"];
    conanArguments = addExtraArguments(conanArguments, extraArguments);

    if (configSourceType == "zip") {
        let configZipPath = tl.getInput("configZipPath", true);
        conanArguments.push(configZipPath);
    } else {
        let configInstallGit = tl.getInput("configInstallGit", true);
        conanArguments.push("--type");
        conanArguments.push("git");
        conanArguments.push(configInstallGit);
    }

    // Add remote repo configuration
    let taskSuccessful = await(conanutils.executeConanTask(workingDirectory,
        conanUserHome, conanArguments, false));

    setTaskResult(taskSuccessful);
});

/**
* Handle Conan Add Remote Command
*/
let handleAddRemoteCommand = async(function() {
    let workingDirectory = tl.getPathInput('workingDirectory', false, false);
    let conanUserHome = tl.getInput('conanUserHome', false);
    let remoteName = tl.getInput("remoteName", true);
    let artifactoryService = tl.getInput("artifactoryService", true);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let artifactoryUser = tl.getEndpointAuthorizationParameter(artifactoryService, "username", true);
    let artifactoryPassword = tl.getEndpointAuthorizationParameter(artifactoryService, "password", true);
    let conanRepo = tl.getInput("conanRepo", true);
    let purgeExistingRemotes = tl.getBoolInput("purgeExistingRemotes", true);

    let conanArguments = [
        "remote", "add", remoteName, artifactoryUrl + "/api/conan/" + conanRepo,
        "--insert", "--force"
    ];

    // Purge existing
    if (purgeExistingRemotes) {
        let taskSuccessful = await(conanutils.purgeConanRemotes(workingDirectory,
            conanUserHome));
        if (!taskSuccessful) {
            setTaskResult(taskSuccessful);
            return;
        }
    }

    // Add remote repo configuration
    let taskSuccessful = await(conanutils.executeConanTask(workingDirectory,
        conanUserHome, conanArguments, false));

    if (taskSuccessful) {
        // Add user credentials
        conanArguments = [
            "user", artifactoryUser, "-r", remoteName, "-p", artifactoryPassword,
        ]
        taskSuccessful = await(conanutils.executeConanTask(workingDirectory,
            conanUserHome, conanArguments, false));
    }

    setTaskResult(taskSuccessful);
});

/**
* Handle Conan Create Command
*/
let handleCreateCommand = async(function() {
    let buildDefinition = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    let workingDirectory = tl.getPathInput('workingDirectory', false, false);
    let conanUserHome = tl.getInput('conanUserHome', false);
    let createPath = tl.getPathInput("createPath", true, true);
    let createReference = tl.getInput("createReference", true);
    let extraArguments = tl.getInput("extraArguments", false);
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo', false);

    let conanArguments = ["create"];
    conanArguments = addExtraArguments(conanArguments, extraArguments);
    conanArguments.push(createPath);
    conanArguments.push(createReference);

    // Add remote repo configuration
    let taskSuccessful = await(conanutils.executeConanTask(workingDirectory,
        conanUserHome, conanArguments, collectBuildInfo, buildDefinition, buildNumber));

    setTaskResult(taskSuccessful);
});

/**
* Handle Conan Install Command
*/
let handleInstallCommand = async(function() {
    let buildDefinition = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    let workingDirectory = tl.getPathInput('workingDirectory', false, false);
    let conanUserHome = tl.getInput('conanUserHome', false);
    let pathOrReference = tl.getInput("pathOrReference", true);
    let extraArguments = tl.getInput("extraArguments", false);
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo', false);

    let conanArguments = ["install"];
    conanArguments = addExtraArguments(conanArguments, extraArguments);
    conanArguments.push(pathOrReference);

    // Add remote repo configuration
    let taskSuccessful = await(conanutils.executeConanTask(workingDirectory,
        conanUserHome, conanArguments, collectBuildInfo, buildDefinition, buildNumber));

    setTaskResult(taskSuccessful);
});

/**
* Handle Conan Upload Command
*/
let handleUploadCommand = async(function() {
    let buildDefinition = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    let workingDirectory = tl.getPathInput('workingDirectory', false, false);
    let conanUserHome = tl.getInput('conanUserHome', false);
    let patternOrReference = tl.getInput("patternOrReference", true);
    let extraArguments = tl.getInput("extraArguments", false);
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo', false);

    let conanArguments = ["upload"];
    conanArguments = addExtraArguments(conanArguments, extraArguments);
    // Enforce --confirm option since the command runs in a non-interactive mode
    enforceArgumentOrOption(conanArguments, "-c", "--confirm");
    conanArguments.push(patternOrReference);

    // Add remote repo configuration
    let taskSuccessful = await(conanutils.executeConanTask(workingDirectory,
        conanUserHome, conanArguments, collectBuildInfo, buildDefinition, buildNumber));

    setTaskResult(taskSuccessful);
})

/**
* Handle Conan Custom Command
*/
let handleCustomCommand = async(function() {
    let buildDefinition = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    let workingDirectory = tl.getPathInput('workingDirectory', false, false);
    let conanUserHome = tl.getInput('conanUserHome', false);
    let customArguments = tl.getInput('customArguments', true);
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo', false);

    let conanArguments = customArguments.split(" ");
    let taskSuccessful = await(conanutils.executeConanTask(workingDirectory,
        conanUserHome, conanArguments, collectBuildInfo, buildDefinition, buildNumber));

    setTaskResult(taskSuccessful);
});

/**
* Add extra arguments to list of options and arguments
*
* @param conanArguments (Array) - Collection of options and arguments
* @param extraArguments (String) - String containing the input of extra options and arguments
*/
function addExtraArguments(conanArguments, extraArguments) {
    if (extraArguments && extraArguments.trim().length > 0) {
        let extraArgumentsArray = extraArguments.split(" ");
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
    if(conanArguments.indexOf(shortVersion) < 0 && conanArguments.indexOf(longVersion) < 0) {
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
        tl.setResult(tl.TaskResult.Succeeded, "Conan Task finished.");
    } else {
        tl.setResult(tl.TaskResult.Failed, "Conan Task failed.");
    }
}

run();
