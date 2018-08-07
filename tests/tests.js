'use strict';

const assert = require('assert');
const path = require('path');
const vstsMockTest = require('vsts-task-lib/mock-test');
const fs = require('fs');
const testUtils = require('./testUtils');

let tasksDir = path.join(__dirname, "tasks");
let tasks = fs.readdirSync(tasksDir);

describe('JFrog Artifactory VSTS extension tests', () => {
    before(() => {
        testUtils.initTests();
    });

    after(() => {
        testUtils.cleanUpTests();
    });

    // Run tests in 'task' directory
    for (let i = 0; i < tasks.length; i++) {
        let taskName = tasks[i];

        // Run positive tests in 'task' directory
        describe(taskName + ' Positive', () => {
            let testsDir = path.join(tasksDir, taskName, "positive");
            if (fs.existsSync(testsDir)) {
                let tests = fs.readdirSync(testsDir);
                for (let i = 0; i < tests.length; i++) {
                    runTest(taskName, tests[i], true);
                }
            }
        });

        // Run negative tests in 'task' directory
        describe(taskName + ' Negative', () => {
            let testsDir = path.join(tasksDir, taskName, "negative");
            if (fs.existsSync(testsDir)) {
                let tests = fs.readdirSync(testsDir);
                for (let i = 0; i < tests.length; i++) {
                    runTest(taskName, tests[i], false);
                }
            }
        });
    }
});


/**
 * Run a test
 * @param taskName (String) - The task name, e.g ArtifactoryGenericDownload, ArtifactoryGenericUpload, etc.
 * @param testName (String) - The specific test name of the task's test.
 * @param positive (Boolean) - True iff this is a positive test.
 */
function runTest(taskName, testName, positive) {
    it(testName, (done) => {
        let testDir = path.join(tasksDir, taskName, positive ? "positive" : "negative", testName);
        let testPath = path.join(testDir, "test.js");
        let mockRunner = new vstsMockTest.MockTestRunner(testPath);
        mockRunner.run(); // Mock a test
        assert(positive ? mockRunner.succeeded : mockRunner.failed, mockRunner.stdout); // Check the test results
        if (positive) {
            assertFiles(testDir, testName); // Check that the files that were downloaded to 'testDir/<testName>/' are correct
        }
        done();
    }).timeout(100000);
}

/**
 * Assert that the files that were downloaded to 'testData' are correct.
 * @param testDir - (String) The test directory where the source files exists.
 * @param testName - (String) - The specific test name of the task's test.
 */
function assertFiles(testDir, testName) {
    // Check that all necessary files were downloaded to 'testDir/<testName>/'
    let filesToCheck = [];
    let filesDir = path.join(testDir, "files");
    let testData = path.join(testUtils.testDataDir, testName);
    if (fs.existsSync(filesDir)) {
        let files = fs.readdirSync(filesDir);
        for (let i = 0; i < files.length; i++) {
            let fileName = path.basename(files[i]);
            let fileToCheck = path.join(testData, fileName);
            assert(fs.existsSync(fileToCheck), fileToCheck + " does not exist");
            filesToCheck.push(fileName);
        }
    }

    // Check that only necessary files were downloaded to 'testDir/<testName>/'
    if (!fs.existsSync(testData) && filesToCheck.length === 0) {
        return;
    }
    let files = fs.readdirSync(testData);
    for (let i = 0; i < files.length; i++) {
        let fileName = path.basename(files[i]);
        assert(filesToCheck.indexOf(fileName) >= 0, fileName + " should not exist");
    }
}
