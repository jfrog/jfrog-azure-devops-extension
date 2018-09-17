"use strict";

const assert = require("assert");
const path = require("path");
const vstsMockTest = require("vsts-task-lib/mock-test");
const fs = require("fs-extra");
const testUtils = require("./testUtils");
const os = require("os");
const determineCliWorkDir = require("../tasks/ArtifactoryNpm/npmUtils").determineCliWorkDir;
const execSync = require('child_process').execSync;
let tasksOutput;

describe("JFrog Artifactory VSTS Extension Tests", () => {
    let jfrogUtils;
    before(() => {
        // Validate environment variables exist for tests
        assert(testUtils.artifactoryUrl, "Tests are missing environment variable: VSTS_ARTIFACTORY_URL");
        assert(testUtils.artifactoryUsername, "Tests are missing environment variable: VSTS_ARTIFACTORY_USERNAME");
        assert(testUtils.artifactoryPassword, "Tests are missing environment variable: VSTS_ARTIFACTORY_PASSWORD");

        testUtils.initTests();
        jfrogUtils = require("artifactory-tasks-utils");
    });

    beforeEach(() => {
        tasksOutput = "";
    });

    after(() => {
        testUtils.cleanUpAllTests();
    });

    describe("Unit Tests", () => {
        console.log("OS:", os.type());
        runTest("Mask password", () => {
            let oldPassword = process.env.VSTS_ARTIFACTORY_PASSWORD;
            process.env.VSTS_ARTIFACTORY_PASSWORD = "SUPER_SECRET";
            let retVal = jfrogUtils.executeCliCommand("jfrog rt del " + testUtils.repoKey1 + "/" + " --url=" + jfrogUtils.quote(process.env.VSTS_ARTIFACTORY_URL) + " --user=" + jfrogUtils.quote(process.env.VSTS_ARTIFACTORY_USERNAME) + " --password=" + jfrogUtils.quote("SUPER_SECRET"), testUtils.testDataDir, [""]);
            process.env.VSTS_ARTIFACTORY_PASSWORD = oldPassword;
            assert(!retVal.toString().includes("SUPER_SECRET"), "Output contains password");
        });

        runTest("Cli join", () => {
            assert.strictEqual(jfrogUtils.cliJoin("jfrog", "rt", "u"), "jfrog rt u");
            assert.strictEqual(jfrogUtils.cliJoin("jfrog"), "jfrog");
            assert.strictEqual(jfrogUtils.cliJoin("jfrog", "rt", "u", "a/b/c", "a/b/c"), "jfrog rt u a/b/c a/b/c");
            assert.strictEqual(jfrogUtils.cliJoin("jfrog", "rt", "u", "a\b\c", "a\b\c"), "jfrog rt u a\b\c a\b\c");
            assert.strictEqual(jfrogUtils.cliJoin("jfrog", "rt", "u", "a\\b\c\\", "a\\b\c\\"), "jfrog rt u a\\b\c\\ a\\b\c\\");
        });

        runTest("Fix windows paths", () => {
            let specBeforeFix = fs.readFileSync(path.join(__dirname, "resources", "fixWindowsPaths", "specBeforeFix.json"), "utf8");
            let expectedSpecAfterFix = fs.readFileSync(path.join(__dirname, "resources", "fixWindowsPaths", "specAfterFix.json"), "utf8");
            let specAfterFix = jfrogUtils.fixWindowsPaths(specBeforeFix);
            assert.strictEqual(specAfterFix, testUtils.isWindows() ? expectedSpecAfterFix : specBeforeFix, "\nSpec after fix:\n" + specAfterFix);
        });

        runTest("Encode paths", () => {
            if (testUtils.isWindows()) {
                assert.strictEqual(jfrogUtils.encodePath("dir1\\dir 2\\dir 3"), "dir1\\\"dir 2\"\\\"dir 3\"");
                assert.strictEqual(jfrogUtils.encodePath("dir 1\\dir2\\a b.txt"), "\"dir 1\"\\dir2\\\"a b.txt\"");
                assert.strictEqual(jfrogUtils.encodePath("dir1\\dir2\\a.txt"), "dir1\\dir2\\a.txt");
                assert.strictEqual(jfrogUtils.encodePath("dir1\\"), "dir1\\");
                assert.strictEqual(jfrogUtils.encodePath("dir1"), "dir1");
                assert.strictEqual(jfrogUtils.encodePath("dir 1"), "\"dir 1\"");
                // Avoid double encoding
                assert.strictEqual(jfrogUtils.encodePath("\"dir 1\""), "\"dir 1\"");
            } else {
                assert.strictEqual(jfrogUtils.encodePath("dir1/dir 2/dir 3"), "dir1/\"dir 2\"/\"dir 3\"");
                assert.strictEqual(jfrogUtils.encodePath("dir 1/dir2/a b.txt"), "\"dir 1\"/dir2/\"a b.txt\"");
                assert.strictEqual(jfrogUtils.encodePath("dir1/dir2/a.txt"), "dir1/dir2/a.txt");
                assert.strictEqual(jfrogUtils.encodePath("dir1/"), "dir1/");
                assert.strictEqual(jfrogUtils.encodePath("dir1"), "dir1");
                assert.strictEqual(jfrogUtils.encodePath("dir 1"), "\"dir 1\"");
                assert.strictEqual(jfrogUtils.encodePath("/dir1"), "/dir1");
                // Avoid double encoding
                assert.strictEqual(jfrogUtils.encodePath("\"dir 1\""), "\"dir 1\"");
            }
        });

        runTest("Get architecture", () => {
            let arch = jfrogUtils.getArchitecture();
            switch (os.type()) {
                case "Linux":
                    assert(arch.startsWith("linux"));
                    break;
                case "Darwin":
                    assert.strictEqual(arch, "mac-386");
                    break;
                case "Windows_NT":
                    assert.strictEqual(arch, "windows-amd64");
                    break;
                default:
                    assert.fail("Unsupported OS found: " + os.type());
            }
        });

        runTest("Npm - determine cli workdir", () => {
            if (testUtils.isWindows()) {
                assert.strictEqual(determineCliWorkDir("C:\\myAgent\\_work\\1", "C:\\myAgent\\_work\\1\\myFolder"), "C:\\myAgent\\_work\\1\\myFolder");
                assert.strictEqual(determineCliWorkDir("C:\\myAgent\\_work\\1", ""), "C:\\myAgent\\_work\\1");
                assert.strictEqual(determineCliWorkDir("C:\\myAgent\\_work\\1", "myFolder\\123"), "C:\\myAgent\\_work\\1\\myFolder\\123");
            } else {
                assert.strictEqual(determineCliWorkDir("/Users/myUser/myAgent/_work/1", "/Users/myUser/myAgent/_work/1/myFolder"), "/Users/myUser/myAgent/_work/1/myFolder");
                assert.strictEqual(determineCliWorkDir("/Users/myUser/myAgent/_work/1", ""), "/Users/myUser/myAgent/_work/1");
                assert.strictEqual(determineCliWorkDir("/Users/myUser/myAgent/_work/1", "myFolder/123"), "/Users/myUser/myAgent/_work/1/myFolder/123");
            }
        });
    });

    describe("Upload and Download Tests", () => {
        runTest("Upload and download", () => {
            let testDir = "uploadAndDownload";
            mockTask(testDir, "upload");
            mockTask(testDir, "download");
            assertFiles(path.join(testDir, "files"), testDir);
        });

        runTest("Upload and download from file", () => {
            let testDir = "uploadAndDownloadFromFile";
            mockTask(testDir, "upload");
            mockTask(testDir, "download");
            assertFiles(path.join(testDir, "files"), testDir);
        });

        runTest("Upload fail-no-op", () => {
            let testDir = "uploadFailNoOp";
            mockTask(testDir, "upload", true);
            assertFiles(path.join(testDir, "files"), testDir);
        });

        runTest("Download fail-no-op", () => {
            let testDir = "downloadFailNoOp";
            mockTask(testDir, "download", true);
            assertFiles(path.join(testDir, "files"), testDir);
        });

        runTest("Include environment variables", () => {
            let testDir = "includeEnv";
            mockTask(testDir, "upload");
            mockTask(testDir, "publish");
            let build = getAndAssertBuild("includeEnv", "3");
            assertBuildEnv(build, "buildInfo.env.BUILD_DEFINITIONNAME", "includeEnv");
            assertBuildEnv(build, "buildInfo.env.BUILD_BUILDNUMBER", "3");
            assertBuildEnv(build, "buildInfo.env.BUILD_UNDEFINED", "undefined");
            assertBuildEnv(build, "buildInfo.env.BUILD_NULL", "null");
            assertBuildEnv(build, "buildInfo.env.BUILD_PASSWORD", "open-sesame");
            deleteBuild("includeEnv");
        })
    });

    describe("Publish Build Info Tests", () => {
        runTest("Publish build info", () => {
            let testDir = "publishBuildInfo";
            mockTask(testDir, "upload");
            mockTask(testDir, "publish");
            mockTask(testDir, "download");
            assertFiles(path.join(testDir, "files"), testDir);
            getAndAssertBuild("buildPublish", "3");
            deleteBuild("buildPublish");
        });

        runTest("Exclude Environment Variables", () => {
            let testDir = "excludeEnv";
            mockTask(testDir, "upload");
            mockTask(testDir, "publish");
            let build = getAndAssertBuild("excludeEnv", "3");
            assertBuildEnv(build, "buildInfo.env.BUILD_DEFINITIONNAME", "excludeEnv");
            assertBuildEnv(build, "buildInfo.env.BUILD_BUILDNUMBER", "3");
            assertBuildEnv(build, "buildInfo.env.BUILD_UNDEFINED", "undefined");
            assertBuildEnv(build, "buildInfo.env.BUILD_NULL", "null");
            assertBuildEnv(build, "buildInfo.env.BUILD_PASSWORD", undefined);
            deleteBuild("excludeEnv");
        })
    });

    describe("Build Promotion Tests", () => {
        runTest("Build promotion", () => {
            let testDir = "promotion";
            mockTask(testDir, "upload");
            mockTask(testDir, "publish");
            mockTask(testDir, "promote");
            mockTask(testDir, "download");
            assertFiles(path.join(testDir, "files"), testDir);
            getAndAssertBuild("buildPromote", "3");
            deleteBuild("buildPromote");
        });

        runTest("Build promotion dry run", () => {
            let testDir = "promotionDryRun";
            mockTask(testDir, "upload");
            mockTask(testDir, "publish");
            mockTask(testDir, "promote");
            mockTask(testDir, "download");
            assertFiles(path.join(testDir, "files"), testDir);
            getAndAssertBuild("buildPromoteDryRun", "3");
            deleteBuild("buildPromoteDryRun");
        });
    });

    describe("Npm Tests", () => {
        runTest("Npm", () => {
            let testDir = "npm";
            mockTask(testDir, "npmInstall");
            mockTask(testDir, "npmPublish");
            mockTask(testDir, "download");
            mockTask(testDir, "publish");
            assertFiles(path.join(testDir, "files"), path.join(testDir, "1"));
            getAndAssertBuild("npmTest", "1");
            deleteBuild("npmTest");
        }, testUtils.isSkipTest("npm"));
    });

    describe("Maven Tests", () => {
        runTest("Maven", () => {
            let testDir = "maven";
            mockTask(testDir, "build");
            mockTask(testDir, "publish");
            mockTask(testDir, "download");
            assertFiles(path.join(testDir, "files"), path.join(testDir, "files"));
            getAndAssertBuild("Maven", "3");
            deleteBuild("Maven");
        }, testUtils.isSkipTest("maven"));
    });

    describe("NuGet Tests", () => {
        runTest("NuGet restore", () => {
            let testDir = "nuget";
            // There is a bug in Artifactory when creating a remote nuget repository. Cannot be created via REST API. Need to create manually.
            assert(testUtils.isRepoExists(testUtils.remoteNuGet), "Create nuget remote repository: " + testUtils.remoteNuGet + " in order to run nuget tests");
            mockTask(testDir, "restore");
            mockTask(testDir, "publish");
            getAndAssertBuild("NuGet", "3");
            deleteBuild("NuGet");
        }, testUtils.isSkipTest("nuget"));
        runTest("NuGet push", () => {
            let testDir = "nuget";
            // There is a bug in Artifactory when creating a remote nuget repository. Cannot be created via REST API. Need to create manually.
            assert(testUtils.isRepoExists(testUtils.remoteNuGet), "Create nuget remote repository: " + testUtils.remoteNuGet + " in order to run nuget tests");
            mockTask(testDir, "push");
            mockTask(testDir, "publish");
            mockTask(testDir, "download");
            assertFiles(path.join(testDir, "files"), path.join(testDir, "files"));
            getAndAssertBuild("NuGet", "3");
            deleteBuild("NuGet");
        }, testUtils.isSkipTest("nuget"));
    });

    describe("Docker Tests", () => {
        runTest("Docker push", () => {
            assert(testUtils.artifactoryDockerDomain, "Tests are missing environment variable: VSTS_ARTIFACTORY_DOCKER_DOMAIN");
            assert(testUtils.artifactoryDockerRepo, "Tests are missing environment variable: VSTS_ARTIFACTORY_DOCKER_REPO");

            let testDir = "docker";
            let filesDir = testUtils.isWindows() ? "windowsFiles" : "unixFiles";
            // Run docker build + tag
            execSync("docker build -t " + testUtils.artifactoryDockerDomain + "/docker-test:1 " + path.join(__dirname, "resources", testDir, filesDir));
            // run docker push
            mockTask(testDir, "push");
            mockTask(testDir, "publish");
            getAndAssertBuild("dockerTest", "1");
            deleteBuild("dockerTest");
        }, testUtils.isSkipTest("docker"))
    })
});

