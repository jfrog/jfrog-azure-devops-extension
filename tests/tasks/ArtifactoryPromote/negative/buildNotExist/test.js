const testUtils = require('../../../../testUtils');
const path = require('path');

const BUILD_NAME = "buildNotExist";
const BUILD_NUMBER = "3";

try {
    uploadByCli();
    promoteByTask();
} finally {
    testUtils.deleteBuild(BUILD_NAME);
}

function uploadByCli() {
    let uploadPattern = path.join(__dirname, "files", "/");
    let uploadCommand = "rt u " + uploadPattern + " " + testUtils.repoKey1 + "/ --build-name=" + BUILD_NAME + " --build-number=" + BUILD_NUMBER + " --fail-no-op";
    testUtils.execCli(uploadCommand);
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
        "dryRun": "false"
    };
    testUtils.runTask(testMain, variables, inputs);
}
