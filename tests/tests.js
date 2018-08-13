"use strict";

const assert = require("assert");
const path = require("path");
const vstsMockTest = require("vsts-task-lib/mock-test");
const fs = require("fs-extra");
const testUtils = require("./testUtils");
const os = require("os");

describe("JFrog Artifactory VSTS Extension Tests", () => {
    let jfrogUtils;
    before(() => {
        testUtils.initTests();
        jfrogUtils = require("jfrog-utils");
    });

    after(() => {
        testUtils.cleanUpTests();
    });

    describe("Utils Tests", () => {
        console.log("OS:", os.type());
        runTest("Mask password", () => {
            let oldPassword = process.env.VSTS_ARTIFACTORY_PASSWORD;
            process.env.VSTS_ARTIFACTORY_PASSWORD = "SUPER_SECRET";
            let retVal = jfrogUtils.executeCliCommand("jfrog rt del " + testUtils.repoKey1 + "/" + " --url=" + jfrogUtils.quote(process.env.VSTS_ARTIFACTORY_URL) + " --user=" + jfrogUtils.quote(process.env.VSTS_ARTIFACTORY_USERNAME) + " --password=" + jfrogUtils.quote("SUPER_SECRET"), testUtils.testDataDir, [""]);
            process.env.VSTS_ARTIFACTORY_PASSWORD = oldPassword;
            assert(!retVal.toString().includes("SUPER_SECRET"), "Output contains password");
        });

        runTest("Cli join", () => {
            assert.equal(jfrogUtils.cliJoin("jfrog", "rt", "u"), "jfrog rt u");
            assert.equal(jfrogUtils.cliJoin("jfrog"), "jfrog");
            assert.equal(jfrogUtils.cliJoin("jfrog", "rt", "u", "a/b/c", "a/b/c"), "jfrog rt u a/b/c a/b/c");
            assert.equal(jfrogUtils.cliJoin("jfrog", "rt", "u", "a\b\c", "a\b\c"), "jfrog rt u a\b\c a\b\c");
            assert.equal(jfrogUtils.cliJoin("jfrog", "rt", "u", "a\\b\c\\", "a\\b\c\\"), "jfrog rt u a\\b\c\\ a\\b\c\\");
        });

        runTest("Fix windows paths", () => {
            let specBeforeFix = fs.readFileSync(path.join(__dirname, "resources", "fixWindowsPaths", "specBeforeFix.json"), "utf8");
            let expectedSpecAfterFix = fs.readFileSync(path.join(__dirname, "resources", "fixWindowsPaths", "specAfterFix.json"), "utf8");
            let specAfterFix = jfrogUtils.fixWindowsPaths(specBeforeFix);
            assert.equal(specAfterFix, process.platform.startsWith("win") ? expectedSpecAfterFix : specBeforeFix, "\nSpec after fix:\n" + specAfterFix);
        });

        runTest("Encode paths", () => {
            if (process.platform.startsWith("win")) {
                assert.equal(jfrogUtils.encodePath("dir1\\dir 2\\dir 3"), "dir1\\\"dir 2\"\\\"dir 3\"");
                assert.equal(jfrogUtils.encodePath("dir 1\\dir2\\a b.txt"), "\"dir 1\"\\dir2\\\"a b.txt\"");
                assert.equal(jfrogUtils.encodePath("dir1\\dir2\\a.txt"), "dir1\\dir2\\a.txt");
                assert.equal(jfrogUtils.encodePath("dir1\\"), "dir1\\");
                assert.equal(jfrogUtils.encodePath("dir1"), "dir1");
                assert.equal(jfrogUtils.encodePath("dir 1"), "\"dir 1\"");
            } else {
                assert.equal(jfrogUtils.encodePath("dir1/dir 2/dir 3"), "dir1/\"dir 2\"/\"dir 3\"");
                assert.equal(jfrogUtils.encodePath("dir 1/dir2/a b.txt"), "\"dir 1\"/dir2/\"a b.txt\"");
                assert.equal(jfrogUtils.encodePath("dir1/dir2/a.txt"), "dir1/dir2/a.txt");
                assert.equal(jfrogUtils.encodePath("dir1/"), "dir1/");
                assert.equal(jfrogUtils.encodePath("dir1"), "dir1");
                assert.equal(jfrogUtils.encodePath("dir 1"), "\"dir 1\"");
                assert.equal(jfrogUtils.encodePath("/dir1"), "/dir1");
            }
        });

        runTest("Get architecture", () => {
            let arch = jfrogUtils.getArchitecture();
            switch (os.type()) {
                case "Linux":
                    assert(arch.startsWith("linux"));
                    break;
                case "Darwin":
                    assert.equal(arch, "mac-386");
                    break;
                case "Windows_NT":
                    assert.equal(arch, "windows-amd64");
                    break;
                default:
                    assert.fail("Unsupported OS found: " + os.type());
            }
        })
    });

    describe("Upload and Download Tests", () => {
        runTest("Upload and download", () => {
            let testDir = "uploadAndDownload";
            mockTask(testDir, "upload");
            mockTask(testDir, "download");
            assertFiles(testDir);
        });

        runTest("Upload fail-no-op", () => {
            let testDir = "uploadFailNoOp";
            mockTask(testDir, "upload", true);
            assertFiles(testDir);
        });

        runTest("Download fail-no-op", () => {
            let testDir = "downloadFailNoOp";
            mockTask(testDir, "download", true);
            assertFiles(testDir);
        });
    });

    describe("Publish Build Info Tests", () => {
        runTest("Publish build info", () => {
            let testDir = "publishBuildInfo";
            mockTask(testDir, "upload");
            mockTask(testDir, "publish");
            mockTask(testDir, "download");
            assertAndDeleteBuild("buildPublish", "3");
            assertFiles(testDir);
        });
    });

    describe("Build Promotion Tests", () => {
        runTest("Build promotion", () => {
            let testDir = "promotion";
            mockTask(testDir, "upload");
            mockTask(testDir, "publish");
            mockTask(testDir, "promote");
            mockTask(testDir, "download");
            assertAndDeleteBuild("buildPromote", "3");
            assertFiles(testDir);
        });

        runTest("Build promotion dry run", () => {
            let testDir = "promotionDryRun";
            mockTask(testDir, "upload");
            mockTask(testDir, "publish");
            mockTask(testDir, "promote");
            mockTask(testDir, "download");
            assertAndDeleteBuild("buildPromoteDryRun", "3");
            assertFiles(testDir);
        });
    });

    describe("Conan Task Tests", () => {
        runTest("Conan Custom Command", () => {
            let testDir = "conanTask";
            mockTask(testDir, "conanCustomCommand");
        });

        runTest("Conan Custom Command With Working Dir", () => {
            let testDir = "conanTask";
            mockTask(testDir, "conanCustomCommandWithWorkingDir");
        });

        runTest("Conan Custom Invalid Command", () => {
            let testDir = "conanTask";
            mockTask(testDir, "conanCustomInvalidCommand", true);
        });

        runTest("Conan Custom Command With Build Info", () => {
            let testDir = "conanTask";
            mockTask(testDir, "conanCustomCommandWithBuildInfo");
        });

        runTest("Conan Add Remote", () => {
            let testDir = "conanTask";
            mockTask(testDir, "conanAddRemote");
        });

        runTest("Conan Create And Upload", () => {
            let testDir = "conanTask";
            mockTask(testDir, "conanAddRemote");
            mockTask(testDir, "conanCreate");
            mockTask(testDir, "conanUpload");
        });

        runTest("Conan Install", () => {
            let testDir = "conanTask";
            mockTask(testDir, "conanInstall");
        });

        runTest("Conan Add Config", () => {
            let testDir = "conanTask";
            mockTask(testDir, "conanConfigInstall");
        });
    });

});

