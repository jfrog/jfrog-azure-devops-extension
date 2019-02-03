const tl = require('azure-pipelines-task-lib/task');
const async = require('asyncawait/async');
const await = require('asyncawait/await');
const uuid = require('uuid/v1');
const os = require('os');
const fs = require('fs-extra');
const path = require('path');

// Helper Constants
const CONAN_ARTIFACTS_PROPERTIES_BUILD_NAME = "artifact_property_build.name";
const CONAN_ARTIFACTS_PROPERTIES_BUILD_NUMBER = "artifact_property_build.number";
const CONAN_ARTIFACTS_PROPERTIES_BUILD_TIMESTAMP = "artifact_property_build.timestamp";
const BUILD_INFO_BUILD_NAME = "name";
const BUILD_INFO_BUILD_NUMBER = "number";
const BUILD_INFO_BUILD_STARTED = "started";
const BUILD_INFO_FILE_NAME = "generatedBuildInfo";
const BUILD_TEMP_PATH = "jfrog/builds";

/**
* Execute Artifactory Conan Task
* @param workingDir (string) - Path to Working Directory where Conan command will
*                               be executed
* @param commandArgs (Array) - Conan command arguments
*/
let executeConanTask = async(function (commandArgs) {
    let workingDir = tl.getPathInput('workingDirectory', false, false);
    let conanUserHome = tl.getInput('conanUserHome', false);
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo', false);

    let conanTaskId = generateConanTaskUUId();
    tl.debug("Conan Task Id: " + conanTaskId);
    let buildTimestamp = Date.now();

    let conanPath = null;
    try {
        /*
        * Get Conan tool Path. This will force the conan task to fail fast if
        * conan tool is not available in the PATH
        */
        conanPath = tl.which('conan', true);
        console.log("Running Conan build tool from: " + conanPath);
    } catch (err) {
        throw new Error("Failed to locate Conan executable path: " + err);
    }

    /*
    * Set Conan Environment Variable
    * Conan User Home is set as a variable in the phase scope so it will be
    * available to every task running after this one
    */
    if (!conanUserHome) {
        conanUserHome = getDefaultConanUserHome();
    }
    console.log("Conan User Home: " + conanUserHome);
    tl.setVariable('CONAN_USER_HOME', conanUserHome);

    // Prepare Conan to generate build info
    if (collectBuildInfo) {
        let buildName = tl.getInput('buildName',true);
        let buildNumber = tl.getInput('buildNumber',true);
        try {
            initCliPartialsBuildDir(buildName, buildNumber);
            setConanTraceFileLocation(conanUserHome, conanTaskId);
            setArtifactsBuildInfoProperties(conanUserHome, buildName, buildNumber, buildTimestamp);
        } catch (err) {
            throw new Error("Failed to setup Build Info collection: " + err.message);
        }
    }

    // Run conan command and set task result
    let exitCode = await(executeConanCommand(conanPath, commandArgs, workingDir));
    if (exitCode !== 0) {
        throw new Error("Conan command returned bad exit code: " + exitCode);
    }

    // Generate build info if requested
    if (collectBuildInfo) {
        exitCode = await(generateBuildInfo(conanUserHome, conanTaskId));
        if (exitCode !== 0) {
            throw new Error("Failed to generate build info with bad exit code: " + exitCode);
        }
        try{
            completeBuildInfo(conanUserHome, conanTaskId);
        } catch (err) {
            throw new Error("Failed to make Build Info available: " + err);
        }
    }
});

/**
* Generate a unique ID to be used by this Conan task
*/
function generateConanTaskUUId() {
    return uuid();
}

/**
* Get Default Conan User Home Folder.
*
* If process is a build it will be:
* $(Agent.WorkFolder)/$(System.DefinitionId)/$(Build.BuildId)
*
* If the process is a release it will be:
* $(Agent.WorkFolder)/$(Build.DefinitionId)/$(Build.BuildId)
*/
function getDefaultConanUserHome() {
    let hostType = tl.getVariable('System.HostType');
    let workFolder = tl.getVariable('Agent.WorkFolder');
    let buildNumber = tl.getVariable('Build.BuildNumber');

    // Get Build Id during build process
    let buildId = tl.getVariable('System.DefinitionId');
    if (hostType === "release") {
        // Get Build Id during release process
        buildId = tl.getVariable('Build.DefinitionId');
    }

    return path.join(workFolder, buildId, buildNumber);
}