/**
 * Run a test using mocha suit.
 * @param description (String) - Test description
 * @param testFunc (Function) - The test logic
 * @param skip (Boolean) - If should skip the test
 */
function runTest(description, testFunc, skip) {
    if (skip) {
        it.skip(description);
        return;
    }

    it(description, (done) => {
        testFunc();
        done();
    }).timeout(300000); // 5 minutes
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
    tasksOutput += mockRunner.stderr + "\n" + mockRunner.stdout;
    assert(isNegative ? mockRunner.failed : mockRunner.succeeded, "\nFailure in: " + taskPath + ".\n" + tasksOutput); // Check the test results
}

/**
 * Assert that the files that were downloaded to "testData" are correct.
 * @param expectedFiles - (String) - The relative path of expected files under tests/resources
 * @param resultFiles - (String) - The relative path of result files under testDataDir
 */
function assertFiles(expectedFiles, resultFiles) {
    // Check that all necessary files were downloaded to "testDir/<testName>/"
    let filesToCheck = [];
    let filesDir = path.join(__dirname, "resources", expectedFiles);
    let testData = path.join(testUtils.testDataDir, resultFiles);
    if (fs.existsSync(filesDir)) {
        let files = fs.readdirSync(filesDir);
        for (let i = 0; i < files.length; i++) {
            let fileName = path.basename(files[i]);
            let fileToCheck = path.join(testData, fileName);
            assert(fs.existsSync(fileToCheck), fileToCheck + " does not exist.\n" + tasksOutput);
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
        assert(filesToCheck.indexOf(fileName) >= 0, fileName + " should not exist.\n" + tasksOutput);
    }
}

/**
 * Get build from Artifactory and assert that it exists.
 * @param buildName - (String) - The build name
 * @param buildNumber - (String) - The build number
 */
function getAndAssertBuild(buildName, buildNumber) {
    let build = testUtils.getBuild(buildName, buildNumber);
    assertBuild(build, buildName, buildNumber);
    return build;
}

/**
 * Assert build environment in the build.
 * @param build - (Object) - The build object returned from Artifactory
 * @param key - (String) - The build environment key
 * @param value - (String) - The build environment value
 */
function assertBuildEnv(build, key, value) {
    let body = JSON.parse(build.getBody('utf8'));
    let actual = body["buildInfo"]["properties"][key];
    assert.equal(actual, value, "Expected: '" + key + " = " + value + "'. Actual: '" + key + " = " + actual + "'.\n" + tasksOutput);
}

function assertBuild(build, buildName, buildNumber) {
    assert(build.statusCode < 300 && build.statusCode >= 200, "Build " + buildName + "/" + buildNumber + " doesn't exist in Artifactory.\n" + tasksOutput);
}

function deleteBuild(buildName) {
    testUtils.deleteBuild(buildName);
}
