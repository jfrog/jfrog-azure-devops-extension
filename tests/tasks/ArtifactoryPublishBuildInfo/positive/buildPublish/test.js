const testUtils = require('../../../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);
const TEST_DIR = path.join(testUtils.testDataDir, TEST_NAME, "/");
const BUILD_NAME = "buildPublish";
const BUILD_NUMBER = "3";

try {
    uploadByCli();
    publishByTask();
    downloadByCli();
} finally {
    testUtils.deleteBuild(BUILD_NAME);
}

function uploadByCli() {
    let uploadPattern = path.join(__dirname, "files", "/");
    let uploadCommand = "rt u " + uploadPattern + " " + testUtils.repoKey1 + "/ --build-name=" + BUILD_NAME + " --build-number=" + BUILD_NUMBER + " --fail-no-op";
    testUtils.execCli(uploadCommand);
}

function publishByTask() {
    let testMain = path.join(__dirname, "..", "..", "..", "..", "..", "ArtifactoryPublishBuildInfo", "publishBuildInfo.js");
    let variables = {
        "BUILD.DEFINITIONNAME": BUILD_NAME,
        "BUILD_BUILDNUMBER": BUILD_NUMBER
    };
    let inputs = {
        "includeEnvVars": "true"
    };
    testUtils.runTask(testMain, variables, inputs);
}

function downloadByCli() {
    let downloadPath = testUtils.repoKey1 + "/publishedArtifact.in";
    let downloadCommand = "rt dl " + downloadPath + " " + TEST_DIR + " --props=\"build.name=" + BUILD_NAME + ";build.number=" + BUILD_NUMBER + "\"";
    testUtils.execCli(downloadCommand);
}