/**
* Create Conan artifacts.properties file with build info information.
* The properties in this file will be attached to all artifacts pushed to
* Artifactory by Conan.
*
* If the file is already present with content related to the specific buildName and
* and buildNumber arguments, this file generation is skiped and the current file
* will be used.
*
* If the file is present with content related to a different buildName and buildNumber
* it will be overwritten with the new content.
*
* @param conanUserHome (string) - Conan User Home location
* @param buildName (string) - Build name used to generate buildInfo
* @param buildNumber (string) - Build number used to generate buildInfo
* @param buildTimestamp (string) - Timestamp attached to buildInfo started date
*/
function setArtifactsBuildInfoProperties(conanUserHome, buildName, buildNumber, buildTimestamp) {
    let conanArtifactsPropertiesPath = getConanArtifactsPropertiesLocation(conanUserHome);

    //Check if existing content is related to current buildInfo information
    if (fs.existsSync(conanArtifactsPropertiesPath)) {
        let existingContent = fs.readFileSync(conanArtifactsPropertiesPath);
        let propertiesMap = convertConanPropertiesToMap(existingContent.toString());
        if (CONAN_ARTIFACTS_PROPERTIES_BUILD_NAME in propertiesMap &&
            CONAN_ARTIFACTS_PROPERTIES_BUILD_NUMBER in propertiesMap) {
            if (buildName === propertiesMap[CONAN_ARTIFACTS_PROPERTIES_BUILD_NAME] &&
                buildNumber === propertiesMap[CONAN_ARTIFACTS_PROPERTIES_BUILD_NUMBER]) {
                tl.debug("Conan artifacts.properties already set for this build at " + conanArtifactsPropertiesPath);
                return;
            } else {
                throw new Error("Conan artifacts.properties file exists at "
                    + conanArtifactsPropertiesPath + " with different build info values.");
            }
        }
    }

    // Generate file
    let content =
        CONAN_ARTIFACTS_PROPERTIES_BUILD_NAME + "=" + buildName + os.EOL +
        CONAN_ARTIFACTS_PROPERTIES_BUILD_NUMBER + "=" + buildNumber + os.EOL +
        CONAN_ARTIFACTS_PROPERTIES_BUILD_TIMESTAMP + "=" + buildTimestamp + os.EOL;
    fs.outputFileSync(conanArtifactsPropertiesPath, content);
    tl.debug("Conan artifacts.properties file created at " + conanArtifactsPropertiesPath);
}

/**
* Execute Conan Command
* @param conanPath (string) - Path to Conan Tool
* @param commandArgs (Array) - Conan command arguments list
* @param workingDir (string) - Working directory location. If set, command will
*                              be executed at this location
*/
let executeConanCommand = async( function(conanPath, commandArgs, workingDir) {

    cleanupConanArguments(commandArgs);

    // Create command
    let conan = tl.tool(conanPath).arg(commandArgs);
    let options = {
        failOnStdErr: false,
        errStream: process.stdout,
        outStream: process.stdout,
        ignoreReturnCode: true
    };

    // Set working dir if present
    if (workingDir) {
        // Make sure custom working directory exists
        fs.mkdirsSync(workingDir);
    } else {
        // Use default working dir
        workingDir = tl.getVariable('System.DefaultWorkingDirectory');
    }

    console.log("Running Conan command at: " + workingDir);
    options['cwd'] = workingDir;

    // Run command and wait for exitCode
    return await(conan.exec(options));
});

/**
* Cleanup empty arguments and remove conan keyword from the beginning of arguments
* list if present
* @param commandArgs (Array) - The collection of arguments
*/
function cleanupConanArguments(commandArgs) {
    if (commandArgs[0] === "conan") {
        commandArgs.splice(0, 1);
    }
    for (let i = 0; i < commandArgs.length; i++) {
        commandArgs[i] = commandArgs[i].trim();
        if (commandArgs[i] === "") {
            commandArgs.splice(i, 1);
            // Process the current index again, since one element has been removed
            i--;
        }
    }
}

/**
* Generate buildInfo Json file. Run conan_build_info tool to convert the conan
* trace file to a buildinfo json file
* @param conanUserHome (string) - Conan User Home location
* @param conanTaskId (string) - Conan Task Id
*/
let generateBuildInfo = async( function (conanUserHome, conanTaskId) {
    let conanBuildInfoPath = tl.which('conan_build_info', true);
    let buildInfoFilePath = getBuildInfoFileLocation(conanUserHome, conanTaskId);
    let conanTraceFilePath = process.env.CONAN_TRACE_FILE;

    console.log("Generating Build Info at " + buildInfoFilePath);

    let conanBuildInfoArgs = [
        conanTraceFilePath,
        "--output",
        buildInfoFilePath
    ];

    let options = {
        failOnStdErr: false,
        errStream: process.stdout,
        outStream: process.stdout,
        ignoreReturnCode: true
    };

    let conanBuildInfo = tl.tool(conanBuildInfoPath).arg(conanBuildInfoArgs);

    // Run command and wait for exitCode
    return await(conanBuildInfo.exec(options));
});

