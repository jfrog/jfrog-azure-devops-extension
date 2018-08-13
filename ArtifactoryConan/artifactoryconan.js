const conanutils = require('conan-utils');
const tl = require('vsts-task-lib/task');
const async = require('asyncawait/async');
const await = require('asyncawait/await');

function run() {
    let conanCommand = tl.getInput('conanCommand', true);

    // Handle different conan commands
    let conanArguments = []
    switch (conanCommand) {
        case "Add Remote":
            handleAddRemoteCommand()
            break;
        case "Create":
            handleCreateCommand()
            break;
        case "Upload":
            handleUploadCommand()
            break;
        case "Custom":
            handleCustomCommand()
            break;
        default:
            throw "Conan Command not supported: " + conanCommand

    }
};

/**
* Handle Conan Add Remote Command
*/
let handleAddRemoteCommand = async(function() {
    let workingDirectory = tl.getPathInput('workingDirectory', false, true);
    let conanUserHome = tl.getInput('conanUserHome', true);
    let remoteName = tl.getInput("remoteName", true);
    let artifactoryService = tl.getInput("artifactoryService", true);
    let artifactoryUrl = tl.getEndpointUrl(artifactoryService, false);
    let artifactoryUser = tl.getEndpointAuthorizationParameter(artifactoryService, "username", true);
    let artifactoryPassword = tl.getEndpointAuthorizationParameter(artifactoryService, "password", true);
    let conanRepo = tl.getInput("conanRepo", true);

    let conanArguments = [
        "remote", "add", remoteName, artifactoryUrl + "/api/conan/" + conanRepo,
        "--insert", "--force"
    ];

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
    let workingDirectory = tl.getPathInput('workingDirectory', false, true);
    let conanUserHome = tl.getInput('conanUserHome', true);
    let createPath = tl.getInput("createPath", true);
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
* Handle Conan Upload Command
*/
let handleUploadCommand = async(function() {
    let buildDefinition = tl.getVariable('Build.DefinitionName');
    let buildNumber = tl.getVariable('Build.BuildNumber');
    let workingDirectory = tl.getPathInput('workingDirectory', false, true);
    let conanUserHome = tl.getInput('conanUserHome', true);
    let patternOrReference = tl.getInput("patternOrReference", true);
    let extraArguments = tl.getInput("extraArguments", false);
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo', false);

    let conanArguments = ["upload"];
    conanArguments = addExtraArguments(conanArguments, extraArguments);
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
    let workingDirectory = tl.getPathInput('workingDirectory', false, true);
    let conanUserHome = tl.getInput('conanUserHome', true);
    let customArguments = tl.getInput('customArguments', true);
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo', false);

    let conanArguments = customArguments.split(" ");
    let taskSuccessful = await(conanutils.executeConanTask(workingDirectory,
        conanUserHome, conanArguments, collectBuildInfo, buildDefinition, buildNumber));

    setTaskResult(taskSuccessful);
});

function addExtraArguments(conanArguments, extraArguments) {
    if (extraArguments && extraArguments.trim().length > 0) {
        let extraArgumentsArray = extraArguments.split(" ");
        return conanArguments.concat(extraArgumentsArray);
    }
    return conanArguments;
}

function setTaskResult(taskSuccessful) {
    if (taskSuccessful) {
        tl.setResult(tl.TaskResult.Succeeded, "Conan Task finished.");
    } else {
        tl.setResult(tl.TaskResult.Failed, "Conan Task failed.");
    }
}

run();
