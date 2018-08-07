const testUtils = require('../../../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);
const TEST_DIR = path.join(testUtils.testDataDir, TEST_NAME, "/");
const BUILD_NAME = "promotionDryRun";
const BUILD_NUMBER = "3";

try {
    uploadByCli();
    publishByCli();
    promoteByTask();
    downloadByCli();
} finally {
    testUtils.deleteBuild(BUILD_NAME);
}

function uploadByCli() {
    let uploadPattern = path.join(__dirname, "files", "/");
    let uploadCommand = "rt u " + uploadPattern + " " + testUtils.repoKey1 + "/ --build-name=\"" + BUILD_NAME + "\" --build-number=\"" + BUILD_NUMBER + "\" --fail-no-op";
    testUtils.execCli(uploadCommand);
}

function publishByCli() {
    let publishCommand = "rt bp \"" + BUILD_NAME + "\" \"" + BUILD_NUMBER + "\"";
    testUtils.execCli(publishCommand);
}

function promoteByTask() {
    let testMain = path.join(__dirname, "..", "..", "..", "..", "..", "ArtifactoryPromote", "artifactoryPromote.js");
    let variables = {
        "BUILD.DEFINITIONNAME": BUILD_NAME,
        "BUILD_BUILDNUMBER": BUILD_NUMBER
    };
    let inputs = {
        "sourceRepo": testUtils.repoKey1,
        "targetRepo": testUtils.repoKey2,
        "status": "testStatus",
        "comment": "test comment",
        "includeDependencies": "true",
        "copy": "true",
        "dryRun": "true"
    };
    testUtils.runTask(testMain, variables, inputs);
}

function downloadByCli() {
    let downloadPath = testUtils.repoKey1 + "/promotionArtifact.in";
    let downloadCommand = "rt dl " + downloadPath + " " + TEST_DIR;
    testUtils.execCli(downloadCommand);
}
