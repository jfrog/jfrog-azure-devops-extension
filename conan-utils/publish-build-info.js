const tl = require('vsts-task-lib/task');
const async = require('asyncawait/async');
const await = require('asyncawait/await');
const fs = require('fs-extra');
const path = require('path');
const request = require('request-promise-lite');

const PROCESSED_SUFFIX = "_uploaded";

/**
* Conan Publish Info Mock Implementation
*/
let publishBuildInfo = async(function (workingDir, conanUserHome, buildName,
    buildNumber, artifactoryUrl, artifactoryUser, artifactoryPassword) {

    try {
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

        let buildInfoFiles = getBuildInfoFiles(conanUserHome);
        console.log("Build Info files: " + buildInfoFiles);

        if (buildInfoFiles.length > 0) {
            let mergedBuildInfo = mergeBuildInfos(buildInfoFiles);

            // Publish Build Info
            let response =  await(callPublishBuildInfoApi(mergedBuildInfo, artifactoryUrl,
                artifactoryUser, artifactoryPassword));
            console.log("Build Info Response: " + response.toString());

            markFilesAsProcessed(buildInfoFiles);
        }

        return true;
    } catch(err) {
        console.error("Failed to publish build info: " + err.message);
        return false;
    }
});

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
    let workFolder = tl.getVariable('Agent.WorkFolder')
    let buildNumber = tl.getVariable('Build.BuildNumber')

    // Get Build Id during build process
    buildId = tl.getVariable('System.DefinitionId');
    if (hostType == "release") {
        // Get Build Id during release process
        buildId = tl.getVariable('Build.DefinitionId');
    }

    return path.join(workFolder, buildId, buildNumber);
}

/**
* Make REST API Call to publish build info to artifactory
*/
let callPublishBuildInfoApi = async(function(buildInfo, artifactoryUrl, artifactoryUser,
    artifactoryPassword) {
    console.log("Pushing Build Info to " + artifactoryUrl);
    let publishBuildInfoUrl = artifactoryUrl + "/api/build"
    let auth = "Basic " + new Buffer(artifactoryUser + ":" + artifactoryPassword).toString("base64");
    let publishBuildInfoRequest = new request.Request('PUT', publishBuildInfoUrl,
        {
            body: JSON.stringify(buildInfo),
            headers: {
                "Content-Type": "application/json",
                "Authorization": auth
            }
        }
    );
    let response = await(publishBuildInfoRequest.run());
    return response;
});

/**
* Mark files as processed
*/
function markFilesAsProcessed(buildInfoFiles) {
    console.log("Marking build info files as processed");
    for (i = 0; i < buildInfoFiles.length; i++) {
        let newPath = buildInfoFiles[i] + PROCESSED_SUFFIX;
        fs.renameSync(buildInfoFiles[i], newPath);
    }
}
/**
* Merge all build infos in a single json file
*/
function mergeBuildInfos(buildInfoFiles) {
    console.log("Merging Build Info Files");
    let mergedBuildInfo = fs.readJsonSync(buildInfoFiles[0]);
    for (i = 1; i < buildInfoFiles.length; i++) {
        let buildInfo = fs.readJsonSync(buildInfoFiles[i]);
        if (buildInfo["modules"].length > 0) {
            mergedBuildInfo["modules"] = mergedBuildInfo["modules"].concat(buildInfo["modules"]);
        }
    }
    return mergedBuildInfo;
}

/**
* Get all build info from current conanUserHome
*/
function getBuildInfoFiles(conanUserHome) {
    let buildInfoFiles = [];
    let conanUserHomeChildren = fs.readdirSync(path.join(conanUserHome, '.conan'));
    for (i = 0; i < conanUserHomeChildren.length; i++) {
        let conanUserHomeChild = conanUserHomeChildren[i];
        if (conanUserHomeChild.startsWith("build_info_") && !conanUserHomeChild.endsWith(PROCESSED_SUFFIX)) {
            buildInfoFiles.push(path.join(conanUserHome, '.conan', conanUserHomeChild));
        }
    }
    return buildInfoFiles;
}

module.exports = {
    publishBuildInfo: publishBuildInfo
}