/**
 * Run a test using mocha suit.
 * @param description (String) - Test description
 * @param testFunc (Function) - The test logic
 */
function runTest(description, testFunc) {
    it(description, (done) => {
        testFunc();
        done();
    }).timeout(100000);
}

/**
 * Mock a task from resources directory.
 * @param testDir (String) - The test directory in resources
 * @param taskName (String) - The '.js' file
 * @param isNegative (Boolean) - True if the task supposed to fail
 */
function mockTask(testDir, taskName, isNegative) {
    let taskPath = path.join(__dirname, "resources", testDir, taskName + ".js");
    let mockRunner = new vstsMockTest.MockTestRunner(taskPath);
    mockRunner.run(); // Mock a test
    assert(isNegative ? mockRunner.failed : mockRunner.succeeded, "\nFailure in: " + taskPath + "\n" + mockRunner.stdout); // Check the test results
}

/**
 * Assert that the files that were downloaded to "testData" are correct.
 * @param testDir - (String) - The test directory in resources
 */
function assertFiles(testDir) {
    // Check that all necessary files were downloaded to "testDir/<testName>/"
    let filesToCheck = [];
    let filesDir = path.join(__dirname, "resources", testDir, "files");
    let testData = path.join(testUtils.testDataDir, testDir);
    if (fs.existsSync(filesDir)) {
        let files = fs.readdirSync(filesDir);
        for (let i = 0; i < files.length; i++) {
            let fileName = path.basename(files[i]);
            let fileToCheck = path.join(testData, fileName);
            assert(fs.existsSync(fileToCheck), fileToCheck + " does not exist");
            filesToCheck.push(fileName);
        }
    }

    // Check that only necessary files were downloaded to "testDir/<testName>/"
    if (!fs.existsSync(testData) && filesToCheck.length === 0) {
        return;
    }
    let files = fs.readdirSync(testData);
    for (let i = 0; i < files.length; i++) {
        let fileName = path.basename(files[i]);
        assert(filesToCheck.indexOf(fileName) >= 0, fileName + " should not exist");
    }
}

/**
 * Assert build exist in Artifactory and delete it.
 * @param buildName - (String) - The build name
 * @param buildNumber - (String) - The build number
 */
function assertAndDeleteBuild(buildName, buildNumber) {
    assert(testUtils.isBuildExist(buildName, buildNumber), "Build " + buildName + "/" + buildNumber + " doesn't exist in Artifactory");
    testUtils.deleteBuild(buildName);
}