/**
* Complete build info json file with information from artifacts.properties
* @param conanUserHome (string) - Conan User Home location
* @param conanTaskId (string) - Conan Task Id
*/
function completeBuildInfo(conanUserHome, conanTaskId) {
    let conanArtifactsPropertiesPath = getConanArtifactsPropertiesLocation(conanUserHome);
    let buildInfoFilePath = getBuildInfoFileLocation(conanUserHome, conanTaskId);

    // Read artifacts.properties file
    let content = fs.readFileSync(conanArtifactsPropertiesPath);
    let propertiesMap = convertConanPropertiesToMap(content.toString());

    let buildName = propertiesMap[CONAN_ARTIFACTS_PROPERTIES_BUILD_NAME];
    let buildNumber = propertiesMap[CONAN_ARTIFACTS_PROPERTIES_BUILD_NUMBER];

    // Read build info json file
    let buildInfoJson = fs.readJsonSync(buildInfoFilePath);
    buildInfoJson[BUILD_INFO_BUILD_NAME] = buildName;
    buildInfoJson[BUILD_INFO_BUILD_NUMBER] = buildNumber;
    let buildTimestamp = new Date(parseInt(propertiesMap[CONAN_ARTIFACTS_PROPERTIES_BUILD_TIMESTAMP], 10));
    buildInfoJson[BUILD_INFO_BUILD_STARTED] = buildTimestamp.toISOString();


    // Delete the previously created BuildInfo
    fs.unlinkSync(buildInfoFilePath);
    buildInfoFilePath = path.join(getCliPartialsBuildDir(buildName, buildNumber), BUILD_INFO_FILE_NAME + conanTaskId);

    // Write build info json file
    fs.writeJsonSync(buildInfoFilePath, buildInfoJson);
    tl.debug("Build Info created at " + buildInfoFilePath);
}

/**
* Set enviroment variable with the location for the Conan Trace File
* This file will later be used to generate the buildInfo json file if requested
* by the user
* @param conanUserHome (string) - Conan User Home location
* @param conanTaskId (string) - Conan Task Id
*/
function setConanTraceFileLocation(conanUserHome, conanTaskId) {
    process.env.CONAN_TRACE_FILE = path.join(conanUserHome, ".conan", "conan_trace_" + conanTaskId + ".log");
}

/**
* Get build info file location
* @param conanUserHome (string) - Conan User Home location
* @param conanTaskId (string) - Conan Task Id
*/
function getBuildInfoFileLocation(conanUserHome, conanTaskId) {
    return path.join(conanUserHome, ".conan", "build_info_" + conanTaskId + ".json");
}

/**
* Get Conan artifacts.properties file location
* @param conanUserHome (string) - Conan User Home location
*/
function getConanArtifactsPropertiesLocation(conanUserHome) {
    return path.join(conanUserHome, '.conan', 'artifacts.properties');
}

/**
* Convert content in format key=value to a Map
* @param propertiesContent (String) - Properties content
*/
function convertConanPropertiesToMap(propertiesContent) {
    if (!propertiesContent) {
        return {};
    }
    let map = {};
    let lines = propertiesContent.split(os.EOL);
    for (let i = 0; i < lines.length; i++) {
        let parts = lines[i].split("=");
        let key = parts[0];
        parts.splice(0, 1);
        map[key] = parts.join("=");
    }
    return map;
}

/**
* Purge existing Conan remote repositories
*/
let purgeConanRemotes = async(function () {
    let conanUserHome = tl.getInput('conanUserHome', false);

    let conanPath = null;
    try {
        /*
        * Get Conan tool Path. This will force the conan task to fail fast if
        * conan tool is not available in the PATH
        */
        let conanPath = tl.which('conan', true);
        console.log("Running Conan build tool from: " + conanPath);
    } catch (err) {
        throw new Error("Failed to locate Conan executable path: " + err.message);
    }

    /*
    * Set Conan Environment Variable
    * Conan User Home is set as a variable in the phase scope so it will be
    * availabe to every task running after this one
    */
    if (!conanUserHome) {
        conanUserHome = getDefaultConanUserHome();
    }
    console.log("Conan User Home: " + conanUserHome);
    tl.setVariable('CONAN_USER_HOME', conanUserHome);

    // Make sure Conan User Home exists
    let conanFolder = path.join(conanUserHome, '.conan');
    fs.mkdirsSync(conanFolder);

    // Empty registry.txt file to remove all existing remotes
    let registryFile = path.join(conanFolder, 'registry.txt');
    console.log("Purging Conan remotes by removing content of " + registryFile);
    try {
        fs.writeFileSync(registryFile, '');
    } catch (err) {
        throw new Error("Failed to remove registry.txt file content: " + err.message);
    }
});

/**
  * Creates the path of for partials build info and initializing the details file with Timestamp.
  * @param buildName (string) - The build name
  * @param buildNumber (string) - The build number
  */
function initCliPartialsBuildDir(buildName, buildNumber) {
        let partialsBuildDir = path.join(getCliPartialsBuildDir(buildName, buildNumber), "partials");
        if (!fs.pathExistsSync(partialsBuildDir)) {
                fs.ensureDirSync(partialsBuildDir);
            }
        fs.writeJsonSync(path.join(partialsBuildDir, "details"), {Timestamp: new Date().toISOString()});
        tl.debug("Created partial details at: " + path.join(partialsBuildDir, "details"))
}


function getCliPartialsBuildDir(buildName, buildNumber) {
    return path.join(os.tmpdir(), BUILD_TEMP_PATH, Buffer.from(buildName + "_" + buildNumber).toString('base64'));
}

module.exports = {
    executeConanTask: executeConanTask,
    getCliPartialsBuildDir: getCliPartialsBuildDir, // Exported for tests
    purgeConanRemotes: purgeConanRemotes
};
